import { describe, expect, it } from "vitest";
import { buildLearningPlan } from "../web/src/learningPlan.js";
import type { PlanContext, PlanItem } from "../web/src/types.js";

const context: PlanContext = {
  known: ["domain:serverless", "tech:Amazon DynamoDB"],
  learn: ["domain:architecture"],
  knownDomains: ["serverless", "databases"],
  neighborDomains: ["integration", "analytics"],
  techDomain: { "AWS Lambda": "serverless", "Amazon DynamoDB": "databases", "Amazon EventBridge": "integration", "Amazon Bedrock": "ai" },
  labels: {},
};

function item(id: string, keys: string[], date = "2026-12-01", time = "10:00"): PlanItem {
  return {
    intent: "reinforce",
    reservable: true,
    goalHits: 1,
    score: 80,
    reasons: [],
    keys,
    learningStyle: "hands-on",
    session: {
      id,
      code: id,
      title: id,
      abstract: "",
      format: "workshop",
      formatLabel: "Workshop",
      levelLabel: "300",
      isSponsored: false,
      mayRepeat: false,
      speakers: [],
      schedule: { date, startTime: time, durationMin: 60, venue: null, room: null },
    },
  };
}

describe("buildLearningPlan", () => {
  const items = [
    item("A", ["domain:serverless", "tech:AWS Lambda", "tech:Amazon DynamoDB", "concept:resilience", "domain:architecture"]),
    item("B", ["domain:integration", "tech:Amazon EventBridge", "tech:Amazon Bedrock"], "2026-12-01", "10:30"),
    item("C", ["domain:analytics"]),
  ];
  const at = "2026-09-24T00:00:00Z";
  const plan = buildLearningPlan(items, { A: { decision: "like", at }, B: { decision: "like", at }, C: { decision: "save", at } }, context);
  const keys = (group: keyof typeof plan) => (plan[group] as { key: string }[]).map((e) => e.key);

  it("only counts liked sessions", () => {
    expect(plan.sessions).toBe(2);
    expect(plan.hours).toBe(2);
  });

  it("puts known tags and technologies of a known topic in Reinforce", () => {
    expect(keys("reinforce")).toEqual(expect.arrayContaining(["domain:serverless", "tech:AWS Lambda", "tech:Amazon DynamoDB"]));
  });

  it("separates skills, explicit learning goals, broadening and new ground", () => {
    expect(keys("skills")).toEqual(["concept:resilience"]);
    expect(keys("learn")).toEqual(expect.arrayContaining(["domain:architecture", "tech:Amazon Bedrock"]));
    expect(keys("broaden")).toEqual(expect.arrayContaining(["domain:integration", "tech:Amazon EventBridge"]));
  });

  it("counts overlapping picks", () => {
    expect(plan.conflicts).toBe(1);
  });
});
