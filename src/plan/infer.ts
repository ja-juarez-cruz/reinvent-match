import type { NormalizedSession } from "../catalog/normalize.js";
import { tagSession } from "../taxonomy/tagger.js";
import { PLATFORMS } from "../taxonomy/taxonomy.js";
import { FORMAT_CHOICES, MAX_TOPICS, TOPIC_LEVELS, type Answers, type TopicLevel } from "./answers.js";

const LEVEL_INDEX: Record<string, number | undefined> = { "100": 0, "200": 1, "300": 2, "400+": 3 };

export interface InferredAnswers {
  answers: Answers;
  /** How many favorites each topic came from, to show the attendee where the draft comes from. */
  basis: { key: string; favorites: number }[];
}

/**
 * A first draft of the onboarding answers from favorites already made in the AWS Events app: the topics they are
 * about (most favorites first, up to eight), a level per topic from the levels picked there (a median 200 reads as
 * Basic, 300 Intermediate, 400 Advanced, 100 new to it), the formats they come in, and the platforms none of them is
 * built around left out. AI background is left blank: favorites do not say how much of it someone has.
 */
export function inferAnswers(favorites: NormalizedSession[]): InferredAnswers | null {
  if (favorites.length === 0) return null;
  const byTopic = new Map<string, number[]>();
  const counts = new Map<string, number>();
  const usedPlatforms = new Set<string>();
  for (const session of favorites) {
    const tags = tagSession(session);
    for (const p of tags.platforms) usedPlatforms.add(p);
    if (tags.primaryDomain === "other") continue;
    counts.set(tags.primaryDomain, (counts.get(tags.primaryDomain) ?? 0) + 1);
    const level = LEVEL_INDEX[tags.level];
    byTopic.set(tags.primaryDomain, [...(byTopic.get(tags.primaryDomain) ?? []), ...(level === undefined ? [] : [level])]);
  }
  const topics = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOPICS)
    .map(([domain]) => ({ key: `domain:${domain}`, level: levelFor(byTopic.get(domain) ?? []) }));
  if (topics.length === 0) return null;
  const formats = FORMAT_CHOICES.filter((c) => favorites.some((s) => c.formats.includes(s.format))).map((c) => c.id);
  return {
    answers: {
      topics,
      ignore: PLATFORMS.map((p) => p.id).filter((id) => !usedPlatforms.has(id)),
      ai: {},
      formats: formats.length > 0 ? formats : FORMAT_CHOICES.map((c) => c.id),
    },
    basis: [...counts].sort((a, b) => b[1] - a[1]).slice(0, MAX_TOPICS).map(([d, n]) => ({ key: `domain:${d}`, favorites: n })),
  };
}

/** The median level picked in a topic, read as the attendee's level in it (see TOPIC_LEVELS). */
function levelFor(levels: number[]): TopicLevel {
  if (levels.length === 0) return "basic";
  const sorted = [...levels].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
  return TOPIC_LEVELS[median] ?? "basic";
}
