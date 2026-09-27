import { repeatsOf, settledSessions } from "./repeats";
import type { PlanItem, SwipeLog } from "./types";
import { buildWeek, impactOf } from "./week";

/** Below this score a session is not worth a slot in a suggested week. */
export const SUGGEST_MIN_SCORE = 65;

export interface Suggestion {
  item: PlanItem;
  /** Why it was suggested: one of your 🔖 maybes, or a top match at your level. */
  from: "maybe" | "match";
}

/**
 * Fills the free time around the attendee's picks: their 🔖 maybes first (best score first), then the best sessions
 * at their level, tab by tab in plan order. A suggestion must fit around the picks and earlier suggestions, lunch and
 * travel included; sponsored sessions, sessions under SUGGEST_MIN_SCORE, and other times of a session already
 * picked or suggested are skipped.
 */
export function suggestWeek(items: PlanItem[], swipes: SwipeLog): Suggestion[] {
  const repeats = repeatsOf(items);
  const settled = settledSessions(items, swipes);
  const scheduled = (i: PlanItem) => !!i.session.schedule.date && !!i.session.schedule.startTime;
  const eligible = (i: PlanItem) =>
    scheduled(i) && !i.session.isSponsored && i.score >= SUGGEST_MIN_SCORE && !settled.has(i.session.id);
  const maybes = items
    .filter((i) => swipes[i.session.id]?.decision === "save" && eligible(i))
    .sort((a, b) => b.score - a.score);
  const matches = items.filter((i) => !swipes[i.session.id] && i.fitsLevel !== false && eligible(i));

  const log: SwipeLog = { ...swipes };
  const taken = new Set<string>();
  const suggestions: Suggestion[] = [];
  let week = buildWeek(items, log);
  for (const [from, candidates] of [["maybe", maybes], ["match", matches]] as const) {
    for (const item of candidates) {
      if (taken.has(item.session.id)) continue;
      const day = week.find((d) => d.date === item.session.schedule.date);
      if (!day || day.remaining <= 0) continue;
      const impact = impactOf(item, week);
      if (impact.clashes.length > 0 || impact.breaksLunch) continue;
      log[item.session.id] = { decision: "like", at: new Date().toISOString() };
      for (const r of [item, ...(repeats.get(item.session.id) ?? [])]) taken.add(r.session.id);
      suggestions.push({ item, from });
      week = buildWeek(items, log);
    }
  }
  return suggestions.sort((a, b) =>
    `${a.item.session.schedule.date}${a.item.session.schedule.startTime}`.localeCompare(
      `${b.item.session.schedule.date}${b.item.session.schedule.startTime}`,
    ),
  );
}
