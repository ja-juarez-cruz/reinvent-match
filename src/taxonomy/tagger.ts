import type { NormalizedSession } from "../catalog/normalize.js";
import { aliasesOf, normalizeText, textContains } from "../match/labels.js";
import {
  AI_SUBTOPICS,
  AUDIENCES,
  CONCEPTS,
  CONTENT_TYPES,
  DOMAINS,
  EXTRA_TECHNOLOGIES,
  LEARNING_STYLES,
  TRACKS,
  type Rule,
} from "./taxonomy.js";

export interface SessionTags {
  track: { code: string; label: string } | null;
  primaryDomain: string;
  /** All domains the session belongs to, primary first. */
  domains: string[];
  aiSubtopics: string[];
  technologies: string[];
  audiences: string[];
  learningStyle: string;
  contentTypes: string[];
  concepts: string[];
  level: "100" | "200" | "300" | "400+" | "none";
}

interface Prepared {
  topics: Set<string>;
  areas: Set<string>;
  serviceAliases: Set<string>;
  title: string;
  text: string;
}

function prepare(s: NormalizedSession): Prepared {
  return {
    topics: new Set(s.topics.map(normalizeText)),
    areas: new Set(s.areasOfInterest.map(normalizeText)),
    serviceAliases: new Set(s.services.flatMap(aliasesOf)),
    title: normalizeText(s.title),
    text: normalizeText(`${s.title}\n${s.abstract}`),
  };
}

// Rule label lists are normalized once, not per session.
const normalizedRules = new WeakMap<Rule, { topics: string[]; areas: string[]; services: string[][] }>();

function matches(rule: Rule, p: Prepared): boolean {
  let n = normalizedRules.get(rule);
  if (!n) {
    n = {
      topics: (rule.topics ?? []).map(normalizeText),
      areas: (rule.areas ?? []).map(normalizeText),
      services: (rule.services ?? []).map(aliasesOf),
    };
    normalizedRules.set(rule, n);
  }
  return (
    n.topics.some((t) => p.topics.has(t)) ||
    n.areas.some((a) => p.areas.has(a)) ||
    n.services.some((aliases) => aliases.some((a) => p.serviceAliases.has(a))) ||
    (rule.titleKeywords ?? []).some((k) => textContains(p.title, k)) ||
    (rule.textKeywords ?? []).some((k) => textContains(p.text, k))
  );
}

/** "Amazon Elastic Kubernetes Service (Amazon EKS)" → "Amazon EKS"; names without a short form stay as they are. */
export function technologyLabel(service: string): string {
  return service.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? service;
}

const DOMAIN_BY_TOPIC = new Map(
  DOMAINS.flatMap((d) => (d.topics ?? []).map((t) => [normalizeText(t), d.id] as const)),
);

export function tagSession(s: NormalizedSession): SessionTags {
  const p = prepare(s);
  const prefix = s.code.match(/^[A-Z]+/)?.[0] ?? "";
  const track = TRACKS[prefix];

  const matchedDomains = DOMAINS.filter((d) => matches(d, p)).map((d) => d.id);
  if (s.industries.length > 0 && !matchedDomains.includes("industry")) matchedDomains.push("industry");
  const primaryDomain =
    track?.domain ??
    s.topics.map((t) => DOMAIN_BY_TOPIC.get(normalizeText(t))).find((d) => d !== undefined) ??
    matchedDomains[0] ??
    "other";
  const domains = [primaryDomain, ...matchedDomains.filter((d) => d !== primaryDomain)];

  const aiSubtopics = domains.includes("ai") ? AI_SUBTOPICS.filter((t) => matches(t, p)).map((t) => t.id) : [];

  const technologies = [
    ...s.services.map(technologyLabel),
    ...EXTRA_TECHNOLOGIES.filter((t) => t.keywords.some((k) => textContains(p.text, k))).map((t) => t.label),
  ];

  const roles = new Set(s.roles);
  const audiences = AUDIENCES.filter((a) => a.roles.some((r) => roles.has(r))).map((a) => a.id);

  const learningStyle = LEARNING_STYLES.find((l) => l.formats.includes(s.format))?.id ?? "presentation";

  const contentTypes = CONTENT_TYPES.filter((c) => {
    switch (c.id) {
      case "customer-story":
        return s.isCustomerStory;
      case "partner":
        return s.isSponsored || s.features.includes("AWS Partners") || prefix === "PEX";
      case "community":
        return s.features.includes("Community-led") || prefix === "COM";
      case "patterns":
        return s.archDepth >= 2;
      case "research":
        return prefix === "INV" || /^5\d\d/.test(s.levelLabel ?? "");
      case "leadership":
        return prefix === "SNR" || matches(c, p);
      case "getting-started":
        return s.level === 0 || matches(c, p);
      case "deep-technical":
        return s.level === 3 || matches(c, p);
      default:
        return matches(c, p);
    }
  }).map((c) => c.id);

  const concepts = CONCEPTS.filter((c) => matches(c, p)).map((c) => c.id);

  const level = s.level === null ? "none" : s.level === 3 ? "400+" : (["100", "200", "300"] as const)[s.level];

  return {
    track: track ? { code: prefix, label: track.label } : null,
    primaryDomain,
    domains: [...new Set(domains)],
    aiSubtopics,
    technologies: [...new Set(technologies)],
    audiences,
    learningStyle,
    contentTypes,
    concepts,
    level,
  };
}
