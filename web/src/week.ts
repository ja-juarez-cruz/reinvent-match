import { overlaps } from "./format";
import type { PlanItem, SwipeLog } from "./types";

/** Sessions a person can realistically attend in one day, with travel and breaks. */
export const DAILY_LIMIT = 6;

export interface WeekDay {
  date: string;
  liked: PlanItem[];
  /** Negative when the day is over the limit. */
  remaining: number;
  /** Liked sessions that overlap at least one other liked session that day. */
  overlapping: PlanItem[];
}

/** One entry per scheduled day of the catalog, with the attendee's ❤️ sessions placed on it. */
export function buildWeek(items: PlanItem[], swipes: SwipeLog, limit = DAILY_LIMIT): WeekDay[] {
  const dates = [...new Set(items.map((i) => i.session.schedule.date).filter((d): d is string => d !== null))].sort();
  return dates.map((date) => {
    const liked = items
      .filter((i) => i.session.schedule.date === date && swipes[i.session.id]?.decision === "like")
      .sort((a, b) => (a.session.schedule.startTime ?? "").localeCompare(b.session.schedule.startTime ?? ""));
    const overlapping = liked.filter((a) => liked.some((b) => a !== b && overlaps(a.session, b.session)));
    return { date, liked, remaining: limit - liked.length, overlapping };
  });
}

/** What adding this session would do to its day: sessions it clashes with and whether the day is already full. */
export function impactOf(item: PlanItem, week: WeekDay[]): { day: WeekDay | undefined; clashes: PlanItem[]; full: boolean } {
  const day = week.find((d) => d.date === item.session.schedule.date);
  const clashes = day ? day.liked.filter((l) => l !== item && overlaps(l.session, item.session)) : [];
  return { day, clashes, full: day !== undefined && day.remaining <= 0 };
}
