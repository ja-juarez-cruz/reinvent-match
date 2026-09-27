import type { NormalizedSession } from "../catalog/normalize.js";
import type { Reason } from "../match/engine.js";
import { aliasesOf, normalizeText, textContains } from "../match/labels.js";
import { tagSession, technologyLabel, textAliases, type SessionTags } from "../taxonomy/tagger.js";
import { CONCEPTS, DOMAINS, DOMAIN_NEIGHBORS, EXTRA_TECHNOLOGIES, PLATFORMS } from "../taxonomy/taxonomy.js";
import { AI_PREREQUISITES, FORMAT_CHOICES, type Answers, type TopicLevel } from "./answers.js";

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

export interface PlatformEntry {
  id: string;
  label: string;
  /** Sessions built around the platform (central, not just mentioned). */
  sessionIds: string[];
}

export interface Vocabulary {
  /** Sessions in the catalog, to express counts as shares. */
  total: number;
  platforms: PlatformEntry[];
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

/** What a reason is about, so views can show only the ones they need (the swipe card keeps match, skills and ai). */
export type ReasonAbout = "match" | "level" | "related" | "skills" | "format" | "context" | "ai" | "platform" | "reservation";

export interface PlanReason extends Reason {
  about: ReasonAbout;
}

export interface PlanItem {
  intent: Intent;
  /** Distinct tags the attendee knows or wants to learn that the session touches. */
  goalHits: number;
  /** Seats must be reserved in advance; these sessions go first because seats run out. */
  reservable: boolean;
  /** The session's level suits the attendee; only these lead, reservable ones first. */
  fitsLevel: boolean;
  score: number;
  reasons: PlanReason[];
  session: PlanSession;
  /** Taxonomy keys the session contributes to a learning plan: main topic, technologies and concepts. */
  keys: string[];
  learningStyle: string;
}

export interface Plan {
  results: PlanItem[];
  hidden: { format: number; tooBasic: number; tooAdvanced: number; aiNotReady: number; ignored: number; other: number };
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

/**
 * Formats included in re:Invent reserved seating, per the re:Invent 2026 FAQ ("bootcamps, builders' sessions, chalk
 * talks, code talks, exam prep, gamified learning, select labs, and workshops"). Breakouts, lightning talks and
 * keynotes are walk-in. Used until the catalog itself flags reservable sessions, which happens when seating opens.
 */
export const RESERVED_SEATING_FORMATS = new Set([
  "bootcamp",
  "builders-session",
  "chalk-talk",
  "code-talk",
  "exam-prep",
  "gamified",
  "lab",
  "workshop",
]);

export function requiresReservation(session: NormalizedSession, catalogFlagsReservations: boolean): boolean {
  return catalogFlagsReservations ? session.isReservable : RESERVED_SEATING_FORMATS.has(session.format);
}

/** Touching this many of the attendee's tags counts as full coverage. */
const COVERAGE_TARGET = 6;
const IGNORED_MENTION_FACTOR = 0.8;
const SPONSORED_FACTOR = 0.7;
const DEEP_AI_BONUS = 0.12;
const AI_BRIDGE_BONUS = 0.25;
/** A card this far below the band's best, or touching this few of the attendee's tags, takes no weaker topic's slot. */
const WEAK_CARD_GAP = 0.12;
const WEAK_CARD_HITS = 2;
/** Seats run out: a small lift, so a reservable session wins a close call without burying better walk-ins. */
const RESERVABLE_BONUS = 0.03;

const LEVEL_INDEX: Record<string, number | null> = { "100": 0, "200": 1, "300": 2, "400+": 3, none: null };
/** Proficiency on what the attendee knows. */
const TOPIC_PROFICIENCY: Record<TopicLevel, number> = { new: 0, basic: 1, intermediate: 2, advanced: 3 };
const PROFICIENCY_NAMES = ["new to you", "Basic", "Intermediate", "Advanced"];
/** Advanced covers both 300 ("Advanced" in the catalog) and 400 ("Expert"). */
const ADVANCED = 3;
/**
 * Highest comfortable session level on a topic new to the attendee, from their strongest topic: someone advanced
 * elsewhere can start a new topic at 300; otherwise 200.
 */
function newTopicLevelFor(strongest: number): number {
  return strongest >= 2 ? 2 : 1;
}
const LEVEL_NAMES = ["100", "200", "300", "400"];

/**
 * What only the event gives: hands-on and discussions are rarely recorded. Recorded formats still score well, since
 * only formats the attendee picked reach the plan; they just come second.
 */
const IRREPLACEABILITY: Record<string, number> = {
  "hands-on": 1,
  discussion: 0.95,
  "live-coding": 0.8,
  presentation: 0.75,
  certification: 0.75,
};

/**
 * Score weights. Architecture depth (trade-offs, failure modes, scale) is what an architect comes for; for anyone
 * else it only nudges, so it cannot lift a resilience talk above their own topic.
 */
const WEIGHTS = {
  architect: { relevance: 0.3, level: 0.2, format: 0.2, depth: 0.15, coverage: 0.15 },
  other: { relevance: 0.4, level: 0.2, format: 0.2, depth: 0.05, coverage: 0.15 },
};

/**
 * When no topic is marked new, Learn offers at most this many sessions from topics two steps away, and at most
 * EXPLORE_PER_TOPIC from any one of them, so AI (a third of the catalog) cannot fill it alone.
 */
const EXPLORE_CAP = 40;
const EXPLORE_PER_TOPIC = 8;

/** Bootcamps and labs the catalog reserves for AWS Partners say so only in the abstract. */
const PARTNERS_ONLY = /\bfor AWS Partners only\b|\bPartners only\b/i;

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

/** Tags per catalog: the server keeps one normalized array per catalog download, so tagging runs once per download. */
const taggedCache = new WeakMap<NormalizedSession[], Tagged[]>();

function tagAll(sessions: NormalizedSession[]): Tagged[] {
  const cached = taggedCache.get(sessions);
  if (cached) return cached;
  const labels = new Set(sessions.flatMap((s) => s.services.map(technologyLabel)));
  const knownServices = new Map([...labels].map((label) => [label, textAliases(label)]));
  const tagged = sessions.map((session) => ({ session, tags: tagSession(session, knownServices) }));
  taggedCache.set(sessions, tagged);
  return tagged;
}

/** Topic a technology is curated under in the taxonomy (service lists and extra technologies), if any. */
function curatedDomain(tech: string): string | undefined {
  const extra = EXTRA_TECHNOLOGIES.find((t) => t.label === tech);
  if (extra) return extra.domain;
  const aliases = aliasesOf(tech);
  return DOMAINS.find((d) => (d.services ?? []).some((s) => aliasesOf(s).some((a) => aliases.includes(a))))?.id;
}

interface TechnologyDomain {
  domain: string;
  /** Mapped in the taxonomy rather than inferred from the catalog. */
  curated: boolean;
  /** Sessions tagged with the technology, and the share of them whose main topic is `domain`. */
  count: number;
  share: number;
}

/**
 * The topic each technology belongs to: the taxonomy's curated mapping first, otherwise the main topic it shows
 * up under most often in this catalog.
 */
function technologyDomainInfo(tagged: Tagged[]): Record<string, TechnologyDomain> {
  const counts = new Map<string, Map<string, number>>();
  for (const { tags } of tagged) {
    for (const tech of tags.technologies) {
      const byDomain = counts.get(tech) ?? new Map<string, number>();
      byDomain.set(tags.primaryDomain, (byDomain.get(tags.primaryDomain) ?? 0) + 1);
      counts.set(tech, byDomain);
    }
  }
  return Object.fromEntries(
    [...counts].map(([tech, byDomain]) => {
      const count = [...byDomain.values()].reduce((a, b) => a + b, 0);
      const curated = curatedDomain(tech);
      const top = [...byDomain].sort((a, b) => b[1] - a[1])[0]![0];
      const domain = curated ?? top;
      return [tech, { domain, curated: curated !== undefined, count, share: (byDomain.get(domain) ?? 0) / count }];
    }),
  );
}

function technologyDomains(tagged: Tagged[]): Record<string, string> {
  return Object.fromEntries(Object.entries(technologyDomainInfo(tagged)).map(([tech, info]) => [tech, info.domain]));
}

/** Technologies specific to a vendor platform (EVS, Mainframe Modernization…) never come with a topic. */
function isPlatformTechnology(tech: string): boolean {
  const aliases = aliasesOf(tech);
  return PLATFORMS.some((p) => (p.services ?? []).some((s) => aliasesOf(s).some((a) => aliases.includes(a))));
}

/** An inferred technology-to-topic link counts only when the technology clearly lives in that topic. */
const MIN_INFERRED_SHARE = 0.6;
const MIN_INFERRED_COUNT = 3;

const MAX_RELATED_TECHNOLOGIES = 8;
const MAX_RELATED_CONCEPTS = 4;
/** A concept belongs to a topic when it shows up this many times more often there than across the catalog. */
const CONCEPT_LIFT = 1.5;

/**
 * What picking a topic brings along: its most common technologies and the concepts that are characteristic of it.
 * Concepts use lift rather than raw counts, otherwise AI (in most sessions) would claim every concept.
 */
function topicRelations(tagged: Tagged[], techInfo: Record<string, TechnologyDomain>): TopicRelations {
  const techCount = new Map<string, number>();
  const conceptCount = new Map<string, number>();
  for (const { tags } of tagged) {
    for (const t of tags.technologies) techCount.set(t, (techCount.get(t) ?? 0) + 1);
    for (const c of tags.concepts) conceptCount.set(c, (conceptCount.get(c) ?? 0) + 1);
  }
  const relations: TopicRelations = {};
  for (const domain of DOMAINS.map((d) => d.id)) {
    const technologies = Object.entries(techInfo)
      .filter(
        ([tech, info]) =>
          info.domain === domain &&
          (techCount.get(tech) ?? 0) >= 2 &&
          !isPlatformTechnology(tech) &&
          (info.curated || (info.share >= MIN_INFERRED_SHARE && info.count >= MIN_INFERRED_COUNT)),
      )
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
  const techInfo = technologyDomainInfo(tagged);
  const techDomain = technologyDomains(tagged);
  const relations = topicRelations(tagged, techInfo);
  const tally = (keysOf: (t: SessionTags) => string[]) => {
    const counts = new Map<string, number>();
    for (const { tags } of tagged) for (const k of new Set(keysOf(tags))) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  return {
    total: tagged.length,
    platforms: PLATFORMS.map((p) => ({
      id: p.id,
      label: p.label,
      sessionIds: tagged.filter(({ tags }) => tags.platforms.includes(p.id)).map(({ session }) => session.id),
    })),
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

/**
 * @param keep sessions the attendee already picked (❤️ or 🔖): no rule hides them and no list cap drops them, so a
 *   pick never vanishes from their plan, wherever it was made.
 */
export function buildPlan(sessions: NormalizedSession[], answers: Answers, keep: ReadonlySet<string> = new Set()): Plan {
  const tagged = tagAll(sessions);
  const techDomain = technologyDomains(tagged);
  const relations = topicRelations(tagged, technologyDomainInfo(tagged));
  const ignored = new Set(answers.ignore);
  // Every picked topic is a goal: with a level it is one to go deeper on, "new" means learn it. Each topic brings its
  // technologies and characteristic concepts along, at the topic's level.
  const knownTopics = answers.topics.filter((t) => t.level !== "new");
  const newTopics = answers.topics.filter((t) => t.level === "new").map((t) => t.key);
  const keyProficiency = new Map<string, number>();
  /** The picked topics that bring each key along, so a card can say "part of Architecture" instead of "you know". */
  const keySources = new Map<string, string[]>();
  for (const topic of answers.topics) {
    for (const key of expandTopics([topic.key], relations)) {
      keySources.set(key, [...(keySources.get(key) ?? []), topic.key]);
      if (topic.level !== "new") {
        keyProficiency.set(key, Math.max(keyProficiency.get(key) ?? 0, TOPIC_PROFICIENCY[topic.level]));
      }
    }
  }
  const topicProficiency = new Map(knownTopics.map((t) => [splitKey(t.key)[1], TOPIC_PROFICIENCY[t.level]] as const));
  // A technology counts at the level of the topic it belongs to, not the highest topic that happens to mention it.
  const proficiencyOf = (key: string): number => {
    const [kind, id] = splitKey(key);
    const owner = kind === "tech" ? techDomain[id] : undefined;
    return (owner !== undefined ? topicProficiency.get(owner) : undefined) ?? keyProficiency.get(key) ?? strongest;
  };
  /**
   * The picked topic a key comes from on a given session: the key itself when it is a picked topic, else the
   * session's own main topic when that brought it, else the topic a technology belongs to, else the first one.
   */
  const sourceOf = (key: string, primaryDomain: string, sessionDomains: string[] = [primaryDomain]): string | undefined => {
    const [kind, id] = splitKey(key);
    const sources = keySources.get(key);
    // A technology no topic brought along still belongs to the picked topic it is filed under.
    if (!sources) return kind === "tech" && topicProficiency.has(techDomain[id] ?? "") ? `domain:${techDomain[id]}` : undefined;
    const inSession = sources.filter((t) => sessionDomains.includes(splitKey(t)[1]));
    return (
      sources.find((t) => t === key) ??
      sources.find((t) => t === `domain:${primaryDomain}`) ??
      (kind === "tech" ? sources.find((t) => t === `domain:${techDomain[id]}`) : undefined) ??
      inSession[0] ??
      // A practice ("Scale & performance") is only credited to a topic the session is about.
      (kind === "tech" ? sources[0] : undefined)
    );
  };
  const knownKeys = [...keyProficiency.keys()];
  const learnKeys = expandTopics(newTopics, relations).filter((k) => !keyProficiency.has(k));
  const known = new Set(knownKeys);
  const learn = new Set(learnKeys);
  const knownDomains = domainsOfKeys(knownTopics.map((t) => t.key), techDomain);
  const learnDomains = domainsOfKeys(newTopics, techDomain);
  const neighborDomains = new Set(
    [...knownDomains].flatMap((d) => DOMAIN_NEIGHBORS[d] ?? []).filter((d) => !knownDomains.has(d)),
  );
  // Topics next to what the attendee wants to learn are learning too: someone new to compute can start with an
  // entry-level containers or serverless session.
  const learnNeighbors = new Set(
    [...learnDomains]
      .flatMap((d) => DOMAIN_NEIGHBORS[d] ?? [])
      .filter((d) => !knownDomains.has(d) && !neighborDomains.has(d) && !learnDomains.has(d)),
  );
  // With nothing marked new, Learn is a short list of topics two steps from what they know, not everything else.
  const exploreDomains = new Set(
    learn.size > 0
      ? []
      : [...neighborDomains].flatMap((d) => DOMAIN_NEIGHBORS[d] ?? []).filter((d) => !knownDomains.has(d) && !neighborDomains.has(d)),
  );
  const architect = answers.topics.some((t) => t.key === "domain:architecture" && t.level !== "new");
  const weights = architect ? WEIGHTS.architect : WEIGHTS.other;
  const aiTopic = answers.topics.find((t) => t.key === "domain:ai");
  // Unanswered AI questions read as "not yet" unless AI is a topic the attendee knows well.
  const aiUnansweredAsZero = !aiTopic || aiTopic.level === "new" || aiTopic.level === "basic";
  const allowedFormats = new Set(
    FORMAT_CHOICES.filter((c) => answers.formats.includes(c.id)).flatMap((c) => c.formats),
  );
  const strongest = Math.max(0, ...knownTopics.map((t) => TOPIC_PROFICIENCY[t.level]));
  const newTopicLevel = newTopicLevelFor(strongest);

  const hidden = { format: 0, tooBasic: 0, tooAdvanced: 0, aiNotReady: 0, ignored: 0, other: 0 };
  const exploring = new Set<string>();
  /** Scores before the 100% cap, so bonuses still separate sessions that max out. */
  const rankScore = new Map<string, number>();
  const rank = (r: PlanItem) => rankScore.get(r.session.id) ?? r.score / 100;
  // The attendee's strongest topics, recognized in a title by their keywords.
  const strongestDomains = DOMAINS.filter((d) => topicProficiency.get(d.id) === strongest && strongest > 0);
  const strongestTopicInTitle = (normalizedTitle: string) =>
    strongestDomains.some((d) => (d.titleKeywords ?? []).some((k) => textContains(normalizedTitle, k)));
  const deepAiPersona =
    aiTopic?.level === "advanced" && ((answers.ai.training ?? 0) >= 2 || (answers.ai.infra ?? 0) >= 2);
  /** The picked topic each Reinforce session goes deeper on, to share the first cards among topics. */
  const reinforceTopic = new Map<string, string>();
  // Before reserved seating opens every session reads isReservable=false; the format rule applies until then.
  const catalogFlagsReservations = sessions.some((s) => s.isReservable);
  const labels: Record<string, string> = {};
  const results: PlanItem[] = [];

  for (const { session, tags } of tagged) {
    // A session the attendee already picked (❤️ or 🔖, here or in the re:Invent portal) is never hidden by the rules
    // below: their choice outranks the plan's guess.
    const pinned = keep.has(session.id);
    if (
      !pinned &&
      (session.format === "break" ||
        session.format === "keynote" ||
        session.restrictedTo.length > 0 ||
        PARTNERS_ONLY.test(session.abstract))
    ) {
      hidden.other += 1;
      continue;
    }
    if (!pinned && !allowedFormats.has(session.format)) {
      hidden.format += 1;
      continue;
    }
    if (!pinned && tags.platforms.some((p) => ignored.has(p))) {
      hidden.ignored += 1;
      continue;
    }
    const ignoredMentions = tags.platformMentions.filter((p) => ignored.has(p));

    const keys = [
      ...tags.domains.map((d) => `domain:${d}`),
      ...tags.technologies.map((t) => `tech:${t}`),
      ...tags.concepts.map((c) => `concept:${c}`),
    ];
    const knownHits = keys
      .filter((k) => known.has(k))
      .sort(
        (a, b) =>
          hitStrength(b, tags.primaryDomain) - hitStrength(a, tags.primaryDomain) || proficiencyOf(b) - proficiencyOf(a),
      );
    const learnHits = keys.filter((k) => learn.has(k)).sort((a, b) => hitStrength(b, tags.primaryDomain) - hitStrength(a, tags.primaryDomain));
    const level = LEVEL_INDEX[tags.level] ?? null;
    // A technology named in the title is what the session is about, even when its track files it under another topic:
    // "GitOps on Amazon EKS" in the open-source track is a containers session. Among the track's topic and those
    // technologies, the one the attendee knows least decides the level.
    const title = normalizeText(session.title);
    const trackProficiency = topicProficiency.get(tags.primaryDomain) ?? -1;
    const titleHit = keys
      .filter((k) => {
        const [kind, id] = splitKey(k);
        const owner = techDomain[id];
        return (
          kind === "tech" &&
          owner !== undefined &&
          owner !== tags.primaryDomain &&
          topicProficiency.has(owner) &&
          aliasesOf(id).some((a) => textContains(title, a))
        );
      })
      .sort((a, b) => proficiencyOf(a) - proficiencyOf(b))
      .find((k) => proficiencyOf(k) < trackProficiency);
    const coreKnownHit = titleHit ?? knownHits.find((k) => hitStrength(k, tags.primaryDomain) >= 0.7);
    const mainIsKnown = knownDomains.has(tags.primaryDomain);
    const mainIsNeighbor = neighborDomains.has(tags.primaryDomain);
    // Level is judged against the attendee's level in the topic the session is about.
    const proficiency = coreKnownHit ? proficiencyOf(coreKnownHit) : strongest;
    // Whether the session can lead its tab is judged against the strongest picked topic it is about: inference on EKS
    // is at level for an Advanced AI engineer even when the score judges it against Basic containers.
    const bestProficiency = Math.max(
      proficiency,
      ...knownHits.filter((k) => hitStrength(k, tags.primaryDomain) >= 0.7).map(proficiencyOf),
    );

    // A learning goal puts a session in Learn only when the session is about it: a topic it is filed under, or a
    // technology its title names. "Covers MCP" off one phrase in the abstract is not a learning session.
    const learnFocus = learnHits.filter((k) => {
      const [kind, id] = splitKey(k);
      return kind === "domain" || (kind === "tech" && aliasesOf(id).some((a) => textContains(title, a)));
    });
    // Reinforce wins when the session is squarely about what the attendee knows; anything they want to learn in it
    // shows up as a reason. Otherwise an explicit learning goal beats broadening.
    let intent: Intent;
    let deciding: string | undefined;
    if (coreKnownHit && mainIsKnown) {
      if (!pinned && level !== null && level - proficiency < -1) {
        hidden.tooBasic += 1;
        continue;
      }
      intent = "reinforce";
      deciding = coreKnownHit;
    } else if (learnFocus.length > 0) {
      intent = "learn";
      deciding = learnFocus[0];
    } else if (knownHits.length > 0 || mainIsKnown || mainIsNeighbor) {
      intent = "broaden";
      deciding = knownHits[0];
    } else if (learnDomains.has(tags.primaryDomain) || learnNeighbors.has(tags.primaryDomain)) {
      intent = "learn";
    } else if (exploreDomains.has(tags.primaryDomain)) {
      intent = "learn";
      exploring.add(session.id);
    } else if (pinned) {
      intent = "broaden";
    } else {
      hidden.other += 1;
      continue;
    }
    // Two or more levels above where the attendee stands is left out: a 400 for someone new to AWS, or for someone
    // Basic in every topic the session touches.
    if (
      !pinned &&
      level !== null &&
      (intent === "reinforce" ? level - bestProficiency >= 2 : level - newTopicLevel >= 2)
    ) {
      hidden.tooAdvanced += 1;
      continue;
    }

    // AI-first sessions the attendee is not ready for are hidden; sessions that only touch AI are just ranked lower.
    // AI is the subject when it is the main topic, or when the title is about it and the main topic is not one the
    // attendee knows: an agent lab filed under Learning is an AI session, agent identity for a security expert is not.
    const aiFirst =
      tags.primaryDomain === "ai" || (!mainIsKnown && tags.aiSubtopics.length > 0 && AI_IN_TITLE.test(session.title));
    const readiness = aiReadiness(tags, answers.ai, { aiFirst, unansweredAsZero: aiUnansweredAsZero });
    // Hiding needs an explicit answer: questions left blank only lower the score.
    if (!pinned && readiness && aiFirst && readiness.answeredFit < AI_HIDE_BELOW) {
      hidden.aiNotReady += 1;
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
    // How many of the attendee's tags (known and to learn) the session touches; separates sessions that max out
    // every other component.
    const goalHits = new Set([...knownHits, ...learnHits]).size;
    const deepAi =
      deepAiPersona &&
      tags.aiSubtopics.some((t) => t === "ml-training" || t === "ai-infra") &&
      (tags.learningStyle === "hands-on" || (level !== null && level >= 3));
    // A deep AI session names few of the attendee's tags (a training workshop is "just" SageMaker), which says
    // nothing about how much it serves them.
    const coverage = Math.max(deepAi ? 0.5 : 0, Math.min(1, goalHits / COVERAGE_TARGET));
    let score =
      weights.relevance * relevance +
      weights.level * levelFit +
      weights.format * irreplaceability +
      weights.depth * depth +
      weights.coverage * coverage;
    if (session.isCustomerStory) score += 0.02;
    // Someone who trains and serves models wants the deep ones: training or inference, hands-on or 400+.
    if (deepAi) score += DEEP_AI_BONUS;
    // Learning AI from a strong topic: an AI session about that topic ("Secure AI the way you secure everything
    // else") is the bridge, and should lead Learn over sessions that only mention AI.
    if (intent === "learn" && aiTopic?.level === "new" && AI_IN_TITLE.test(session.title) && strongestTopicInTitle(title)) {
      score += AI_BRIDGE_BONUS;
    }
    // Sponsored sessions are partners pitching; they never lead and weigh less.
    if (session.isSponsored) score *= SPONSORED_FACTOR;
    if (ignoredMentions.length > 0) score *= IGNORED_MENTION_FACTOR;
    // AI background lowers AI sessions that assume more than the attendee has (×0.55–1 when AI is the subject,
    // ×0.8–1 when it is a side topic), so the usable ones lead.
    if (readiness) score *= aiFirst ? 0.55 + 0.45 * readiness.fit : 0.8 + 0.2 * readiness.fit;

    // Secondary topics are noisy (AI is everywhere), so only those the attendee picked count toward the plan.
    const planKeys = [
      `domain:${tags.primaryDomain}`,
      ...tags.domains.map((d) => `domain:${d}`).filter((k) => known.has(k) || learn.has(k)),
      ...tags.technologies.map((t) => `tech:${t}`),
      ...tags.concepts.map((c) => `concept:${c}`),
    ];
    for (const key of new Set([...keys, ...planKeys])) labels[key] ??= labelOfKey(key);

    const reservable = requiresReservation(session, catalogFlagsReservations);
    if (reservable) score += RESERVABLE_BONUS;
    rankScore.set(session.id, score);
    if (intent === "reinforce" && deciding) {
      reinforceTopic.set(session.id, sourceOf(deciding, tags.primaryDomain, tags.domains) ?? `domain:${tags.primaryDomain}`);
    }
    results.push({
      intent,
      reservable,
      fitsLevel:
        !session.isSponsored &&
        (levelFit >= LEVEL_FIT_BAND ||
          fitLevel(intent, level, bestProficiency, newTopicLevel) >= LEVEL_FIT_BAND ||
          // On a Basic topic the step up (300) is where the best sessions are; it may lead too.
          (intent === "reinforce" && bestProficiency === 1 && level === 2)),
      goalHits,
      score: Math.round(Math.min(1, score) * 100),
      reasons: [
        ...explain({
          intent,
          deciding,
          knownHits,
          learnHits,
          tags,
          level,
          proficiency,
          newTopicLevel,
          session,
          mainIsKnown,
          sourceOf: (key) => sourceOf(key, tags.primaryDomain, tags.domains),
        }),
        ...aiReasons(readiness),
        ...ignoredMentions.map((p) => ({
          about: "platform" as const,
          kind: "con" as const,
          text: `Mentions ${PLATFORMS.find((pl) => pl.id === p)?.label ?? p}, which you marked as not relevant.`,
        })),
        reservable
          ? {
              about: "reservation" as const,
              kind: "pro" as const,
              text:
                session.format === "lab" && !catalogFlagsReservations
                  ? "Likely needs a reserved seat (some labs do): plan it early."
                  : "Needs a reserved seat and seats run out: plan it early.",
            }
          : { about: "reservation" as const, kind: "info" as const, text: "No reservation needed: walk in." },
      ],
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

  // Within each intent, sessions at the attendee's level come first, by score (a reserved seat adds a little: see
  // RESERVABLE_BONUS). A session at the wrong level never jumps ahead of a right-level one.
  results.sort(
    (a, b) =>
      INTENTS.indexOf(a.intent) - INTENTS.indexOf(b.intent) ||
      Number(b.fitsLevel) - Number(a.fitsLevel) ||
      rank(b) - rank(a) ||
      b.goalHits - a.goalHits,
  );
  // Reinforce deals its right-level cards topic by topic, so the sessions that touch many topics at once (resilience,
  // operations) cannot crowd out the attendee's own topics. Stronger topics get more cards per round (Advanced 3,
  // Intermediate 2, Basic 1) and deal first. A repeat of a session already dealt, or a weak card in a weaker topic,
  // takes no slot: it follows the dealt cards.
  const TOPIC_WEIGHT: Record<string, number> = { advanced: 3, intermediate: 2, basic: 1 };
  const weightOf = (topic: string) => TOPIC_WEIGHT[answers.topics.find((t) => t.key === topic)?.level ?? ""] ?? 1;
  const band = results.filter((r) => r.intent === "reinforce" && r.fitsLevel);
  if (band.length > 0) {
    const start = results.indexOf(band[0]!);
    const topicOf = (r: PlanItem) => reinforceTopic.get(r.session.id) ?? "";
    const bandBest = rank(band[0]!);
    const strongestWeight = Math.max(...band.map((r) => weightOf(topicOf(r))));
    // The strongest topics always deal their cards. A weaker topic's slot is not filled with a card far below the
    // band's best, or with one that touches only a couple of the attendee's tags (an Oracle session in Databases).
    const weak = (r: PlanItem) =>
      weightOf(topicOf(r)) < strongestWeight && (rank(r) < bandBest - WEAK_CARD_GAP || r.goalHits <= WEAK_CARD_HITS);
    const seen = new Set<string>();
    const dealt: PlanItem[] = [];
    const held: PlanItem[] = [];
    for (const r of band) {
      const base = r.session.code.replace(/-R\d*$/, "");
      (seen.has(base) || weak(r) ? held : dealt).push(r);
      seen.add(base);
    }
    results.splice(
      start,
      band.length,
      ...interleave(dealt, topicOf, weightOf),
      ...held,
    );
  }
  // Exploring beyond the neighbors stays short and varied.
  const perTopic = new Map<string, number>();
  let explored = 0;
  const dropped = new Set<PlanItem>();
  for (const r of results) {
    if (!exploring.has(r.session.id)) continue;
    const topic = r.keys[0] ?? "";
    const n = perTopic.get(topic) ?? 0;
    if (keep.has(r.session.id)) continue;
    if (explored >= EXPLORE_CAP || n >= EXPLORE_PER_TOPIC) dropped.add(r);
    else {
      perTopic.set(topic, n + 1);
      explored += 1;
    }
  }
  hidden.other += dropped.size;
  const kept = results.filter((r) => !dropped.has(r));
  for (const key of [...knownKeys, ...learnKeys]) labels[key] ??= labelOfKey(key);

  return {
    results: kept,
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

/**
 * Round robin over groups, heaviest first (ties in the order their best item comes), taking `weight` items from each
 * group per round and keeping each group's own order.
 */
export function interleave<T>(items: T[], groupOf: (item: T) => string, weightOf: (group: string) => number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(groupOf(item), [...(groups.get(groupOf(item)) ?? []), item]);
  const ordered = [...groups].sort(([a], [b]) => weightOf(b) - weightOf(a));
  const out: T[] = [];
  while (out.length < items.length) {
    for (const [group, queue] of ordered) out.push(...queue.splice(0, weightOf(group)));
  }
  return out;
}

/** Familiarity an AI session expects of its prerequisites, by level (100 → none … 400 → comfortable). */
const AI_NEED_BY_LEVEL = [0, 0.5, 0.75, 1];
/** Titles about AI rather than merely touching it. */
const AI_IN_TITLE = /\b(AI|GenAI|generative|agents?|agentic|multi-agent|LLMs?|MCP|machine learning|ML|foundation models?|RAG)\b/i;
/** Below this fit an AI session is hidden: it assumes background the attendee does not have yet. */
const AI_HIDE_BELOW = 0.35;

export interface AiReadiness {
  /** 0-1: how well the attendee's AI background covers what the session assumes. */
  fit: number;
  /** The same, from the questions the attendee answered only (1 when none of them was answered). */
  answeredFit: number;
  covered: string[];
  missing: string[];
}

/**
 * How ready the attendee is for an AI session, from the prerequisites its AI subtopics rely on. Null when the
 * session is not about AI or the attendee skipped the AI step. When AI is only a side topic, a session asks for no
 * more than some familiarity whatever its level: its level measures the main topic.
 */
export function aiReadiness(
  tags: SessionTags,
  ai: Answers["ai"],
  { aiFirst = true, unansweredAsZero = false }: { aiFirst?: boolean; unansweredAsZero?: boolean } = {},
): AiReadiness | null {
  if (!tags.domains.includes("ai") || Object.keys(ai).length === 0) return null;
  const required = AI_PREREQUISITES.filter((p) => p.subtopics.some((s) => tags.aiSubtopics.includes(s)));
  const relevant = (required.length > 0 ? required : AI_PREREQUISITES.filter((p) => p.id === "llm")).filter(
    (p) => unansweredAsZero || ai[p.id] !== undefined,
  );
  if (relevant.length === 0) return null;
  const levelNeed = AI_NEED_BY_LEVEL[LEVEL_INDEX[tags.level] ?? 1] ?? 0.5;
  const need = aiFirst ? levelNeed : Math.min(levelNeed, 0.5);
  const covered: string[] = [];
  const missing: string[] = [];
  let total = 0;
  let answeredTotal = 0;
  let answered = 0;
  for (const p of relevant) {
    const familiarity = (ai[p.id] ?? 0) / 2;
    // A level-100 session asks for nothing; it is not "covered" by background the attendee marked as none.
    if (familiarity >= need && familiarity > 0) covered.push(p.label);
    else if (familiarity < need) missing.push(p.label);
    const fit = familiarity >= need ? 1 : Math.max(0, 1 - (need - familiarity) * 1.5);
    total += fit;
    if (ai[p.id] !== undefined) {
      answeredTotal += fit;
      answered += 1;
    }
  }
  return { fit: total / relevant.length, answeredFit: answered ? answeredTotal / answered : 1, covered, missing };
}

function aiReasons(readiness: AiReadiness | null): PlanReason[] {
  if (!readiness) return [];
  const reasons: PlanReason[] = [];
  if (readiness.covered.length > 0 && readiness.missing.length === 0) {
    reasons.push({ about: "ai", kind: "pro", text: `Your AI background covers what it assumes: ${readiness.covered.join(", ")}.` });
  } else if (readiness.covered.length > 0) {
    reasons.push({ about: "ai", kind: "info", text: `Builds on AI you know: ${readiness.covered.join(", ")}.` });
  }
  if (readiness.missing.length > 0) {
    const more = readiness.missing.length > 2 ? ` +${readiness.missing.length - 2} more` : "";
    reasons.push({ about: "ai", kind: "con", text: `Assumes more AI than you marked in: ${readiness.missing.slice(0, 2).join(", ")}${more}.` });
  }
  return reasons;
}

/** Level fit that lets a session lead its tab (see the sort in buildPlan). */
const LEVEL_FIT_BAND = 0.8;

function atLevel(level: number, proficiency: number): boolean {
  return level === proficiency || (proficiency === ADVANCED && level === ADVANCED - 1);
}

function fitLevel(intent: Intent, level: number | null, proficiency: number, newTopicLevel: number): number {
  if (level === null) return 0.5;
  if (intent === "reinforce") {
    // Basic ↔ 200, Intermediate ↔ 300, Advanced ↔ 300 and 400 (the catalog calls 300 "Advanced", 400 "Expert"): a
    // session at the attendee's level is the step above what they already know; one level higher is a stretch.
    if (atLevel(level, proficiency)) return 1;
    const stretch = level - proficiency;
    return stretch === 1 ? 0.6 : stretch === -1 ? 0.5 : 0.3;
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
  /** The picked topic that brought a key along. */
  sourceOf: (key: string) => string | undefined;
}): PlanReason[] {
  const { intent, deciding, knownHits, learnHits, tags, level, proficiency, newTopicLevel, session, mainIsKnown, sourceOf } = ctx;
  const reasons: PlanReason[] = [];
  const main = labelOfKey(`domain:${tags.primaryDomain}`);
  // The catalog's own label ("300 – Advanced", "500 – Distinguished") reads better than our 0–3 scale.
  const levelName = session.levelLabel?.replace(/\s+-\s+/, " – ") ?? (level === null ? null : LEVEL_NAMES[level]);
  // "Serverless, one of your topics" for a picked topic; "AWS Lambda, part of Serverless" for what it brought along.
  const ofYourTopics = (key: string) => {
    const source = sourceOf(key);
    if (source && source !== key) return `${labelOfKey(key)}, part of ${labelOfKey(source)}`;
    return splitKey(key)[0] === "domain" ? `${labelOfKey(key)}, one of your topics` : `${labelOfKey(key)}, a practice across your topics`;
  };

  if (intent === "reinforce" && deciding) {
    reasons.push({
      about: "match",
      kind: "pro",
      text: `Goes deeper on ${ofYourTopics(deciding)} (you are ${PROFICIENCY_NAMES[proficiency] ?? "experienced"}).`,
    });
    if (level !== null) {
      const stretch = level - proficiency;
      if (atLevel(level, proficiency)) reasons.push({ about: "level", kind: "pro", text: `Level ${levelName}: matches your level, the step above what you know.` });
      else if (stretch >= 1) reasons.push({ about: "level", kind: "con", text: `Level ${levelName}: above your level; expect to stretch.` });
      else reasons.push({ about: "level", kind: "con", text: `Level ${levelName}: below your level; worth it only for the angle it takes.` });
    }
  } else if (intent === "broaden") {
    reasons.push(
      deciding
        ? sourceOf(deciding) && sourceOf(deciding) !== deciding
          ? { about: "match", kind: "pro", text: `Applies ${labelOfKey(deciding)} (from your ${labelOfKey(sourceOf(deciding)!)} topic) to ${main}.` }
          : splitKey(deciding)[0] === "domain"
            ? { about: "match", kind: "pro", text: `Applies ${labelOfKey(deciding)}, which you know, to ${main}.` }
            : { about: "match", kind: "pro", text: `Applies ${labelOfKey(deciding)}, a practice across your topics, to ${main}.` }
        : mainIsKnown
          ? { about: "match", kind: "pro", text: `A new angle on ${main}, beyond the tools you listed.` }
          : { about: "match", kind: "pro", text: `${main} sits next to what you know; a natural way to widen your profile.` },
    );
  } else {
    reasons.push(
      deciding
        ? sourceOf(deciding) && sourceOf(deciding) !== deciding
          ? { about: "match", kind: "pro", text: `Covers ${labelOfKey(deciding)}, part of ${labelOfKey(sourceOf(deciding)!)}, which you want to learn.` }
          : { about: "match", kind: "pro", text: `Covers ${labelOfKey(deciding)}, which you want to learn.` }
        : { about: "match", kind: "info", text: `New ground for you: ${main}.` },
    );
  }
  if (intent !== "reinforce" && level !== null) {
    const gap = level - newTopicLevel;
    if (gap > 0) reasons.push({ about: "level", kind: "con", text: `Level ${levelName} on a topic that is new to you; it may assume background.` });
    else reasons.push({ about: "level", kind: "pro", text: `Level ${levelName}: a good entry point for a new topic at your experience.` });
  }

  const wanted = learnHits.filter((k) => k !== deciding).map(labelOfKey);
  if (wanted.length > 0) reasons.push({ about: "related", kind: "pro", text: `Also covers what you want to learn: ${wanted.join(", ")}.` });
  const others = knownHits.filter((k) => k !== deciding).map(labelOfKey);
  if (others.length > 0) reasons.push({ about: "related", kind: "info", text: `Also covers your topics: ${others.slice(0, 4).join(", ")}.` });

  const skills = tags.concepts.map((c) => labelOfKey(`concept:${c}`));
  if (skills.length > 0) reasons.push({ about: "skills", kind: "pro", text: `Skills: ${skills.slice(0, 4).join(", ")}.` });

  const style = STYLE_REASON[tags.learningStyle];
  if (style) reasons.push({ about: "format", kind: "pro", text: style });
  else if (tags.learningStyle === "presentation") {
    reasons.push({ about: "format", kind: "info", text: "Presentation: usually recorded, so lower priority in person." });
  }
  if (session.isCustomerStory) reasons.push({ about: "context", kind: "pro", text: "Customer story: real decisions and trade-offs." });
  if (session.isSponsored) reasons.push({ about: "context", kind: "info", text: "Sponsored session presented by a partner." });
  if (session.mayRepeat) reasons.push({ about: "context", kind: "info", text: "Code ends in -R: AWS plans a repeat." });
  return reasons;
}
