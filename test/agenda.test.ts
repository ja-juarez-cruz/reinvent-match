import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildAgenda } from "../web/src/agenda.js";
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

describe("buildAgenda", () => {
  const pick = item("P", "10:00", "Venetian", 120);
  const low = scored(item("LOW", "10:30", "Venetian"), 60);
  const high = scored(item("HIGH", "11:00", "Venetian"), 90);
  const maybe = scored(item("MAYBE", "10:00", "Venetian"), 40);
  const extra = scored(item("EXTRA", "10:00", "Venetian"), 50);
  const free = item("FREE", "16:00", "Venetian");
  const tba = item("TBA", "10:00", "Venetian");
  tba.session.schedule = { ...tba.session.schedule, date: null, startTime: null };
  const all = [pick, low, high, maybe, extra, free, tba];
  const log = { ...swipes(["P", "TBA"]), ...saves(["MAYBE", "FREE"]) };
  const agenda = buildAgenda(all, log, buildWeek(all, log));

  it("places each pick in its day with hour rows around it", () => {
    expect(agenda.days).toHaveLength(1);
    expect(agenda.days[0]!.picks.map((p) => p.item.session.id)).toEqual(["P"]);
    expect(agenda.hours).toEqual([10, 11]);
  });

  it("offers two alternatives per pick: maybes first, then by score", () => {
    const p = agenda.days[0]!.picks[0]!;
    expect(p.alternatives.map((a) => a.session.id)).toEqual(["MAYBE", "HIGH"]);
    expect(p.moreAlternatives).toBe(2);
  });

  it("lists maybes in free time and sessions without a time apart", () => {
    expect(agenda.freeMaybes.map((i) => i.session.id)).toEqual(["FREE"]);
    expect(agenda.unscheduled.map((i) => i.session.id)).toEqual(["TBA"]);
  });
});

it("only offers sessions at the same time as alternatives, not ones merely too far to reach", () => {
  const pick = item("P", "08:30", "Caesars Forum");
  const later = item("LATER", "09:40", "MGM Grand");
  const log = swipes(["P"]);
  const agenda = buildAgenda([pick, later], log, buildWeek([pick, later], log));
  expect(agenda.days[0]!.picks[0]!.alternatives).toEqual([]);
});
