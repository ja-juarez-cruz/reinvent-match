import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CachedCatalog } from "../src/catalog/cache.js";
import { normalizeSession } from "../src/catalog/normalize.js";
import { answersSchema } from "../src/plan/answers.js";
import { buildPlan, buildVocabulary, expandTopics } from "../src/plan/plan.js";
import { session } from "./helpers.js";

const answers = (over: Record<string, unknown> = {}) =>
  answersSchema.parse({
    known: ["domain:serverless"],
    level: "intermediate",
    formats: ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning"],
    ...over,
  });

const lambda300Raw = {
  sessionId: "S1",
  abbreviation: "SVS301",
  title: "Scaling Lambda functions",
  type: "Chalk talk",
  level: "300 – Advanced",
  topics: ["Serverless"],
  services: ["AWS Lambda"],
};
const lambda300 = session(lambda300Raw);

describe("answers", () => {
  it("caps the topics you know and want to learn", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `domain:topic-${"abcdefghi"[i]}`);
    expect(answersSchema.safeParse({ known: nine, level: "basic", formats: ["chalk"] }).success).toBe(false);
    expect(answersSchema.safeParse({ known: ["domain:ai"], learn: nine.slice(0, 6), level: "basic", formats: ["chalk"] }).success).toBe(false);
    expect(answersSchema.safeParse({ known: ["domain:ai"], level: "basic", formats: [] }).success).toBe(false);
  });

  it("only accepts topics; technologies and practices come with them", () => {
    expect(answersSchema.safeParse({ known: ["tech:AWS Lambda"], level: "basic", formats: ["chalk"] }).success).toBe(false);
    expect(answersSchema.safeParse({ known: ["concept:event-driven"], level: "basic", formats: ["chalk"] }).success).toBe(false);
    expect(answersSchema.safeParse({ known: ["domain:serverless"], level: "basic", formats: ["chalk"] }).success).toBe(true);
  });
});

describe("expandTopics", () => {
  it("adds each topic's technologies and concepts once", () => {
    const relations = { serverless: ["tech:AWS Lambda", "concept:event-driven"], integration: ["tech:Amazon SQS", "concept:event-driven"] };
    expect(expandTopics(["domain:serverless", "domain:integration"], relations)).toEqual([
      "domain:serverless",
      "tech:AWS Lambda",
      "concept:event-driven",
      "domain:integration",
      "tech:Amazon SQS",
    ]);
  });
});

describe("buildPlan", () => {
  it("reinforces what you know at your level or above", () => {
    const [item] = buildPlan([lambda300], answers()).results;
    expect(item?.intent).toBe("reinforce");
    expect(item?.reasons[0]?.text).toMatch(/Goes deeper on/);
  });

  it("hides sessions too basic for your level on what you know", () => {
    const intro = session({ ...lambda300Raw, sessionId: "S2", abbreviation: "SVS101", level: "100 – Foundational" });
    const plan = buildPlan([intro], answers({ level: "advanced" }));
    expect(plan.results).toHaveLength(0);
    expect(plan.hidden.tooBasic).toBe(1);
  });

  it("only keeps the formats you picked", () => {
    const plan = buildPlan([lambda300], answers({ formats: ["workshop"] }));
    expect(plan.results).toHaveLength(0);
    expect(plan.hidden.format).toBe(1);
  });

  it("broadens into neighboring topics and learns what you asked for", () => {
    const eventBridge = session({
      sessionId: "S3",
      abbreviation: "API301",
      title: "Event routing with EventBridge",
      type: "Chalk talk",
      topics: ["Application Integration"],
      services: ["Amazon EventBridge"],
    });
    const kafka = session({
      sessionId: "S4",
      abbreviation: "ANT201",
      title: "Streaming with Kafka",
      type: "Workshop",
      level: "200 – Intermediate",
      topics: ["Analytics"],
    });
    const plan = buildPlan([eventBridge, kafka], answers({ learn: ["domain:analytics"] }));
    const intentOf = (id: string) => plan.results.find((r) => r.session.id === id)?.intent;
    expect(intentOf("S3")).toBe("broaden");
    expect(intentOf("S4")).toBe("learn");
  });

  it("drops unrelated sessions once you name what you want to learn", () => {
    const quantum = session({ sessionId: "S5", abbreviation: "CMP301", title: "Quantum circuits", topics: ["Compute"] });
    const plan = buildPlan([quantum], answers({ learn: ["domain:analytics"] }));
    expect(plan.results).toHaveLength(0);
  });

  it("treats the technologies of a known topic as known", () => {
    // Two Lambda sessions tag AWS Lambda often enough to be part of the Serverless topic.
    const other = session({ ...lambda300Raw, sessionId: "S6", abbreviation: "SVS302", title: "Lambda cold starts" });
    const plan = buildPlan([lambda300, other], answers());
    expect(plan.context.known).toEqual(expect.arrayContaining(["domain:serverless", "tech:AWS Lambda"]));
  });

  it("returns the context the UI needs to build the learning plan", () => {
    const plan = buildPlan([lambda300], answers());
    expect(plan.context.knownDomains).toContain("serverless");
    expect(plan.context.neighborDomains).toContain("integration");
    expect(plan.context.labels["domain:serverless"]).toBe("Serverless");
  });
});

describe("buildVocabulary", () => {
  it("offers topics, technologies and concepts from the catalog with counts", () => {
    const catalog = JSON.parse(
      readFileSync(new URL("./fixtures/summit-dubai-2026.json", import.meta.url), "utf8"),
    ) as CachedCatalog;
    const vocab = buildVocabulary(catalog.sessions.map(normalizeSession));
    expect(vocab.domains[0]?.key).toBe("domain:ai");
    expect(vocab.technologies.find((t) => t.key === "tech:Amazon Bedrock")?.count).toBeGreaterThan(10);
    expect(vocab.technologies.every((t) => t.domain)).toBe(true);
    const ai = vocab.domains.find((d) => d.key === "domain:ai");
    expect(ai?.related).toContain("tech:Amazon Bedrock");
  });
});
