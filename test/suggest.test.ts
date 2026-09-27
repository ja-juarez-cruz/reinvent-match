import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { reservationPlan } from "../web/src/reservations.js";
import { suggestWeek } from "../web/src/suggest.js";

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

const log = (likes: string[], maybes: string[] = [], passes: string[] = []): SwipeLog => ({
  ...swipes(likes, passes),
  ...Object.fromEntries(maybes.map((id) => [id, { decision: "save" as const, at }])),
});
const with_ = (i: PlanItem, over: Partial<PlanItem> & { sponsored?: boolean }): PlanItem => ({
  ...i,
  ...over,
  session: { ...i.session, isSponsored: over.sponsored ?? i.session.isSponsored },
});

describe("suggestWeek", () => {
  const pick = item("P", "10:00", "Venetian");
  const maybe = with_(item("M", "13:00", "Venetian"), { score: 70 });
  const clash = with_(item("C", "10:00", "Venetian"), { score: 99 });
  const good = with_(item("G", "15:00", "Venetian"), { score: 90 });
  const weak = with_(item("W", "17:00", "Venetian"), { score: 50 });
  const sponsored = with_(item("S-S", "08:00", "Venetian"), { score: 95, sponsored: true });

  it("fills free time with maybes first, then good matches, never clashing, weak or sponsored ones", () => {
    const got = suggestWeek([pick, maybe, clash, good, weak, sponsored], log(["P"], ["M"]));
    expect(got.map((s) => [s.item.session.id, s.from])).toEqual([
      ["M", "maybe"],
      ["G", "match"],
    ]);
  });

  it("does not suggest another time of a session already picked", () => {
    const first = item("SVS335-R", "10:00", "Venetian");
    const second = with_(item("SVS335-R1", "15:00", "Venetian"), { score: 99 });
    expect(suggestWeek([first, second], log(["SVS335-R"]))).toEqual([]);
  });
});

describe("reservationPlan", () => {
  const workshop = (id: string, time: string, score: number) =>
    with_(item(id, time, "Venetian"), { score, learningStyle: "hands-on", reservable: true });
  const once = workshop("ARC401", "10:00", 70);
  const twiceA = workshop("SVS402-R", "12:00", 95);
  const twiceB = workshop("SVS402-R1", "16:00", 95);
  const chalk = with_(item("SEC301", "14:00", "Venetian"), { score: 99, reservable: true, learningStyle: "discussion" });
  const walkIn = with_(item("BRK201", "09:00", "Venetian"), { reservable: false });
  const backup = item("ARC402", "10:00", "Venetian");

  it("books single-time sessions first, then hands-on, then by score, with backups", () => {
    const plan = reservationPlan([once, twiceA, twiceB, chalk, walkIn, backup], log(["ARC401", "SVS402-R", "SEC301", "BRK201"], ["ARC402"]));
    // Single-time first (hands-on ARC401 before the chalk talk), then the session that repeats.
    expect(plan.map((r) => r.item.session.id)).toEqual(["ARC401", "SEC301", "SVS402-R"]);
    expect(plan.find((r) => r.item.session.id === "SVS402-R")?.backups.map((b) => b.session.id)).toEqual(["SVS402-R1"]);
    expect(plan.find((r) => r.item.session.id === "ARC401")?.backups.map((b) => b.session.id)).toEqual(["ARC402"]);
  });
});
