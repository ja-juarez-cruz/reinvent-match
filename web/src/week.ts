import { minutesOf, venueOf } from "./format";
import type { PlanItem, SwipeLog } from "./types";

/**
 * Door-to-door minutes between venues, including walking inside the hotels. These are estimates for the
 * re:Invent campus (AWS runs shuttles but publishes no travel times): the Venetian, Wynn/Encore, Caesars Forum and
 * Caesars Palace sit close together on the north Strip; MGM Grand is at the south end.
 */
export const SAME_VENUE_MINUTES = 10;
export const UNKNOWN_VENUE_MINUTES = 25;
const MGM_MINUTES = 40;
const TRAVEL: Record<string, Record<string, number>> = {
  Venetian: { "Wynn/Encore": 20, "Caesars Forum": 20, "Caesars Palace": 20 },
  "Wynn/Encore": { "Caesars Forum": 25, "Caesars Palace": 30 },
  "Caesars Forum": { "Caesars Palace": 15 },
};

/** A lunch break of this length has to fit somewhere in the lunch window on days that run past it. */
export const LUNCH_MINUTES = 60;
const LUNCH_WINDOW = { from: 11 * 60, to: 14 * 60 };
const LUNCH_STEP = 15;
const DEFAULT_DURATION = 60;

export function travelMinutes(a: string | null, b: string | null): number {
  if (!a || !b) return UNKNOWN_VENUE_MINUTES;
  if (a === b) return SAME_VENUE_MINUTES;
  if (a === "MGM Grand" || b === "MGM Grand") return MGM_MINUTES;
  return TRAVEL[a]?.[b] ?? TRAVEL[b]?.[a] ?? UNKNOWN_VENUE_MINUTES;
}

export interface Block {
  start: number;
  end: number;
  venue: string | null;
  /** Lunch needs no travel to or from it: you eat near where you are. */
  lunch?: boolean;
}

export function blockOf(item: PlanItem): Block | null {
  const start = minutesOf(item.session.schedule.startTime);
  if (start === null || !item.session.schedule.date) return null;
  const venue = venueOf(item.session);
  return {
    start,
    end: start + (item.session.schedule.durationMin || DEFAULT_DURATION),
    venue: venue === "Venue TBA" ? null : venue,
  };
}

function gap(a: Block, b: Block): number {
  return a.lunch || b.lunch ? 0 : travelMinutes(a.venue, b.venue);
}

/** Whether you can attend both: they do not overlap and there is time to get from one to the other. */
export function compatible(a: Block, b: Block): boolean {
  return a.end + gap(a, b) <= b.start || b.end + gap(b, a) <= a.start;
}

/**
 * Most sessions from `candidates` you can add around the `fixed` blocks, with travel between consecutive ones.
 * Weighted interval scheduling with venue-dependent gaps: O(n²) over the day's candidates.
 */
function maxAdditional(candidates: Block[], fixed: Block[]): number {
  const usable = candidates.filter((c) => fixed.every((f) => compatible(c, f))).sort((a, b) => a.end - b.end);
  const best: number[] = [];
  let overall = 0;
  for (let i = 0; i < usable.length; i++) {
    let prev = 0;
    for (let j = 0; j < i; j++) {
      if (usable[j]!.end + gap(usable[j]!, usable[i]!) <= usable[i]!.start) prev = Math.max(prev, best[j]!);
    }
    best[i] = prev + 1;
    overall = Math.max(overall, best[i]!);
  }
  return overall;
}

function lunchOptions(dayEnd: number): Block[] {
  if (dayEnd <= LUNCH_WINDOW.from + LUNCH_MINUTES) return [];
  const options: Block[] = [];
  for (let start = LUNCH_WINDOW.from; start + LUNCH_MINUTES <= LUNCH_WINDOW.to; start += LUNCH_STEP) {
    options.push({ start, end: start + LUNCH_MINUTES, venue: null, lunch: true });
  }
  return options;
}

/** Best count over every lunch slot; `null` lunch means no slot fits around the fixed blocks. */
function bestWithLunch(candidates: Block[], fixed: Block[], dayEnd: number): { count: number; lunchFits: boolean } {
  const options = lunchOptions(dayEnd);
  if (options.length === 0) return { count: maxAdditional(candidates, fixed), lunchFits: true };
  let best = -1;
  for (const lunch of options) {
    if (!fixed.every((f) => compatible(f, lunch))) continue;
    best = Math.max(best, maxAdditional(candidates, [...fixed, lunch]));
  }
  return best >= 0 ? { count: best, lunchFits: true } : { count: maxAdditional(candidates, fixed), lunchFits: false };
}

export interface WeekDay {
  date: string;
  liked: PlanItem[];
  /** Most sessions of your pre-list that fit this day, with lunch and travel, before you pick anything. */
  capacity: number;
  /** How many more fit around what you already picked. */
  remaining: number;
  /** Picks that overlap another pick or leave no time to get there. */
  overlapping: PlanItem[];
  /** False when your picks leave no lunch break in the lunch window. */
  lunchFits: boolean;
  /** Earliest lunch slot that fits around your picks; null when none fits or the day ends before lunch. */
  lunchSlot: { start: number; end: number } | null;
  /** First start and last end of your picks, in minutes after midnight. */
  span: { start: number; end: number } | null;
  /** Free minutes between consecutive picks (negative when they overlap). */
  gaps: number[];
}

/**
 * One entry per scheduled day. Capacity comes from the real schedule: the sessions still on the table (your
 * pre-list minus what you passed on), a lunch break and travel time between venues.
 */
export function buildWeek(items: PlanItem[], swipes: SwipeLog): WeekDay[] {
  const byDay = new Map<string, { item: PlanItem; block: Block }[]>();
  for (const item of items) {
    const block = blockOf(item);
    if (!block) continue;
    const date = item.session.schedule.date!;
    byDay.set(date, [...(byDay.get(date) ?? []), { item, block }]);
  }

  return [...byDay.keys()].sort().map((date) => {
    const entries = byDay.get(date)!;
    const dayEnd = Math.max(...entries.map((e) => e.block.end));
    const decision = (e: { item: PlanItem }) => swipes[e.item.session.id]?.decision;
    const liked = entries.filter((e) => decision(e) === "like");
    const open = entries.filter((e) => decision(e) !== "like" && decision(e) !== "pass");
    const all = entries.filter((e) => decision(e) !== "pass");

    const capacity = bestWithLunch(all.map((e) => e.block), [], dayEnd).count;
    const { count: remaining, lunchFits } = bestWithLunch(open.map((e) => e.block), liked.map((e) => e.block), dayEnd);
    const overlapping = liked
      .filter((a) => liked.some((b) => a !== b && !compatible(a.block, b.block)))
      .map((e) => e.item);
    const pickedBlocks = liked.map((e) => e.block).sort((a, b) => a.start - b.start);
    const lunch = lunchOptions(dayEnd).find((l) => pickedBlocks.every((b) => compatible(b, l)));

    return {
      date,
      liked: liked.map((e) => e.item).sort((a, b) => (a.session.schedule.startTime ?? "").localeCompare(b.session.schedule.startTime ?? "")),
      capacity,
      remaining,
      overlapping,
      lunchFits,
      lunchSlot: lunch ? { start: lunch.start, end: lunch.end } : null,
      span: pickedBlocks.length
        ? { start: pickedBlocks[0]!.start, end: Math.max(...pickedBlocks.map((b) => b.end)) }
        : null,
      gaps: pickedBlocks.slice(1).map((b, i) => b.start - pickedBlocks[i]!.end),
    };
  });
}

export interface Impact {
  day: WeekDay | undefined;
  /** Picks this session overlaps or cannot be reached from in time, with the reason. */
  clashes: { item: PlanItem; reason: "overlap" | "travel" }[];
  full: boolean;
  /** Adding it would leave no lunch break in the lunch window. */
  breaksLunch: boolean;
}

/** What adding this session would do to its day. */
export function impactOf(item: PlanItem, week: WeekDay[]): Impact {
  const day = week.find((d) => d.date === item.session.schedule.date);
  const block = blockOf(item);
  const clashes: Impact["clashes"] = [];
  if (day && block) {
    for (const pick of day.liked) {
      const other = blockOf(pick);
      if (pick === item || !other || compatible(block, other)) continue;
      const overlap = block.start < other.end && other.start < block.end;
      clashes.push({ item: pick, reason: overlap ? "overlap" : "travel" });
    }
  }
  let breaksLunch = false;
  if (day && block && clashes.length === 0) {
    const picks = [...day.liked.map(blockOf).filter((b): b is Block => b !== null), block];
    const options = lunchOptions(Math.max(...picks.map((b) => b.end)));
    breaksLunch = options.length > 0 && !options.some((l) => picks.every((b) => compatible(b, l)));
  }
  return { day, clashes, full: day !== undefined && day.remaining <= 0, breaksLunch };
}

/** The next scheduled day after `date`, if any. */
export function nextDay(week: WeekDay[], date: string): WeekDay | undefined {
  return week.find((d) => d.date > date);
}
