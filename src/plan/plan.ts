import type { NormalizedSession } from "../catalog/normalize.js";
import type { Reason } from "../match/engine.js";
import { aliasesOf } from "../match/labels.js";
import { tagSession, type SessionTags } from "../taxonomy/tagger.js";
import { CONCEPTS, DOMAINS, DOMAIN_NEIGHBORS, EXTRA_TECHNOLOGIES } from "../taxonomy/taxonomy.js";
import { FORMAT_CHOICES, type Answers, type SelfLevel } from "./answers.js";

export const INTENTS = ["reinforce", "broaden", "learn"] as const;
export type Intent = (typeof INTENTS)[number];

export interface VocabularyEntry {
  key: string;
  label: string;
  count: number;
  /** Topic a technology belongs to. */
  domain?: string;
  /** For topics: the technology and concept keys that come with it when the attendee picks it. */
  related?: string[];
}

/** Technologies and concepts that come with each topic. */
export type TopicRelations = Record<string, string[]>;

export interface Vocabulary {
  domains: VocabularyEntry[];
  technologies: VocabularyEntry[];
  concepts: VocabularyEntry[];
}

export interface PlanSession {
  id: string;
  code: string;
  title: string;
  abstract: string;
  format: string;
  formatLabel: string | null;
  levelLabel: string | null;
  isSponsored: boolean;
  mayRepeat: boolean;
  speakers: string[];
  schedule: NormalizedSession["schedule"];
}

export interface PlanItem {
  intent: Intent;
  score: number;
  reasons: Reason[];
  session: PlanSession;
  /** Taxonomy keys the session contributes to a learning plan: main topic, technologies and concepts. */
  keys: string[];
  learningStyle: string;
}

export interface Plan {
  results: PlanItem[];
  hidden: { format: number; tooBasic: number; other: number };
  /** Everything the UI needs to turn liked sessions into a learning-plan report. */
  context: {
    known: string[];
    learn: string[];
    knownDomains: string[];
    neighborDomains: string[];
    techDomain: Record<string, string>;
    labels: Record<string, string>;
  };
}

const LEVEL_INDEX: Record<string, number | null> = { "100": 0, "200": 1, "300": 2, "400+": 3, none: null };
/** Proficiency on what the attendee knows. */
const KNOWN_PROFICIENCY: Record<SelfLevel, number> = { basic: 1, intermediate: 2, advanced: 3 };
/** Highest comfortable level on a topic that is new to the attendee. */
const NEW_TOPIC_LEVEL: Record<SelfLevel, number> = { basic: 1, intermediate: 2, advanced: 2 };
const LEVEL_NAMES = ["100", "200", "300", "400"];

const IRREPLACEABILITY: Record<string, number> = {
  "hands-on": 1,
  discussion: 0.95,
  "live-coding": 0.8,
  presentation: 0.3,
  certification: 0.4,
};

const STYLE_REASON: Record<string, string> = {
  "hands-on": "Hands-on: you build it yourself, hard to replicate after the event.",
  discussion: "Interactive discussion with AWS experts; not usually recorded.",
  "live-coding": "Live coding you can question as it happens.",
};

const DOMAIN_LABELS = new Map(DOMAINS.map((d) => [d.id, d.label]));
const CONCEPT_LABELS = new Map(CONCEPTS.map((c) => [c.id, c.label]));

export function labelOfKey(key: string): string {
  const [kind, id = ""] = splitKey(key);
  if (kind === "domain") return DOMAIN_LABELS.get(id) ?? id;
  if (kind === "concept") return CONCEPT_LABELS.get(id) ?? id;
  return id;
}

function splitKey(key: string): [string, string] {
  const i = key.indexOf(":");
  return [key.slice(0, i), key.slice(i + 1)];
}

interface Tagged {
  session: NormalizedSession;
  tags: SessionTags;
}

function tagAll(sessions: NormalizedSession[]): Tagged[] {
  return sessions.map((session) => ({ session, tags: tagSession(session) }));
}

/** Topic a technology is curated under in the taxonomy (service lists and extra technologies), if any. */
function curatedDomain(tech: string): string | undefined {
  const extra = EXTRA_TECHNOLOGIES.find((t) => t.label === tech);
  if (extra) return extra.domain;
  const aliases = aliasesOf(tech);
  return DOMAINS.find((d) => (d.services ?? []).some((s) => aliasesOf(s).some((a) => aliases.includes(a))))?.id;
}

/**
 * The topic each technology belongs to: the taxonomy's curated mapping first, otherwise the main topic it shows
 * up under most often in this catalog.
 */
function technologyDomains(tagged: Tagged[]): Record<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const { tags } of tagged) {
    for (const tech of tags.technologies) {
      const byDomain = counts.get(tech) ?? new Map<string, number>();
      byDomain.set(tags.primaryDomain, (byDomain.get(tags.primaryDomain) ?? 0) + 1);
      counts.set(tech, byDomain);
    }
  }
  return Object.fromEntries(
    [...counts].map(([tech, byDomain]) => [
      tech,
      curatedDomain(tech) ?? [...byDomain].sort((a, b) => b[1] - a[1])[0]![0],
    ]),
  );
}

const MAX_RELATED_TECHNOLOGIES = 8;
const MAX_RELATED_CONCEPTS = 4;
/** A concept belongs to a topic when it shows up this many times more often there than across the catalog. */
const CONCEPT_LIFT = 1.5;

/**
 * What picking a topic brings along: its most common technologies and the concepts that are characteristic of it.
 * Concepts use lift rather than raw counts, otherwise AI (in most sessions) would claim every concept.
 */
function topicRelations(tagged: Tagged[], techDomain: Record<string, string>): TopicRelations {
  const techCount = new Map<string, number>();
  const conceptCount = new Map<string, number>();
  for (const { tags } of tagged) {
    for (const t of tags.technologies) techCount.set(t, (techCount.get(t) ?? 0) + 1);
    for (const c of tags.concepts) conceptCount.set(c, (conceptCount.get(c) ?? 0) + 1);
  }
  const relations: TopicRelations = {};
  for (const domain of DOMAINS.map((d) => d.id)) {
    const technologies = Object.entries(techDomain)
      .filter(([tech, d]) => d === domain && (techCount.get(tech) ?? 0) >= 2)
      .sort((a, b) => (techCount.get(b[0]) ?? 0) - (techCount.get(a[0]) ?? 0))
      .slice(0, MAX_RELATED_TECHNOLOGIES)
      .map(([tech]) => `tech:${tech}`);

    const inDomain = tagged.filter(({ tags }) => tags.domains.includes(domain));
    const counts = new Map<string, number>();
    for (const { tags } of inDomain) for (const c of tags.concepts) counts.set(c, (counts.get(c) ?? 0) + 1);
    const concepts = [...counts]
      .map(([c, n]) => ({ c, n, lift: n / inDomain.length / ((conceptCount.get(c) ?? 1) / tagged.length) }))
      .filter(({ n, lift }) => n >= 3 && lift >= CONCEPT_LIFT)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, MAX_RELATED_CONCEPTS)
      .map(({ c }) => `concept:${c}`);

    relations[domain] = [...technologies, ...concepts];
  }
  return relations;
}

/** Topic keys plus everything they bring along. */
export function expandTopics(topicKeys: string[], relations: TopicRelations): string[] {
  return [...new Set(topicKeys.flatMap((key) => [key, ...(relations[splitKey(key)[1]] ?? [])]))];
}

export function buildVocabulary(sessions: NormalizedSession[], maxTechnologies = 90): Vocabulary {
  const tagged = tagAll(sessions);
  const techDomain = technologyDomains(tagged);
  const relations = topicRelations(tagged, techDomain);
  const tally = (keysOf: (t: SessionTags) => string[]) => {
    const counts = new Map<string, number>();
    for (const { tags } of tagged) for (const k of new Set(keysOf(tags))) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  return {
    domains: tally((t) => t.domains).map(([id, count]) => ({
      key: `domain:${id}`,
      label: labelOfKey(`domain:${id}`),
      count,
      related: relations[id] ?? [],
    })),
    technologies: tally((t) => t.technologies)
      .slice(0, maxTechnologies)
      .map(([id, count]) => ({ key: `tech:${id}`, label: id, count, domain: techDomain[id] })),
    concepts: tally((t) => t.concepts).map(([id, count]) => ({ key: `concept:${id}`, label: labelOfKey(`concept:${id}`), count })),
  };
}

function domainsOfKeys(keys: string[], techDomain: Record<string, string>): Set<string> {
  const domains = new Set<string>();
  for (const key of keys) {
    const [kind, id] = splitKey(key);
    if (kind === "domain") domains.add(id);
    if (kind === "tech" && techDomain[id]) domains.add(techDomain[id]);
  }
  return domains;
}

function hitStrength(key: string, primaryDomain: string): number {
  const [kind, id] = splitKey(key);
  if (kind === "domain") return id === primaryDomain ? 1 : 0.6;
  if (kind === "tech") return 0.9;
  return 0.7;
}

export function buildPlan(sessions: NormalizedSession[], answers: Answers): Plan {
  const tagged = tagAll(sessions);
  const techDomain = technologyDomains(tagged);
  const relations = topicRelations(tagged, techDomain);
  // Attendees pick topics; each topic brings its technologies and characteristic concepts along.
  const knownKeys = expandTopics(answers.known, relations);
  const learnKeys = expandTopics(answers.learn, relations).filter((k) => !knownKeys.includes(k));
  const known = new Set(knownKeys);
  const learn = new Set(learnKeys);
  const knownDomains = domainsOfKeys(answers.known, techDomain);
  const learnDomains = domainsOfKeys(answers.learn, techDomain);
  const neighborDomains = new Set(
    [...knownDomains].flatMap((d) => DOMAIN_NEIGHBORS[d] ?? []).filter((d) => !knownDomains.has(d)),
  );
  const allowedFormats = new Set(
    FORMAT_CHOICES.filter((c) => answers.formats.includes(c.id)).flatMap((c) => c.formats),
  );
  const proficiency = KNOWN_PROFICIENCY[answers.level];
  const newTopicLevel = NEW_TOPIC_LEVEL[answers.level];

  const hidden = { format: 0, tooBasic: 0, other: 0 };
  const labels: Record<string, string> = {};
  const results: PlanItem[] = [];

  for (const { session, tags } of tagged) {
    if (session.format === "break" || session.format === "keynote" || session.restrictedTo.length > 0) {
      hidden.other += 1;
      continue;
    }
    if (!allowedFormats.has(session.format)) {
      hidden.format += 1;
      continue;
    }

    const keys = [
      ...tags.domains.map((d) => `domain:${d}`),
      ...tags.technologies.map((t) => `tech:${t}`),
      ...tags.concepts.map((c) => `concept:${c}`),
    ];
    const knownHits = keys.filter((k) => known.has(k)).sort((a, b) => hitStrength(b, tags.primaryDomain) - hitStrength(a, tags.primaryDomain));
    const learnHits = keys.filter((k) => learn.has(k)).sort((a, b) => hitStrength(b, tags.primaryDomain) - hitStrength(a, tags.primaryDomain));
    const level = LEVEL_INDEX[tags.level] ?? null;
    const coreKnownHit = knownHits.find((k) => hitStrength(k, tags.primaryDomain) >= 0.7);
    const mainIsKnown = knownDomains.has(tags.primaryDomain);
    const mainIsNeighbor = neighborDomains.has(tags.primaryDomain);

    // Reinforce wins when the session is squarely about what the attendee knows; anything they want to learn in it
    // shows up as a reason. Otherwise an explicit learning goal beats broadening.
    let intent: Intent;
    let deciding: string | undefined;
    if (coreKnownHit && mainIsKnown) {
      if (level !== null && level - proficiency < -1) {
        hidden.tooBasic += 1;
        continue;
      }
      intent = "reinforce";
      deciding = coreKnownHit;
    } else if (learnHits.length > 0) {
      intent = "learn";
      deciding = learnHits[0];
    } else if (knownHits.length > 0 || mainIsKnown || mainIsNeighbor) {
      intent = "broaden";
      deciding = knownHits[0];
    } else if (learn.size === 0 || learnDomains.has(tags.primaryDomain)) {
      intent = "learn";
    } else {
      hidden.other += 1;
      continue;
    }

    // Broadening into a neighboring topic is closer to the attendee than applying one tool in a far-away area.
    const distance = intent === "broaden" && !mainIsKnown && !mainIsNeighbor ? 0.75 : 1;
    const relevance =
      distance *
      (deciding
        ? Math.min(1, hitStrength(deciding, tags.primaryDomain) + 0.08 * (knownHits.length + learnHits.length - 1))
        : mainIsKnown || mainIsNeighbor
          ? 0.6
          : 0.45);
    const levelFit = fitLevel(intent, level, proficiency, newTopicLevel);
    const irreplaceability = IRREPLACEABILITY[tags.learningStyle] ?? 0.5;
    const depth = session.archDepth / 3;
    let score = 0.35 * relevance + 0.25 * levelFit + 0.25 * irreplaceability + 0.15 * depth;
    if (session.isCustomerStory) score = Math.min(1, score + 0.03);
    if (session.isSponsored) score *= 0.85;

    // Secondary topics are noisy (AI is everywhere), so only those the attendee picked count toward the plan.
    const planKeys = [
      `domain:${tags.primaryDomain}`,
      ...tags.domains.map((d) => `domain:${d}`).filter((k) => known.has(k) || learn.has(k)),
      ...tags.technologies.map((t) => `tech:${t}`),
      ...tags.concepts.map((c) => `concept:${c}`),
    ];
    for (const key of new Set([...keys, ...planKeys])) labels[key] ??= labelOfKey(key);

    results.push({
      intent,
      score: Math.round(score * 100),
      reasons: explain({ intent, deciding, knownHits, learnHits, tags, level, proficiency, newTopicLevel, session, mainIsKnown }),
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        abstract: session.abstract,
        format: session.format,
        formatLabel: session.formatLabel,
        levelLabel: session.levelLabel,
        isSponsored: session.isSponsored,
        mayRepeat: session.mayRepeat,
        speakers: session.speakers,
        schedule: session.schedule,
      },
      keys: [...new Set(planKeys)],
      learningStyle: tags.learningStyle,
    });
  }

  results.sort((a, b) => INTENTS.indexOf(a.intent) - INTENTS.indexOf(b.intent) || b.score - a.score);
  for (const key of [...knownKeys, ...learnKeys]) labels[key] ??= labelOfKey(key);

  return {
    results,
    hidden,
    context: {
      known: knownKeys,
      learn: learnKeys,
      knownDomains: [...knownDomains],
      neighborDomains: [...neighborDomains],
      techDomain,
      labels,
    },
  };
}

function fitLevel(intent: Intent, level: number | null, proficiency: number, newTopicLevel: number): number {
  if (level === null) return 0.5;
  if (intent === "reinforce") {
    const stretch = level - proficiency;
    return stretch === 1 ? 1 : stretch === 0 ? 0.8 : stretch === -1 ? 0.4 : 0.6;
  }
  const gap = level - newTopicLevel;
  return gap === 0 ? 1 : gap === -1 ? 0.8 : gap < -1 ? 0.5 : gap === 1 ? 0.45 : 0.2;
}

function explain(ctx: {
  intent: Intent;
  deciding: string | undefined;
  knownHits: string[];
  learnHits: string[];
  tags: SessionTags;
  level: number | null;
  proficiency: number;
  newTopicLevel: number;
  session: NormalizedSession;
  mainIsKnown: boolean;
}): Reason[] {
  const { intent, deciding, knownHits, learnHits, tags, level, proficiency, newTopicLevel, session, mainIsKnown } = ctx;
  const reasons: Reason[] = [];
  const main = labelOfKey(`domain:${tags.primaryDomain}`);
  const levelName = level === null ? null : LEVEL_NAMES[level];

  if (intent === "reinforce" && deciding) {
    reasons.push({ kind: "pro", text: `Goes deeper on ${labelOfKey(deciding)}, which you already know.` });
    if (level !== null) {
      const stretch = level - proficiency;
      if (stretch >= 1) reasons.push({ kind: "pro", text: `Level ${levelName}: a step above your level, where you grow the most.` });
      else if (stretch === 0) reasons.push({ kind: "info", text: `Level ${levelName}: at your level; expect depth rather than new ground.` });
      else reasons.push({ kind: "con", text: `Level ${levelName}: below your level; worth it only for the angle it takes.` });
    }
  } else if (intent === "broaden") {
    reasons.push(
      deciding
        ? { kind: "pro", text: `Applies ${labelOfKey(deciding)}, which you know, to ${main}.` }
        : mainIsKnown
          ? { kind: "pro", text: `A new angle on ${main}, beyond the tools you listed.` }
          : { kind: "pro", text: `${main} sits next to what you know; a natural way to widen your profile.` },
    );
  } else {
    reasons.push(
      deciding
        ? { kind: "pro", text: `Covers ${labelOfKey(deciding)}, which you want to learn.` }
        : { kind: "info", text: `New ground for you: ${main}.` },
    );
  }
  if (intent !== "reinforce" && level !== null) {
    const gap = level - newTopicLevel;
    if (gap > 0) reasons.push({ kind: "con", text: `Level ${levelName} on a topic that is new to you; it may assume background.` });
    else reasons.push({ kind: "pro", text: `Level ${levelName}: a good entry point for a new topic at your experience.` });
  }

  const wanted = learnHits.filter((k) => k !== deciding).map(labelOfKey);
  if (wanted.length > 0) reasons.push({ kind: "pro", text: `Also covers what you want to learn: ${wanted.join(", ")}.` });
  const others = knownHits.filter((k) => k !== deciding).map(labelOfKey);
  if (others.length > 0) reasons.push({ kind: "info", text: `Also uses what you know: ${others.slice(0, 4).join(", ")}.` });

  const skills = tags.concepts.map((c) => labelOfKey(`concept:${c}`));
  if (skills.length > 0) reasons.push({ kind: "pro", text: `Skills: ${skills.slice(0, 4).join(", ")}.` });

  const style = STYLE_REASON[tags.learningStyle];
  if (style) reasons.push({ kind: "pro", text: style });
  else if (tags.learningStyle === "presentation") {
    reasons.push({ kind: "info", text: "Presentation: usually recorded, so lower priority in person." });
  }
  if (session.isCustomerStory) reasons.push({ kind: "pro", text: "Customer story: real decisions and trade-offs." });
  if (session.isSponsored) reasons.push({ kind: "info", text: "Sponsored session presented by a partner." });
  if (session.mayRepeat) reasons.push({ kind: "info", text: "Code ends in -R: AWS plans a repeat." });
  return reasons;
}
