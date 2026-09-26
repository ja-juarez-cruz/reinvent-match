import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildQueue } from "../web/src/queue.js";
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

const queueOf = (items: PlanItem[], log: SwipeLog, showRest = false) =>
  buildQueue(items, log, buildWeek(items, log), showRest);

describe("buildQueue", () => {
  // A picked 10:00 session at the Venetian; C1-C3 overlap it, F1-F2 fit around it.
  const pick = item("P", "10:00", "Venetian");
  const clashing = ["C1", "C2", "C3"].map((id) => item(id, "10:00", "Venetian"));
  const fitting = [item("F1", "08:00", "Venetian"), item("F2", "15:00", "Venetian")];
  const all = [pick, ...clashing, ...fitting];

  it("shows sessions that fit your picks first, in plan order", () => {
    const q = queueOf(all, swipes(["P"]));
    expect(q.stage).toBe("fill");
    expect(q.queue.map((i) => i.session.id)).toEqual(["F1", "F2"]);
    expect(q).toMatchObject({ fit: 2, alternatives: 2, rest: 1 });
  });

  it("offers two alternatives per pick once nothing else fits", () => {
    const q = queueOf(all, swipes(["P"], ["F1", "F2"]));
    expect(q.stage).toBe("alternatives");
    expect(q.queue.map((i) => i.session.id)).toEqual(["C1", "C2"]);
  });

  it("counts reviewed alternatives and keeps the rest until asked", () => {
    const log = { ...swipes(["P"], ["F1", "F2", "C1"]), ...saves(["C2"]) };
    expect(queueOf(all, log)).toMatchObject({ stage: "rest", queue: [], rest: 1 });
    expect(queueOf(all, log, true).queue.map((i) => i.session.id)).toEqual(["C3"]);
  });

  it("holds back sessions on a day that is already full", () => {
    // Every other hourly slot fits at one venue: picking 8, 10, 12 (lunch fits at 13) ... fills the grid.
    const grid = Array.from({ length: 10 }, (_, i) => item(`G${i}`, `${String(8 + i).padStart(2, "0")}:00`, "Venetian"));
    const log = swipes(["G0", "G2", "G5", "G7", "G9"]);
    const q = queueOf(grid, log);
    expect(q.fit).toBe(0);
    expect(q.stage).toBe("alternatives");
  });
});

describe("buildQueue and lunch", () => {
  it("keeps a session that would take your lunch break for later", () => {
    const morning = item("M", "10:00", "Venetian", 60);
    const afternoon = item("A", "13:30", "Venetian", 60);
    const lunchTaker = item("L", "11:45", "Venetian", 90);
    const q = buildQueue([morning, afternoon, lunchTaker], swipes(["M", "A"]), buildWeek([morning, afternoon, lunchTaker], swipes(["M", "A"])));
    expect(q.fit).toBe(0);
  });
});

it("puts sessions without a time yet after the ones that fill the calendar", () => {
  const tba = item("T", "10:00", "Venetian");
  tba.session.schedule = { ...tba.session.schedule, startTime: null, date: null };
  const timed = item("S", "10:00", "Venetian");
  expect(buildQueue([tba, timed], {}, buildWeek([tba, timed], {})).queue.map((i) => i.session.id)).toEqual(["S", "T"]);
});
