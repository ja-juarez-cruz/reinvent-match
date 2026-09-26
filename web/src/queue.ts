import type { Settled } from "./repeats";
import type { PlanItem, SwipeLog } from "./types";
import { impactOf, type WeekDay } from "./week";

/** Alternatives offered per pick once the calendar is set: enough to choose, few enough to finish. */
export const ALTERNATIVES_PER_PICK = 2;

/**
 * fill: sessions that still fit around your picks and lunch, so the calendar fills fast.
 * alternatives: nothing else fits; sessions that clash with a pick, up to two per pick, to swap or keep.
 * rest: every pick has its alternatives; the other clashing sessions, only on request.
 */
export type QueueStage = "fill" | "alternatives" | "rest";

export interface SwipeQueue {
  stage: QueueStage;
  queue: PlanItem[];
  fit: number;
  alternatives: number;
  rest: number;
}

/**
 * Orders the sessions left to review in a tab. `items` come in plan order (reserved seating first, then score) and
 * keep that order within each stage. Alternatives already reviewed (passed or maybe) use up a pick's slots.
 */
export function buildQueue(
  items: PlanItem[],
  swipes: SwipeLog,
  week: WeekDay[],
  showRest = false,
  /**
   * Sessions already ❤️ or ❌ at another time (see ./repeats.ts). Other times of a ❌ never get a card; other times
   * of a ❤️ skip the fill stage but can come as alternatives, to move the pick and free its slot.
   */
  settled: Map<string, Settled> = new Map(),
): SwipeQueue {
  const fit: PlanItem[] = [];
  /** Fit trivially but take no place in the calendar yet: after the ones that fill it. */
  const unscheduled: PlanItem[] = [];
  const alternatives: PlanItem[] = [];
  const rest: PlanItem[] = [];
  const slotsUsed = new Map<string, number>();

  for (const item of items) {
    const decision = swipes[item.session.id]?.decision;
    if (decision === "like") continue;
    const elsewhere = decision ? undefined : settled.get(item.session.id);
    if (elsewhere?.decision === "pass") continue;
    const impact = impactOf(item, week);
    if (!elsewhere && !decision && impact.clashes.length === 0 && !impact.full && !impact.breaksLunch) {
      (item.session.schedule.date && item.session.schedule.startTime ? fit : unscheduled).push(item);
      continue;
    }
    const picks = impact.clashes.filter((c) => c.item !== elsewhere?.by).map((c) => c.item.session.id);
    // Another time of a pick is only worth a card when it could replace something at that time.
    if (elsewhere && picks.length === 0) continue;
    const isAlternative = picks.some((id) => (slotsUsed.get(id) ?? 0) < ALTERNATIVES_PER_PICK);
    if (isAlternative) for (const id of picks) slotsUsed.set(id, (slotsUsed.get(id) ?? 0) + 1);
    if (decision) continue;
    (isAlternative ? alternatives : rest).push(item);
  }

  fit.push(...unscheduled);
  const counts = { fit: fit.length, alternatives: alternatives.length, rest: rest.length };
  if (fit.length > 0) return { stage: "fill", queue: fit, ...counts };
  if (alternatives.length > 0) return { stage: "alternatives", queue: alternatives, ...counts };
  return { stage: "rest", queue: showRest ? rest : [], ...counts };
}
