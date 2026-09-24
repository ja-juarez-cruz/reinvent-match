import type { Session } from "./types";

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function formatDay(date: string | null): string {
  return date ? DAY.format(new Date(`${date}T00:00:00Z`)) : "Unscheduled";
}

export function minutesOf(time: string | null): number | null {
  const m = time?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatTimeRange(s: Session): string {
  const start = minutesOf(s.schedule.startTime);
  if (start === null) return "Time TBA";
  const end = s.schedule.durationMin ? start + s.schedule.durationMin : null;
  return end === null ? clock(start) : `${clock(start)}–${clock(end)}`;
}

export function sessionInterval(s: Session): { day: string; start: number; end: number } | null {
  const start = minutesOf(s.schedule.startTime);
  if (!s.schedule.date || start === null) return null;
  return { day: s.schedule.date, start, end: start + (s.schedule.durationMin ?? 60) };
}

export function overlaps(a: Session, b: Session): boolean {
  const x = sessionInterval(a);
  const y = sessionInterval(b);
  return !!x && !!y && x.day === y.day && x.start < y.end && y.start < x.end;
}

export function venueOf(s: Session): string {
  return s.schedule.venue ?? s.schedule.room?.split("|")[0]?.trim() ?? "Venue TBA";
}

