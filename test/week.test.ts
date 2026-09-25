import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildWeek, impactOf, travelMinutes } from "../web/src/week.js";

function item(id: string, startTime: string, venue: string, durationMin = 60, date = "2026-12-01"): PlanItem {
  return {
    intent: "reinforce",
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

// An hourly grid at one venue, 8:00 to 17:00: with 10-minute room changes only every other slot fits.
const grid = Array.from({ length: 10 }, (_, i) => item(`G${i}`, `${String(8 + i).padStart(2, "0")}:00`, "Venetian"));

describe("travelMinutes", () => {
  it("uses the same-venue, neighbor and MGM estimates", () => {
    expect(travelMinutes("Venetian", "Venetian")).toBe(10);
    expect(travelMinutes("Caesars Palace", "Caesars Forum")).toBe(15);
    expect(travelMinutes("Venetian", "MGM Grand")).toBe(40);
    expect(travelMinutes(null, "Venetian")).toBe(25);
  });
});

describe("buildWeek", () => {
  it("derives capacity from the schedule, leaving room for travel and lunch", () => {
    const [day] = buildWeek(grid, {});
    // Every other hour fits (8, 10, 12, 14, 16) and lunch slips into 13:00-14:00.
    expect(day?.capacity).toBe(5);
    expect(day?.remaining).toBe(5);
    expect(day?.lunchFits).toBe(true);
  });

  it("back-to-back sessions in the same room change fit when the gap allows it", () => {
    const spaced = Array.from({ length: 4 }, (_, i) => item(`S${i}`, `${String(8 + 2 * i).padStart(2, "0")}:00`, "Venetian", 60));
    expect(buildWeek(spaced, {})[0]?.capacity).toBe(4);
  });

  it("gives up a session when lunch has nowhere else to go", () => {
    // Sessions every 70 minutes from 11:00 leave no free hour in the lunch window unless one is dropped.
    const tight = ["08:00", "09:10", "10:20", "11:30", "12:40", "13:50"].map((t, i) => item(`T${i}`, t, "Venetian"));
    expect(buildWeek(tight, {})[0]?.capacity).toBe(5);
  });

  it("counts down around picks and ignores sessions you passed on", () => {
    const [day] = buildWeek(grid, swipes(["G0"], ["G2"]));
    expect(day?.liked.map((i) => i.session.id)).toEqual(["G0"]);
    expect(day?.remaining).toBeGreaterThanOrEqual(2);
    expect(day?.remaining).toBeLessThan(day!.capacity);
  });

  it("flags picks you cannot travel between in time", () => {
    const items = [item("A", "10:00", "Venetian"), item("B", "11:15", "MGM Grand")];
    const [day] = buildWeek(items, swipes(["A", "B"]));
    expect(day?.overlapping.map((i) => i.session.id)).toEqual(["A", "B"]);
  });

  it("warns when picks leave no lunch break", () => {
    const items = ["11:00", "12:10", "13:20"].map((t, i) => item(`L${i}`, t, "Venetian"));
    expect(buildWeek(items, swipes(["L0", "L1", "L2"]))[0]?.lunchFits).toBe(false);
  });

  it("does not require lunch on a day that ends before it", () => {
    const friday = [item("F0", "08:00", "Wynn/Encore", 60, "2026-12-04"), item("F1", "10:00", "Wynn/Encore", 60, "2026-12-04")];
    const [day] = buildWeek(friday, swipes(["F0", "F1"]));
    expect(day?.lunchFits).toBe(true);
  });
});

describe("impactOf", () => {
  it("explains whether a candidate overlaps a pick or is too far to reach", () => {
    const items = [item("A", "10:00", "Venetian"), item("B", "10:30", "Venetian"), item("C", "11:10", "MGM Grand")];
    const week = buildWeek(items, swipes(["A"]));
    expect(impactOf(items[1]!, week).clashes.map((c) => c.reason)).toEqual(["overlap"]);
    expect(impactOf(items[2]!, week).clashes.map((c) => c.reason)).toEqual(["travel"]);
  });
});
