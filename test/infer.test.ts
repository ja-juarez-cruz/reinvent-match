import { describe, expect, it } from "vitest";
import { answersSchema } from "../src/plan/answers.js";
import { inferAnswers } from "../src/plan/infer.js";
import { session } from "./helpers.js";

describe("inferAnswers", () => {
  const fav = (code: string, level: string, type: string, topics: string[]) =>
    session({ sessionId: code, abbreviation: code, title: code, type, level, topics });

  it("drafts topics, levels, formats and platforms from favorites", () => {
    const draft = inferAnswers([
      fav("SVS301", "300 – Advanced", "Chalk talk", ["Serverless"]),
      fav("SVS302", "300 – Advanced", "Workshop", ["Serverless"]),
      fav("SVS201", "200 – Intermediate", "Chalk talk", ["Serverless"]),
      fav("CON202", "200 – Intermediate", "Builders' session", ["Containers"]),
    ])!;
    expect(draft.answers.topics).toEqual([
      { key: "domain:serverless", level: "intermediate" },
      { key: "domain:containers", level: "basic" },
    ]);
    expect(draft.answers.formats.sort()).toEqual(["builders", "chalk", "workshop"]);
    expect(draft.answers.ignore).toContain("sap");
    expect(draft.basis[0]).toEqual({ key: "domain:serverless", favorites: 3 });
    expect(answersSchema.safeParse(draft.answers).success).toBe(true);
  });

  it("has nothing to say without favorites", () => {
    expect(inferAnswers([])).toBeNull();
  });
});
