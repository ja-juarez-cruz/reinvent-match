import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildAgenda } from "../web/src/agenda.js";
import { buildQueue } from "../web/src/queue.js";
import { baseCode, distinctSessions, repeatsOf, settledSessions } from "../web/src/repeats.js";
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

describe("repeats", () => {
  const first = item("SVS335-R", "10:00", "Venetian");
  const second = item("SVS335-R1", "14:00", "Venetian", 60, "2026-12-02");
  const other = item("ARC309", "12:00", "Venetian");
  const all = [first, second, other];

  it("groups the times of one session by its base code", () => {
    expect(baseCode("SVS335-R1")).toBe("SVS335");
    expect(baseCode("ARC309")).toBe("ARC309");
    expect(repeatsOf(all).get(first.session.id)?.map((i) => i.session.code)).toEqual(["SVS335-R1"]);
    expect(repeatsOf(all).has(other.session.id)).toBe(false);
  });

  it("skips the other times of a session you already ❤️ or ❌", () => {
    for (const log of [swipes(["SVS335-R"]), swipes([], ["SVS335-R"])]) {
      const q = buildQueue(all, log, buildWeek(all, log), false, settledSessions(all, log));
      expect(q.queue.map((i) => i.session.code)).toEqual(["ARC309"]);
    }
  });

  it("keeps the other times open after a 🔖 maybe", () => {
    const log: SwipeLog = { [first.session.id]: { decision: "save", at } };
    expect(settledSessions(all, log).size).toBe(0);
  });

  it("flags a session picked at two times and counts it once", () => {
    const log = swipes(["SVS335-R", "SVS335-R1"]);
    const agenda = buildAgenda(all, log, buildWeek(all, log));
    const pick = agenda.days.flatMap((d) => d.picks).find((p) => p.item === first)!;
    expect(pick.repeats.map((i) => i.session.code)).toEqual(["SVS335-R1"]);
    expect(distinctSessions([first, second, other])).toHaveLength(2);
  });
});
