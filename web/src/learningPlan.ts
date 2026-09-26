import { overlaps } from "./format";
import { distinctSessions } from "./repeats";
import type { Intent, PlanContext, PlanItem, SwipeLog } from "./types";

export interface PlanEntry {
  key: string;
  label: string;
  count: number;
}

export interface LearningPlan {
  sessions: number;
  hours: number;
  byIntent: Record<Intent, number>;
  handsOn: number;
  conflicts: number;
  reinforce: PlanEntry[];
  broaden: PlanEntry[];
  learn: PlanEntry[];
  skills: PlanEntry[];
}

function kindOf(key: string): string {
  return key.slice(0, key.indexOf(":"));
}

function idOf(key: string): string {
  return key.slice(key.indexOf(":") + 1);
}

/**
 * Turns the sessions an attendee picked into what they will reinforce, broaden, learn and practice. Each tag of a
 * picked session lands in exactly one group:
 * - reinforce: tags the attendee said they know, and technologies inside a topic they said they know
 * - skills: architecture and engineering concepts they did not list as known
 * - learn: what they said they want to learn, and anything new far from what they know
 * - broaden: new topics/technologies next to what they know
 */
export function buildLearningPlan(items: PlanItem[], swipes: SwipeLog, context: PlanContext): LearningPlan {
  // A session picked at two of its times is still one session.
  const picked = distinctSessions(items.filter((i) => swipes[i.session.id]?.decision === "like"));
  const known = new Set(context.known);
  const learn = new Set(context.learn);
  const knownTopics = new Set(context.known.filter((k) => kindOf(k) === "domain").map(idOf));
  const nearby = new Set([...context.knownDomains, ...context.neighborDomains]);
  const groups = { reinforce: new Map<string, number>(), broaden: new Map<string, number>(), learn: new Map<string, number>(), skills: new Map<string, number>() };

  for (const item of picked) {
    for (const key of item.keys) {
      const kind = kindOf(key);
      const domain = kind === "domain" ? idOf(key) : kind === "tech" ? context.techDomain[idOf(key)] : undefined;
      const group =
        known.has(key) || (kind === "tech" && domain !== undefined && knownTopics.has(domain))
          ? "reinforce"
          : kind === "concept"
            ? "skills"
            : learn.has(key)
              ? "learn"
              : domain && nearby.has(domain)
                ? "broaden"
                : "learn";
      groups[group].set(key, (groups[group].get(key) ?? 0) + 1);
    }
  }

  const toEntries = (m: Map<string, number>) =>
    [...m]
      .map(([key, count]) => ({ key, label: context.labels[key] ?? idOf(key), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  let conflicts = 0;
  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      if (overlaps(picked[i]!.session, picked[j]!.session)) conflicts += 1;
    }
  }

  const byIntent: Record<Intent, number> = { reinforce: 0, broaden: 0, learn: 0 };
  for (const item of picked) byIntent[item.intent] += 1;

  return {
    sessions: picked.length,
    hours: Math.round(picked.reduce((sum, i) => sum + (i.session.schedule.durationMin ?? 60), 0) / 6) / 10,
    byIntent,
    handsOn: picked.filter((i) => i.learningStyle === "hands-on").length,
    conflicts,
    reinforce: toEntries(groups.reinforce),
    broaden: toEntries(groups.broaden),
    learn: toEntries(groups.learn),
    skills: toEntries(groups.skills),
  };
}
