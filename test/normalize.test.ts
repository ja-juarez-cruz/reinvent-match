import { describe, expect, it } from "vitest";
import { parseFormat, parseLevel } from "../src/catalog/normalize.js";
import { session } from "./helpers.js";

describe("parseLevel", () => {
  it.each([
    ["300 – Advanced", 2],
    ["100 (Beginner)", 0],
    ["200", 1],
    ["400 – Expert", 3],
    ["500 - Distinguished", 3],
    ["No Level", null],
    [undefined, null],
  ])("%s -> %s", (label, expected) => {
    expect(parseLevel(label)).toBe(expected);
  });
});

describe("parseFormat", () => {
  it.each([
    ["Chalk talk", "chalk-talk"],
    ["Charlas explicativas", "chalk-talk"],
    ["Charla de código", "code-talk"],
    ["Builders' session", "builders-session"],
    ["Breakout session", "breakout"],
    ["Sesión grupal", "breakout"],
    ["Charlas relámpago", "lightning-talk"],
    ["Breaks", "break"],
    ["Workshop", "workshop"],
    ["Something new", "other"],
  ])("%s -> %s", (label, expected) => {
    expect(parseFormat(label)).toBe(expected);
  });
});

describe("normalizeSession", () => {
  it("derives interaction, sponsorship and customer-story flags", () => {
    const s = session({
      abbreviation: "PRT303-S",
      title: "How Acme scaled payments (sponsored by Acme)",
      features: ["Discussion"],
    });
    expect(s.discussion).toBe(true);
    expect(s.isSponsored).toBe(true);
    expect(s.isCustomerStory).toBe(true);
  });

  it("scores architecture depth from design signals and the Architecture topic", () => {
    const shallow = session({ abstract: "Learn how to create a table." });
    const deep = session({
      topics: ["Architecture"],
      abstract: "Trade-offs of multi-region designs, failure modes and consistency at scale.",
    });
    expect(shallow.archDepth).toBe(0);
    expect(deep.archDepth).toBe(3);
  });
});

describe("venue and repeats", () => {
  it("takes the venue from the room when the venue field is missing", () => {
    const s = session({ room: "Wynn/Encore | Upper Convention Promenade | Cristal 2" });
    expect(s.schedule.venue).toBe("Wynn/Encore");
    expect(session({ venue: "MGM Grand", room: "Level 3 | Room 304" }).schedule.venue).toBe("MGM Grand");
    expect(session({ room: "Room 304" }).schedule.venue).toBeNull();
  });

  it("flags -R codes as likely to repeat and maps bootcamps as hands-on", () => {
    expect(session({ abbreviation: "ARC409-R" }).mayRepeat).toBe(true);
    const bootcamp = session({ type: "Bootcamp" });
    expect(bootcamp.format).toBe("bootcamp");
    expect(bootcamp.handsOn).toBe(true);
  });
});

describe("architecture depth signals", () => {
  it("recognizes operating-at-scale talks as architectural", () => {
    const s = session({
      title: "Operating Serverless at scale: What changes at 1000+ functions",
      abstract:
        "What works at 10 Lambda functions may not work at 1,000. A single misconfigured function triggers account-level throttling. We discuss account structure and concurrency management to prevent blast radius problems, platform engineering patterns, and where the common pitfalls are.",
    });
    expect(s.archDepth).toBe(3);
  });

  it("does not read AI guardrails or AI governance as architecture", () => {
    const s = session({ title: "Responsible AI", abstract: "Set guardrails and AI governance for your models." });
    expect(s.archDepth).toBe(0);
  });
});
