import { repeatsOf } from "./repeats";
import type { PlanItem, SwipeLog } from "./types";
import { blockOf } from "./week";

export interface Reservation {
  item: PlanItem;
  /** Only one time is offered: miss the seat and the session is gone. */
  onlyTime: boolean;
  /** Where to go if the seat is taken: other times of the session, then 🔖 maybes at the same time. */
  backups: PlanItem[];
}

/**
 * The ❤️ sessions that need a reserved seat, in the order to book them when reserved seating opens: single-time
 * sessions first (no second chance), then hands-on ones (they fill fastest), then by score.
 */
export function reservationPlan(items: PlanItem[], swipes: SwipeLog): Reservation[] {
  const repeats = repeatsOf(items);
  const liked = items.filter((i) => swipes[i.session.id]?.decision === "like" && i.reservable);
  const maybes = items.filter((i) => swipes[i.session.id]?.decision === "save");
  const handsOn = (i: PlanItem) => i.learningStyle === "hands-on";
  return liked
    .map((item) => {
      const otherTimes = (repeats.get(item.session.id) ?? []).filter((r) => swipes[r.session.id]?.decision !== "pass");
      const block = blockOf(item);
      const sameTime = block
        ? maybes.filter((m) => {
            const other = blockOf(m);
            return !!other && m.session.schedule.date === item.session.schedule.date && other.start < block.end && block.start < other.end;
          })
        : [];
      return { item, onlyTime: otherTimes.length === 0, backups: [...otherTimes, ...sameTime] };
    })
    .sort(
      (a, b) =>
        Number(b.onlyTime) - Number(a.onlyTime) ||
        Number(handsOn(b.item)) - Number(handsOn(a.item)) ||
        b.item.score - a.item.score,
    );
}
