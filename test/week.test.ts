import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildWeek, impactOf } from "../web/src/week.js";

function item(id: string, date: string | null, startTime: string, durationMin = 60): PlanItem {
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
      schedule: { date, startTime, durationMin, venue: null, room: null },
    },
  };
}

const at = "2026-09-24T00:00:00Z";
const like = (...ids: string[]): SwipeLog => Object.fromEntries(ids.map((id) => [id, { decision: "like", at }]));

describe("buildWeek", () => {
  const items = [
    item("A", "2026-11-30", "10:00"),
    item("B", "2026-11-30", "10:30"),
    item("C", "2026-11-30", "13:00"),
    item("D", "2026-12-01", "09:00"),
    item("E", null, "09:00"),
  ];

  it("lists every scheduled day, even with nothing picked", () => {
    expect(buildWeek(items, {}).map((d) => [d.date, d.remaining])).toEqual([
      ["2026-11-30", 6],
      ["2026-12-01", 6],
    ]);
  });

  it("counts down from the daily limit and flags overlaps", () => {
    const [mon, tue] = buildWeek(items, { ...like("A", "B", "C"), D: { decision: "save", at } });
    expect(mon?.remaining).toBe(3);
    expect(mon?.overlapping.map((i) => i.session.id)).toEqual(["A", "B"]);
    expect(tue?.remaining).toBe(6);
  });

  it("goes negative when a day is over the limit", () => {
    const many = Array.from({ length: 7 }, (_, i) => item(`S${i}`, "2026-11-30", `${String(8 + i).padStart(2, "0")}:00`));
    const [day] = buildWeek(many, like(...many.map((m) => m.session.id)));
    expect(day?.remaining).toBe(-1);
    expect(day?.overlapping).toEqual([]);
  });
});

describe("impactOf", () => {
  it("tells whether a candidate clashes with picks or lands on a full day", () => {
    const items = [item("A", "2026-11-30", "10:00"), item("B", "2026-11-30", "10:30"), item("C", "2026-12-01", "09:00")];
    const week = buildWeek(items, like("A"), 1);
    expect(impactOf(items[1]!, week)).toMatchObject({ full: true });
    expect(impactOf(items[1]!, week).clashes.map((c) => c.session.id)).toEqual(["A"]);
    expect(impactOf(items[2]!, week)).toMatchObject({ full: false, clashes: [] });
  });
});
