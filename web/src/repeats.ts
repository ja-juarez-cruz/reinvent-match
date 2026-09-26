import type { PlanItem, SwipeLog } from "./types";

/**
 * The code a session keeps across its repeats: re:Invent offers popular sessions more than once as "-R", "-R1",
 * "-R2" (SVS335-R and SVS335-R1 are the same session at two times).
 */
export function baseCode(code: string): string {
  return code.replace(/-R\d*$/, "");
}

/** Every session with its repeats at other times (the session itself excluded). */
export function repeatsOf(items: PlanItem[]): Map<string, PlanItem[]> {
  const byBase = new Map<string, PlanItem[]>();
  for (const item of items) {
    const base = baseCode(item.session.code);
    byBase.set(base, [...(byBase.get(base) ?? []), item]);
  }
  const repeats = new Map<string, PlanItem[]>();
  for (const group of byBase.values()) {
    if (group.length < 2) continue;
    for (const item of group) repeats.set(item.session.id, group.filter((o) => o !== item));
  }
  return repeats;
}

/**
 * Base codes already settled: one of their times is ❤️ or ❌, so the other times need no card of their own. A 🔖
 * maybe leaves them open, since another time may fit better.
 */
export function settledSessions(items: PlanItem[], swipes: SwipeLog): Set<string> {
  const settled = new Set<string>();
  for (const item of items) {
    const decision = swipes[item.session.id]?.decision;
    if (decision === "like" || decision === "pass") settled.add(baseCode(item.session.code));
  }
  return settled;
}

/** One entry per session: when more than one time of a session is ❤️, only the first counts. */
export function distinctSessions(items: PlanItem[]): PlanItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const base = baseCode(item.session.code);
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}
