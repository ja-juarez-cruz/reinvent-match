import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CachedCatalog } from "../src/catalog/cache.js";
import { normalizeSession } from "../src/catalog/normalize.js";
import { CATEGORIES, matchSession, matchSessions } from "../src/match/engine.js";
import { profile, serverlessEngineer, session } from "./helpers.js";

describe("categories", () => {
  it("skips an introduction to a service the attendee already masters", () => {
    const result = matchSession(
      session({ title: "Introduction to Amazon DynamoDB", level: "100 – Foundational", services: ["Amazon DynamoDB"] }),
      serverlessEngineer,
    );
    expect(result.category).toBe("skip");
    expect(result.reasons[0]?.text).toMatch(/below your proficiency in "Amazon DynamoDB"/);
  });

  it("marks an advanced session on a known service one step up as Deep Dive", () => {
    const result = matchSession(
      session({ title: "Step Functions at scale", level: "400 – Expert", services: ["AWS Step Functions"] }),
      serverlessEngineer,
    );
    expect(result.category).toBe("deep-dive");
    expect(result.reasons.some((r) => r.kind === "pro" && /one step above/.test(r.text))).toBe(true);
  });

  it("marks a session on a grow concept found in the title as Growth", () => {
    const result = matchSession(
      session({ title: "Cross-region failover patterns", level: "300 – Advanced", type: "Chalk talk" }),
      serverlessEngineer,
    );
    expect(result.category).toBe("growth");
    expect(result.hits[0]?.interest.name).toBe("Multi-Region");
  });

  it("treats a 200-level session on a grow topic you barely know as Foundation", () => {
    const result = matchSession(session({ title: "Multi-Region basics", level: "200 – Intermediate" }), serverlessEngineer);
    expect(result.category).toBe("foundation");
  });

  it("marks an introductory session on an explore topic as Foundation", () => {
    const result = matchSession(
      session({ level: "100 – Foundational", services: ["Amazon Elastic Kubernetes Service (Amazon EKS)"] }),
      serverlessEngineer,
    );
    expect(result.category).toBe("foundation");
  });

  it("finds adjacent concepts the attendee did not ask for as Discovery", () => {
    const result = matchSession(
      session({ title: "Implementing the saga pattern for distributed transactions" }),
      serverlessEngineer,
    );
    expect(result.category).toBe("discovery");
    expect(result.reasons[0]?.text).toMatch(/builds on "AWS Step Functions"/);
  });

  it("does not promote a passing abstract mention beyond Discovery", () => {
    const result = matchSession(
      session({ title: "Lakehouse with Apache Iceberg", abstract: "A reference architecture for analytics." }),
      serverlessEngineer,
    );
    expect(result.category).toBe("discovery");
  });

  it("prefers an exact tag over a partial one", () => {
    const p = profile({
      interests: [
        { name: "Architecture", bucket: "grow", proficiency: 1 },
        { name: "Event-Driven Architecture", bucket: "grow", proficiency: 1 },
      ],
    });
    const result = matchSession(session({ areasOfInterest: ["Event-Driven Architecture"] }), p);
    expect(result.hits[0]?.interest.name).toBe("Event-Driven Architecture");
  });

  it("skips ignored topics, restricted programs and keynotes", () => {
    expect(matchSession(session({ areasOfInterest: ["SAP"] }), serverlessEngineer).category).toBe("skip");
    expect(
      matchSession(session({ services: ["AWS Lambda"], experiences: ["Executive Summit"] }), serverlessEngineer).category,
    ).toBe("skip");
    expect(matchSession(session({ type: "Keynote", services: ["AWS Lambda"] }), serverlessEngineer).category).toBe(
      "skip",
    );
  });

  it("flags sessions with no overlap as unrelated", () => {
    const result = matchSession(session({ title: "Satellite ground stations" }), serverlessEngineer);
    expect(result).toMatchObject({ category: "skip", unrelated: true, score: 0 });
  });
});

describe("scoring", () => {
  it("ranks an interactive format above a recorded one, all else equal", () => {
    const base = { title: "Resilient serverless with Step Functions", services: ["AWS Step Functions"] };
    const chalk = matchSession(session({ ...base, type: "Chalk talk" }), serverlessEngineer);
    const breakout = matchSession(session({ ...base, type: "Breakout session" }), serverlessEngineer);
    expect(chalk.category).toBe(breakout.category);
    expect(chalk.score).toBeGreaterThan(breakout.score);
  });

  it("honors custom weights", () => {
    const onlyFormat = profile({
      interests: [{ name: "AWS Lambda", bucket: "know", proficiency: 1 }],
      weights: { goalAlignment: 0, levelFit: 0, irreplaceability: 0, formatPreference: 1, archDepth: 0 },
      formatPreferences: { workshop: 0.9 },
    });
    const result = matchSession(session({ type: "Workshop", services: ["AWS Lambda"] }), onlyFormat);
    expect(result.score).toBe(90);
  });
});

describe("real catalog (Summit Dubai 2026 snapshot)", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("./fixtures/summit-dubai-2026.json", import.meta.url), "utf8"),
  ) as CachedCatalog;
  const example = profile(JSON.parse(readFileSync(new URL("../examples/profile.example.json", import.meta.url), "utf8")));
  const results = matchSessions(catalog.sessions.map(normalizeSession), example);

  it("matches every session and sorts by category then score", () => {
    expect(results.length).toBe(catalog.sessions.filter((s) => !/^breaks?$/i.test(s.type ?? "")).length);
    for (let i = 1; i < results.length; i++) {
      const [prev, cur] = [results[i - 1]!, results[i]!];
      const order = CATEGORIES.indexOf(prev.category) - CATEGORIES.indexOf(cur.category);
      expect(order < 0 || (order === 0 && prev.score >= cur.score)).toBe(true);
    }
  });

  it("explains every non-skip recommendation with at least one reason in favor", () => {
    for (const r of results.filter((r) => r.category !== "skip")) {
      expect(r.reasons.some((reason) => reason.kind === "pro"), r.session.code).toBe(true);
    }
  });
});

describe("confidence", () => {
  it("scores abstract-only evidence below the same session tagged in the catalog", () => {
    const base = { type: "Chalk talk", level: "300 – Advanced" };
    const tagged = matchSession(session({ ...base, areasOfInterest: ["Multi-Region"] }), serverlessEngineer);
    const mentioned = matchSession(
      session({ ...base, abstract: "We touch on multi-region briefly." }),
      serverlessEngineer,
    );
    expect(mentioned.score).toBeLessThan(tagged.score);
  });
});
