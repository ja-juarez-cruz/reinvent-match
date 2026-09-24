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
