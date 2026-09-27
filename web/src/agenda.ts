import { ALTERNATIVES_PER_PICK } from "./queue";
import { repeatsOf } from "./repeats";
import type { PlanItem, SwipeLog } from "./types";
import { venueOf } from "./format";
import { blockOf, compatible, travelMinutes, type WeekDay } from "./week";

export interface AgendaPick {
  item: PlanItem;
  start: number;
  end: number;
  /** Sessions at the same time to swap in: your 🔖 maybes first, then the highest-scoring ones not yet reviewed. */
  alternatives: PlanItem[];
  /** Further sessions at the same time beyond the ones offered. */
  moreAlternatives: number;
  /** Other picks it overlaps or cannot be reached from in time. */
  clashes: PlanItem[];
  /** The same session picked again at another time: keep one. */
  repeats: PlanItem[];
  /** Other times the session is offered, to move it if this one gets crowded. */
  otherTimes: PlanItem[];
}

export interface FreeTime {
  start: number;
  end: number;
  /** Minutes you actually have, once the walk to the next session is taken out. */
  minutes: number;
  /** The walk to the next session when it is in another venue. */
  walk?: { to: string; minutes: number };
  /** What the time is good for: the Expo, booths, the hallway track or just a breather. */
  idea: string;
}

export interface AgendaDay {
  date: string;
  picks: AgendaPick[];
  lunchSlot: WeekDay["lunchSlot"];
  /** Gaps between picks worth knowing about (lunch apart). */
  freeTime: FreeTime[];
}

/** Gaps shorter than this, walk taken out, are not worth a note. */
export const MIN_FREE_MINUTES = 20;

function ideaFor(minutes: number): string {
  if (minutes >= 60) return "Expo hall, partner booths or the hallway track";
  if (minutes >= 30) return "A walk through the Expo, or a coffee with someone new";
  return "A breather: charge up, refill water";
}

/**
 * The free time between consecutive picks of a day: the walk to the next venue comes off the end of each gap, and a
 * lunch slot inside a gap splits it in two.
 */
export function freeTimeOf(
  picks: { start: number; end: number; venue: string | null }[],
  lunch: WeekDay["lunchSlot"],
): FreeTime[] {
  const sorted = [...picks].sort((a, b) => a.start - b.start);
  const free: FreeTime[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!;
    const to = sorted[i]!;
    if (to.start <= from.end) continue;
    const walk = travelMinutes(from.venue, to.venue);
    const segments =
      lunch && lunch.start < to.start && lunch.end > from.end
        ? [
            { start: from.end, end: Math.max(from.end, lunch.start), last: false },
            { start: Math.min(to.start, lunch.end), end: to.start, last: true },
          ]
        : [{ start: from.end, end: to.start, last: true }];
    for (const seg of segments) {
      const minutes = seg.end - seg.start - (seg.last ? walk : 0);
      if (minutes < MIN_FREE_MINUTES) continue;
      free.push({
        start: seg.start,
        end: seg.last ? seg.end - walk : seg.end,
        minutes,
        walk: seg.last && from.venue !== to.venue && to.venue ? { to: to.venue, minutes: walk } : undefined,
        idea: ideaFor(minutes),
      });
    }
  }
  return free;
}

export interface Agenda {
  days: AgendaDay[];
  /** Whole hours shown as rows, shared by every day so the columns line up. */
  hours: number[];
  /** ❤️ and 🔖 sessions without a time yet. */
  unscheduled: PlanItem[];
  /** 🔖 maybes that clash with none of your picks: free time you could still fill. */
  freeMaybes: PlanItem[];
}

const DEFAULT_HOURS = { from: 8, to: 18 };

/** Your week by hour: the session to attend in each slot, with the alternatives to it. */
export function buildAgenda(items: PlanItem[], swipes: SwipeLog, week: WeekDay[]): Agenda {
  const decision = (item: PlanItem) => swipes[item.session.id]?.decision;
  const liked = items.filter((i) => decision(i) === "like");
  const repeats = repeatsOf(items);
  const pickedElsewhere = new Set(liked.flatMap((i) => (repeats.get(i.session.id) ?? []).map((r) => r.session.id)));
  // Another time of a session you already picked is no alternative.
  const candidates = items.filter(
    (i) => decision(i) !== "like" && decision(i) !== "pass" && blockOf(i) && !pickedElsewhere.has(i.session.id),
  );

  const days = week.map((day) => {
    const dayCandidates = candidates.filter((c) => c.session.schedule.date === day.date);
    const picks = day.liked.flatMap((item): AgendaPick[] => {
      const block = blockOf(item);
      if (!block) return [];
      const rivals = dayCandidates
        .filter((c) => {
          const other = blockOf(c)!;
          return other.start < block.end && block.start < other.end;
        })
        .sort((a, b) => Number(decision(b) === "save") - Number(decision(a) === "save") || b.score - a.score);
      const clashes = day.liked.filter((o) => {
        const other = blockOf(o);
        return o !== item && other !== null && !compatible(block, other);
      });
      return [
        {
          item,
          start: block.start,
          end: block.end,
          alternatives: rivals.slice(0, ALTERNATIVES_PER_PICK),
          moreAlternatives: Math.max(0, rivals.length - ALTERNATIVES_PER_PICK),
          clashes,
          repeats: (repeats.get(item.session.id) ?? []).filter((o) => decision(o) === "like"),
          otherTimes: (repeats.get(item.session.id) ?? []).filter((o) => decision(o) !== "like" && blockOf(o)),
        },
      ];
    });
    const venues = picks.map((p) => {
      const venue = venueOf(p.item.session);
      return { start: p.start, end: p.end, venue: venue === "Venue TBA" ? null : venue };
    });
    return { date: day.date, picks, lunchSlot: day.lunchSlot, freeTime: freeTimeOf(venues, day.lunchSlot) };
  });

  const starts = days.flatMap((d) => d.picks.map((p) => p.start));
  const ends = days.flatMap((d) => d.picks.map((p) => p.end));
  const from = starts.length ? Math.floor(Math.min(...starts) / 60) : DEFAULT_HOURS.from;
  const to = ends.length ? Math.ceil(Math.max(...ends) / 60) : DEFAULT_HOURS.to;

  return {
    days,
    hours: Array.from({ length: Math.max(1, to - from) }, (_, i) => from + i),
    unscheduled: items.filter((i) => (decision(i) === "like" || decision(i) === "save") && !blockOf(i)),
    freeMaybes: items.filter((i) => {
      const block = decision(i) === "save" ? blockOf(i) : null;
      const picks = week.find((d) => d.date === i.session.schedule.date)?.liked ?? [];
      return block !== null && picks.every((p) => compatible(block, blockOf(p)!));
    }),
  };
}
