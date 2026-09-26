import { describe, expect, it } from "vitest";
import type { PlanItem, SwipeLog } from "../web/src/types.js";
import { buildAgenda } from "../web/src/agenda.js";
import { buildQueue } from "../web/src/queue.js";
import { baseCode, distinctSessions, repeatsOf, seriesOf, settledSessions } from "../web/src/repeats.js";
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

describe("series", () => {
  const titled = (code: string, title: string) => {
    const i = item(code, "10:00", "Venetian");
    i.session.title = title;
    return i;
  };
  const rodeo = [
    titled("GHJ318", "re:Architecture Rodeo: Designing Agentic AI Applications"),
    titled("GHJ319", "re:Architecture Rodeo: Architecting AI Governance & Security at Scale"),
  ];
  const lookalikes = [titled("AIM249-S", "FinOps for AI: Cost basics"), titled("COP311-R1", "FinOps for AI: Allocation")];

  it("groups different sessions that share a track and a title prefix", () => {
    const series = seriesOf([...rodeo, ...lookalikes]);
    expect(series.get(rodeo[0]!.session.id)).toMatchObject({ name: "re:Architecture Rodeo" });
    expect(series.get(rodeo[0]!.session.id)?.others.map((o) => o.session.code)).toEqual(["GHJ319"]);
    expect(series.has(lookalikes[0]!.session.id)).toBe(false);
  });
});

it("treats a sponsored run with the same track, format and title as the same session", () => {
  const titled = (code: string, title: string, date = "2026-12-01") => {
    const i = item(code, "09:00", "Caesars Palace", 180, date);
    i.session.title = title;
    return i;
  };
  const jam = titled("GHJ311", "AWS Jam: All-in Builder Showdown");
  const sponsored = titled("GHJ317-S", "AWS Jam: All-in Builder Showdown - brought to you by Example", "2026-12-03");
  const breakout = titled("AIM216", "Accelerate document processing");
  breakout.session.format = "breakout";
  const chalk = titled("AIM355-R", "Accelerate document processing");
  expect(repeatsOf([jam, sponsored]).get(jam.session.id)?.map((i) => i.session.code)).toEqual(["GHJ317-S"]);
  expect(seriesOf([jam, sponsored]).size).toBe(0);
  expect(repeatsOf([breakout, chalk]).size).toBe(0);
});
