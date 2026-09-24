import type { Format, Level, NormalizedSession } from "../catalog/normalize.js";
import {
  proficiencyOf,
  weightsOf,
  type Bucket,
  type Interest,
  type Profile,
  type Weights,
} from "../profile/profile.js";
import { aliasesOf, aliasMatches, normalizeText, textContains } from "./labels.js";
import { TOPIC_NEIGHBORS } from "./topicGraph.js";

export const CATEGORIES = ["deep-dive", "growth", "foundation", "discovery", "skip"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Reason {
  kind: "pro" | "con" | "info";
  text: string;
}

export type HitVia = "tag" | "title" | "abstract";

export interface Hit {
  interest: Interest;
  via: HitVia;
  /** The catalog tag or keyword that matched. */
  matched: string;
  strength: number;
  /** Session level minus the attendee's proficiency; null when the session has no level. */
  stretch: number | null;
  /** Set when the hit comes from a concept adjacent to the interest rather than the interest itself. */
  neighbor?: string;
}

export interface MatchComponents {
  goalAlignment: number;
  levelFit: number;
  irreplaceability: number;
  formatPreference: number;
  archDepth: number;
}

export interface MatchResult {
  session: NormalizedSession;
  category: Category;
  /** 0-100, used to rank sessions inside a category. */
  score: number;
  components: MatchComponents;
  reasons: Reason[];
  hits: Hit[];
  /** True when the session shares nothing with the profile; hidden by default. */
  unrelated: boolean;
}

const STRENGTH: Record<HitVia, number> = { tag: 1, title: 0.8, abstract: 0.5 };
/** A profile alias found inside a longer tag ("architecture" in "Event-Driven Architecture") is weaker than an exact tag. */
const PARTIAL_TAG_STRENGTH = 0.9;
const SPONSORED_FACTOR = 0.85;
const NEIGHBOR_FACTOR = 0.7;

export const LEVEL_NAMES = ["100", "200", "300", "400"] as const;
const PROFICIENCY_NAMES = ["none", "basic", "practical", "advanced"] as const;
const BUCKET_NAMES: Record<Bucket, string> = {
  know: "you know it",
  grow: "you want to grow it",
  explore: "you want to explore it",
  ignore: "you marked it not relevant",
};

/** How hard it is to get the same value outside the event, by format. */
const IRREPLACEABILITY: Record<Format, number> = {
  "builders-session": 1,
  workshop: 1,
  "chalk-talk": 0.95,
  gamified: 0.9,
  lab: 0.7,
  "code-talk": 0.8,
  "dev-chat": 0.8,
  panel: 0.4,
  "lightning-talk": 0.3,
  breakout: 0.3,
  keynote: 0.2,
  "exam-prep": 0.3,
  break: 0,
  other: 0.5,
};

const FORMAT_NAMES: Record<Format, string> = {
  "builders-session": "Builders' session",
  workshop: "Workshop",
  "chalk-talk": "Chalk talk",
  gamified: "Gamified session",
  lab: "Lab",
  "code-talk": "Code talk",
  "dev-chat": "Dev chat",
  panel: "Panel",
  "lightning-talk": "Lightning talk",
  breakout: "Breakout",
  keynote: "Keynote",
  "exam-prep": "Exam prep",
  break: "Break",
  other: "Session",
};

interface PreparedInterest {
  interest: Interest;
  aliases: string[];
  keywords: string[];
  neighbors: string[];
}

interface PreparedSession {
  session: NormalizedSession;
  tagAliases: { tag: string; aliases: string[] }[];
  title: string;
  abstract: string;
}

export function matchSessions(sessions: NormalizedSession[], profile: Profile): MatchResult[] {
  const interests = profile.interests.map(prepareInterest);
  const weights = weightsOf(profile);
  return sessions
    .filter((s) => s.format !== "break")
    .map((s) => matchOne(prepareSession(s), interests, profile, weights))
    .sort(compareResults);
}

export function matchSession(session: NormalizedSession, profile: Profile): MatchResult {
  return matchOne(prepareSession(session), profile.interests.map(prepareInterest), profile, weightsOf(profile));
}

function compareResults(a: MatchResult, b: MatchResult): number {
  const byCategory = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  return byCategory !== 0 ? byCategory : b.score - a.score;
}

function prepareInterest(interest: Interest): PreparedInterest {
  const aliases = aliasesOf(interest.name);
  const neighbors =
    interest.bucket === "know" || interest.bucket === "grow"
      ? [...new Set(aliases.flatMap((a) => TOPIC_NEIGHBORS[a] ?? []))]
      : [];
  return {
    interest,
    aliases,
    keywords: [...new Set([...aliases, ...(interest.keywords ?? []).map(normalizeText)])],
    neighbors,
  };
}

function prepareSession(session: NormalizedSession): PreparedSession {
  return {
    session,
    tagAliases: session.tags.map((tag) => ({ tag, aliases: aliasesOf(tag) })),
    title: normalizeText(session.title),
    abstract: normalizeText(session.abstract),
  };
}

function findHit(
  s: PreparedSession,
  interest: Interest,
  aliases: string[],
  keywords: string[],
): Omit<Hit, "stretch"> | null {
  let partialTag: string | undefined;
  for (const { tag, aliases: tagAliases } of s.tagAliases) {
    if (aliases.some((a) => tagAliases.includes(a))) {
      return { interest, via: "tag", matched: tag, strength: STRENGTH.tag };
    }
    if (!partialTag && aliases.some((a) => tagAliases.some((t) => aliasMatches(a, t)))) partialTag = tag;
  }
  if (partialTag) return { interest, via: "tag", matched: partialTag, strength: PARTIAL_TAG_STRENGTH };
  const inTitle = keywords.find((k) => textContains(s.title, k));
  if (inTitle) return { interest, via: "title", matched: inTitle, strength: STRENGTH.title };
  const inAbstract = keywords.find((k) => textContains(s.abstract, k));
  if (inAbstract) return { interest, via: "abstract", matched: inAbstract, strength: STRENGTH.abstract };
  return null;
}

function stretchOf(level: Level | null, interest: Interest): number | null {
  return level === null ? null : level - proficiencyOf(interest);
}

function matchOne(
  s: PreparedSession,
  interests: PreparedInterest[],
  profile: Profile,
  weights: Weights,
): MatchResult {
  const { session } = s;
  const direct: Hit[] = [];
  for (const p of interests) {
    const hit = findHit(s, p.interest, p.aliases, p.keywords);
    if (hit) direct.push({ ...hit, stretch: stretchOf(session.level, p.interest) });
  }
  direct.sort((a, b) => b.strength - a.strength);

  const ignored = direct.filter((h) => h.interest.bucket === "ignore");
  const relevant = direct.filter((h) => h.interest.bucket !== "ignore");

  const skip = (text: string, hits: Hit[] = direct, unrelated = false): MatchResult =>
    finalize(s, profile, weights, "skip", hits[0] ?? null, hits, [{ kind: "con", text }], unrelated);

  if (session.restrictedTo.length > 0) {
    return skip(`Restricted to ${session.restrictedTo.join(", ")} participants.`);
  }
  if (session.format === "keynote") {
    return skip("Keynote: plan keynotes separately; they are not matched against your profile.");
  }
  const topIgnored = ignored[0];
  if (topIgnored && topIgnored.strength >= (relevant[0]?.strength ?? 0)) {
    return skip(`About "${topIgnored.interest.name}", which ${BUCKET_NAMES.ignore}.`);
  }

  if (relevant.length === 0) {
    const neighborHits = findNeighborHits(s, interests);
    if (neighborHits.length === 0) return skip("No overlap with your profile.", [], true);
    return finalize(s, profile, weights, "discovery", neighborHits[0]!, neighborHits, [], false);
  }

  // A passing mention in an abstract is not enough evidence to call a session Deep Dive or Growth.
  const topStrength = relevant[0]!.strength;
  if (topStrength < STRENGTH.title) {
    return finalize(s, profile, weights, "discovery", relevant[0]!, relevant, [], false);
  }
  const primary = relevant.filter((h) => h.strength >= STRENGTH.title);
  const level = session.level;
  const of = (bucket: Bucket) => primary.filter((h) => h.interest.bucket === bucket);
  const pick = (hits: Hit[], test: (h: Hit) => boolean) => hits.find(test);

  const decisions: [Category, Hit | undefined][] = [
    ["deep-dive", pick(of("know"), (h) => h.stretch !== null && h.stretch >= 0 && (level! >= 2 || h.stretch >= 1))],
    [
      "foundation",
      pick([...of("explore"), ...of("grow")], (h) => level !== null && level <= 1 && h.stretch! >= 0),
    ],
    ["growth", pick(of("grow"), (h) => h.stretch === null || h.stretch >= 0)],
    ["discovery", pick(of("explore"), (h) => h.stretch === null || h.stretch >= 0)],
  ];
  const decided = decisions.find(([, hit]) => hit !== undefined);
  if (decided) {
    return finalize(s, profile, weights, decided[0], decided[1]!, relevant, [], false);
  }

  const reference = primary[0]!;
  return finalize(
    s,
    profile,
    weights,
    "skip",
    reference,
    relevant,
    [
      {
        kind: "con",
        text: `Level ${levelName(level)} is below your proficiency in "${reference.interest.name}" (${proficiencyName(reference.interest)}).`,
      },
    ],
    false,
  );
}

function findNeighborHits(s: PreparedSession, interests: PreparedInterest[]): Hit[] {
  const hits: Hit[] = [];
  for (const p of interests) {
    for (const neighbor of p.neighbors) {
      const hit = findHit(s, p.interest, [neighbor], [neighbor]);
      if (hit) {
        hits.push({ ...hit, strength: hit.strength * NEIGHBOR_FACTOR, stretch: null, neighbor });
        break;
      }
    }
  }
  return hits.sort((a, b) => b.strength - a.strength);
}

function finalize(
  s: PreparedSession,
  profile: Profile,
  weights: Weights,
  category: Category,
  deciding: Hit | null,
  hits: Hit[],
  leadingReasons: Reason[],
  unrelated: boolean,
): MatchResult {
  const { session } = s;
  const components: MatchComponents = {
    goalAlignment: goalAlignment(session, profile, deciding),
    levelFit: levelFit(session, deciding),
    irreplaceability: irreplaceability(session),
    formatPreference: profile.formatPreferences[session.format] ?? 0.5,
    archDepth: session.archDepth / 3,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const weighted = (Object.keys(components) as (keyof MatchComponents)[]).reduce(
    (sum, key) => sum + components[key] * weights[key],
    0,
  );
  const sponsorFactor = session.isSponsored ? SPONSORED_FACTOR : 1;
  const score = unrelated ? 0 : Math.round((100 * weighted * sponsorFactor) / totalWeight);

  return {
    session,
    category,
    score,
    components,
    reasons: [...leadingReasons, ...explain(session, profile, category, deciding, hits)],
    hits,
    unrelated,
  };
}

function goalAlignment(session: NormalizedSession, profile: Profile, hit: Hit | null): number {
  if (!hit) return 0;
  const base = hit.neighbor ? 0.6 : { know: 0.6, grow: 1, explore: 0.8, ignore: 0 }[hit.interest.bucket];
  let value = base * (0.5 + 0.5 * Math.min(hit.strength, 1));
  const goals = new Set(profile.goals);
  if (goals.has("architecture-role") && session.archDepth >= 2) value += 0.2;
  if (goals.has("hands-on") && session.handsOn) value += 0.2;
  if (goals.has("learn-new") && (hit.interest.bucket === "explore" || hit.neighbor)) value += 0.1;
  if (goals.has("deepen-known") && hit.interest.bucket === "know" && !hit.neighbor) value += 0.1;
  if (goals.has("networking") && session.discussion) value += 0.1;
  return Math.min(value, 1);
}

function levelFit(session: NormalizedSession, hit: Hit | null): number {
  const stretch = hit?.stretch ?? null;
  if (stretch === null) return session.level === 3 ? 0.3 : 0.5;
  if (stretch <= -1) return 0;
  if (stretch === 0) return session.level !== null && session.level >= 2 ? 0.7 : 0.4;
  if (stretch === 1) return 1;
  if (stretch === 2) return 0.4;
  return 0.2;
}

function irreplaceability(session: NormalizedSession): number {
  const base = IRREPLACEABILITY[session.format];
  const bump = session.discussion || session.handsOn ? 0.2 : 0;
  return Math.min(base + (base < 0.8 ? bump : 0), 1);
}

function explain(
  session: NormalizedSession,
  profile: Profile,
  category: Category,
  deciding: Hit | null,
  hits: Hit[],
): Reason[] {
  const reasons: Reason[] = [];
  const goals = new Set(profile.goals);

  if (deciding) {
    if (deciding.neighbor) {
      reasons.push({
        kind: "pro",
        text: `You did not ask for "${deciding.neighbor}", but it builds on "${deciding.interest.name}" (${BUCKET_NAMES[deciding.interest.bucket]}).`,
      });
    } else if (category !== "skip") {
      reasons.push({
        kind: "pro",
        text: `About "${deciding.interest.name}" (${BUCKET_NAMES[deciding.interest.bucket]}), ${describeVia(deciding)}.`,
      });
    }
    if (category !== "skip") reasons.push(...levelReasons(session, deciding));
    if (deciding.via === "abstract") {
      reasons.push({
        kind: "info",
        text: `Only mentioned in the abstract; check the session really covers "${deciding.matched}".`,
      });
    }
  }

  const others = hits.filter((h) => h !== deciding && h.interest.bucket !== "ignore").map((h) => h.interest.name);
  if (others.length > 0) reasons.push({ kind: "info", text: `Also touches: ${[...new Set(others)].join(", ")}.` });

  const irr = irreplaceability(session);
  const formatName = FORMAT_NAMES[session.format];
  if (irr >= 0.8) {
    reasons.push({ kind: "pro", text: `${formatName}: interactive and hard to get outside the event.` });
  } else if (irr <= 0.3 && session.format !== "keynote") {
    reasons.push({ kind: "info", text: `${formatName}: usually recorded and published later; lower in-person priority.` });
  }
  if (session.archDepth >= 2 && goals.has("architecture-role")) {
    reasons.push({
      kind: "pro",
      text: `Discusses design trade-offs (architecture depth ${session.archDepth}/3), aligned with your architecture goal.`,
    });
  }
  if (session.isSponsored) reasons.push({ kind: "info", text: "Sponsored session: presented by a partner." });
  if (session.isCustomerStory) reasons.push({ kind: "pro", text: "Customer story: real decisions and trade-offs." });
  if (session.handsOn && goals.has("hands-on")) reasons.push({ kind: "pro", text: "Hands-on, matching your goal." });
  if (session.seatAvailability === "unavailable") reasons.push({ kind: "con", text: "No seats left to reserve." });
  if (session.seatAvailability === "veryLimited") reasons.push({ kind: "info", text: "Very few seats left." });
  return reasons;
}

function levelReasons(session: NormalizedSession, hit: Hit): Reason[] {
  const { stretch } = hit;
  const level = levelName(session.level);
  const name = hit.interest.name;
  if (stretch === null) {
    return session.level === null
      ? [{ kind: "info", text: "No level published for this session." }]
      : session.level === 3
        ? [{ kind: "con", text: `Level ${level} on a topic you have not marked; it may assume deep background.` }]
        : [];
  }
  const proficiency = proficiencyName(hit.interest);
  if (stretch === 1) return [{ kind: "pro", text: `Level ${level} is one step above your proficiency in "${name}" (${proficiency}).` }];
  if (stretch === 0) {
    return [{ kind: "info", text: `Level ${level} matches your proficiency in "${name}" (${proficiency}); expect depth, not new ground.` }];
  }
  if (stretch >= 2) {
    return [
      {
        kind: "con",
        text: `Level ${level} is well above your proficiency in "${name}" (${proficiency}); consider a Foundation session first.`,
      },
    ];
  }
  return [];
}

function describeVia(hit: Hit): string {
  if (hit.via === "tag") return `tagged "${hit.matched}"`;
  return `"${hit.matched}" appears in the ${hit.via}`;
}

function levelName(level: Level | null): string {
  return level === null ? "n/a" : LEVEL_NAMES[level];
}

function proficiencyName(interest: Interest): string {
  return PROFICIENCY_NAMES[proficiencyOf(interest)] ?? String(proficiencyOf(interest));
}
