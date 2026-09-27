import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildAgenda } from "../web/src/agenda.js";
import { apiText, buildIcs, planBlocks, toApiBlocks, utcOffsetMinutes } from "../web/src/calendar.js";
import { buildWeek } from "../web/src/week.js";

function item(id: string, startTime: string, venue: string, durationMin = 60, date = "2026-12-01"): PlanItem {
  return {
    intent: "reinforce",
    reservable: true,
    goalHits: 1,
    score: 80,
    reasons: [],
    keys: [],
    learningStyle: "discussion",
    session: {
      id,
      code: id,
      title: id,
      abstract: "",
      format: "chalk-talk",
      formatLabel: "Chalk talk",
      levelLabel: "300",
      isSponsored: false,
      mayRepeat: false,
      speakers: [],
      schedule: { date, startTime, durationMin, venue, room: null },
    },
  };
}

const at = "2026-09-24T00:00:00Z";
const swipes = (likes: string[], passes: string[] = []): SwipeLog => ({
  ...Object.fromEntries(likes.map((id) => [id, { decision: "like" as const, at }])),
  ...Object.fromEntries(passes.map((id) => [id, { decision: "pass" as const, at }])),
});

const saves = (ids: string[]): SwipeLog =>
  Object.fromEntries(ids.map((id) => [id, { decision: "save" as const, at }]));

const scored = (i: PlanItem, score: number): PlanItem => ({ ...i, score });

describe("calendar", () => {
  const morning = item("M", "09:00", "Venetian");
  const noon = item("N", "12:30", "Venetian");
  const far = item("F", "15:00", "MGM Grand");
  const all = [morning, noon, far];
  const log = swipes(["M", "N", "F"]);
  const agenda = buildAgenda(all, log, buildWeek(all, log));

  it("reads the event's UTC offset, used for the .ics", () => {
    expect(utcOffsetMinutes("2026-12-04T23:59:00.000-08:00")).toBe(-480);
  });

  it("plans lunch, walks between venues and free time around the picks, in 5-minute steps", () => {
    const blocks = planBlocks(agenda);
    // 10:00–11:00 free before lunch, lunch 11:00–12:00, then 50 min free and the 40-min walk to MGM for 15:00.
    expect(blocks.map((b) => [b.kind, b.start, b.end])).toEqual([
      ["free", 600, 660],
      ["lunch", 660, 720],
      ["free", 810, 860],
      ["walk", 860, 900],
    ]);
    expect(blocks.every((b) => b.start % 5 === 0 && b.end % 5 === 0)).toBe(true);
    expect(blocks[3]!.title).toBe("🚶 Walk to MGM Grand");
  });

  it("writes an iCalendar file with the picks and blocks in UTC", () => {
    const ics = buildIcs({ calendarName: "re:Invent 2026", sessions: all, blocks: planBlocks(agenda), offset: -480, now: new Date(Date.UTC(2026, 8, 27)) });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261201T170000Z");
    expect(ics).toContain("UID:M@reinvent-match");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
});

describe("personal time for the Events API", () => {
  it("drops emoji the API refuses and the & that cuts text short", () => {
    expect(apiText("🍽 Lunch")).toBe("Lunch");
    expect(apiText("🚶 Walk to MGM Grand")).toBe("Walk to MGM Grand");
    expect(apiText("☕ Free: Expo & booths")).toBe("☕ Free: Expo and booths");
  });

  it("sends personal time in the event's local time, as the AWS Events app shows it", () => {
    const blocks = toApiBlocks([
      { kind: "walk", date: "2026-11-30", start: 9 * 60 + 50, end: 10 * 60 + 30, title: "🚶 Walk to MGM Grand", description: "Walk", location: "MGM Grand" },
      { kind: "lunch", date: "2026-11-30", start: 13 * 60, end: 14 * 60, title: "🍽 Lunch", description: "Lunch" },
    ]);
    expect(blocks.map((b) => [b.startDateTime, b.endDateTime, b.title])).toEqual([
      ["2026-11-30T09:50:00", "2026-11-30T10:30:00", "Walk to MGM Grand"],
      ["2026-11-30T13:00:00", "2026-11-30T14:00:00", "Lunch"],
    ]);
  });

  it("never runs a block past the end of its day", () => {
    const late = toApiBlocks([{ kind: "free", date: "2026-11-30", start: 23 * 60, end: 24 * 60, title: "Free", description: "x" }]);
    expect(late.map((b) => [b.startDateTime, b.endDateTime])).toEqual([["2026-11-30T23:00:00", "2026-11-30T23:55:00"]]);
  });

});
