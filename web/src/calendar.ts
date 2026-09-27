import type { Agenda } from "./agenda";
import { formatTimeRange, minutesOf, venueOf } from "./format";
import type { PlanItem } from "./types";

export type BlockKind = "lunch" | "walk" | "free";

/** A block of the attendee's own time between sessions, in the event's local time (minutes after midnight). */
export interface CalendarBlock {
  kind: BlockKind;
  date: string;
  start: number;
  end: number;
  title: string;
  description: string;
  location?: string;
}

/** Free time shorter than this is not worth a block on the calendar. */
const MIN_FREE_BLOCK = 30;

/**
 * The blocks My Match plans around the ❤️ picks: a lunch per day, the walks between venues, and free time of half an
 * hour or more (the Expo, booths, the hallway track). Times snap to 5 minutes, as the Events API requires.
 */
export function planBlocks(agenda: Agenda): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  for (const day of agenda.days) {
    if (!day.picks.some((p) => p.decision === "like")) continue;
    if (day.lunchSlot) {
      blocks.push({
        kind: "lunch",
        date: day.date,
        start: day.lunchSlot.start,
        end: day.lunchSlot.end,
        title: "🍽 Lunch",
        description: "Lunch break between your sessions.",
      });
    }
    for (const f of day.freeTime) {
      if (f.walk) {
        const start = f.transfer ? f.start : f.end;
        blocks.push({
          kind: "walk",
          date: day.date,
          start,
          end: start + f.walk.minutes,
          title: `🚶 Walk to ${f.walk.to}`,
          description: f.transfer?.tight
            ? `Tight: the walk takes ${f.walk.minutes} min and your next session starts at the end of the previous one.`
            : `About ${f.walk.minutes} min to ${f.walk.to} for your next session.`,
          location: f.walk.to,
        });
      }
      if (!f.transfer && f.minutes >= MIN_FREE_BLOCK) {
        blocks.push({
          kind: "free",
          date: day.date,
          start: f.start,
          end: f.end,
          title: f.minutes >= 60 ? "☕ Free: Expo & booths" : "☕ Free time",
          description: `${f.idea}.`,
        });
      }
    }
  }
  return blocks
    .map((b) => ({ ...b, start: Math.floor(b.start / 5) * 5, end: Math.ceil(b.end / 5) * 5 }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

/** Minutes the event's local time is ahead of UTC, from a timestamp with an offset ("…-08:00" → -480). */
export function utcOffsetMinutes(isoWithOffset: string | undefined): number {
  const m = isoWithOffset?.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** A local date and minutes as a UTC Date. */
function toDate(date: string, minutes: number, offset: number): Date {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes - offset));
}

/** `YYYY-MM-DDTHH:MM:00` in UTC, the form the Events API wants for personal time. */
export function toApiUtc(date: string, minutes: number, offset: number): string {
  return toDate(date, minutes, offset).toISOString().slice(0, 16) + ":00";
}

/** `YYYYMMDDTHHMMSSZ`, the iCalendar UTC form. */
function toIcsUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/**
 * An iCalendar file with the ❤️ sessions and, optionally, the planned blocks, for the phone's or laptop's calendar.
 * Times are written in UTC; calendar apps show them in the viewer's time zone.
 */
export function buildIcs(opts: {
  calendarName: string;
  sessions: PlanItem[];
  blocks: CalendarBlock[];
  offset: number;
  now?: Date;
}): string {
  const stamp = toIcsUtc(opts.now ?? new Date());
  const events: string[][] = [];
  for (const item of opts.sessions) {
    const s = item.session;
    const start = minutesOf(s.schedule.startTime);
    if (!s.schedule.date || start === null) continue;
    const end = start + (s.schedule.durationMin || 60);
    events.push([
      "BEGIN:VEVENT",
      `UID:${s.id}@reinvent-match`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(toDate(s.schedule.date, start, opts.offset))}`,
      `DTEND:${toIcsUtc(toDate(s.schedule.date, end, opts.offset))}`,
      `SUMMARY:${escapeIcs(`${s.code} · ${s.title}`)}`,
      `LOCATION:${escapeIcs([venueOf(s), s.schedule.room?.split("|").slice(1).join(" ·").trim()].filter(Boolean).join(" · "))}`,
      `DESCRIPTION:${escapeIcs(
        [
          `${s.formatLabel ?? s.format} · ${s.levelLabel ?? ""} · ${formatTimeRange(s)}`,
          item.reservable ? "Reserved seating: book it." : "",
          s.abstract,
        ]
          .filter(Boolean)
          .join("\n\n"),
      )}`,
      "END:VEVENT",
    ]);
  }
  for (const b of opts.blocks) {
    events.push([
      "BEGIN:VEVENT",
      `UID:${b.kind}-${b.date}-${b.start}@reinvent-match`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(toDate(b.date, b.start, opts.offset))}`,
      `DTEND:${toIcsUtc(toDate(b.date, b.end, opts.offset))}`,
      `SUMMARY:${escapeIcs(b.title)}`,
      ...(b.location ? [`LOCATION:${escapeIcs(b.location)}`] : []),
      `DESCRIPTION:${escapeIcs(b.description)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]);
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reinvent:Match//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(opts.calendarName)}`,
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
