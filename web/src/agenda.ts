import { ALTERNATIVES_PER_PICK } from "./queue";
import type { PlanItem, SwipeLog } from "./types";
import { blockOf, compatible, type WeekDay } from "./week";

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
}

export interface AgendaDay {
  date: string;
  picks: AgendaPick[];
  lunchSlot: WeekDay["lunchSlot"];
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
  const candidates = items.filter((i) => decision(i) !== "like" && decision(i) !== "pass" && blockOf(i));

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
        },
      ];
    });
    return { date: day.date, picks, lunchSlot: day.lunchSlot };
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
