import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CachedCatalog } from "../src/catalog/cache.js";
import { normalizeSession } from "../src/catalog/normalize.js";
import { answersSchema } from "../src/plan/answers.js";
import { buildPlan, buildVocabulary, expandTopics, interleave } from "../src/plan/plan.js";
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
  it("caps topics at eight, each once, with a level", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ key: `domain:topic-${"abcdefghi"[i]}`, level: "new" }));
    const base = { level: "basic", formats: ["chalk"] };
    expect(answersSchema.safeParse({ ...base, topics: nine }).success).toBe(false);
    expect(answersSchema.safeParse({ ...base, topics: nine.slice(0, 8) }).success).toBe(true);
    expect(answersSchema.safeParse({ ...base, topics: [nine[0], nine[0]] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...base, topics: [{ key: "domain:ai", level: "expert" }] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...base, topics: [{ key: "domain:ai", level: "new" }], formats: [] }).success).toBe(false);
  });

  it("converts answers saved with known/learn and one global level", () => {
    const legacy = answersSchema.parse({
      known: ["domain:serverless", "domain:ai"],
      learn: ["domain:ai", "domain:containers"],
      level: "advanced",
      formats: ["chalk"],
    });
    expect(legacy.topics).toEqual([
      { key: "domain:serverless", level: "advanced" },
      { key: "domain:ai", level: "advanced" },
      { key: "domain:containers", level: "new" },
    ]);
  });

  it("only accepts topics; technologies and practices come with them", () => {
    const one = (key: string) => ({ topics: [{ key, level: "basic" }], formats: ["chalk"] });
    expect(answersSchema.safeParse(one("tech:AWS Lambda")).success).toBe(false);
    expect(answersSchema.safeParse(one("concept:event-driven")).success).toBe(false);
    expect(answersSchema.safeParse(one("domain:serverless")).success).toBe(true);
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
    expect(vocab.platforms.map((p) => p.id)).toEqual(["microsoft", "sap", "vmware", "oracle", "mainframe"]);
    expect(vocab.platforms.every((p) => Array.isArray(p.sessionIds))).toBe(true);
  });
});

describe("AI background", () => {
  const agentSession = (level: string, id = "A1") =>
    session({
      sessionId: id,
      abbreviation: "AIM3" + id,
      title: "Build multi-agent systems with tool use",
      type: "Chalk talk",
      level,
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Agentic AI"],
    });
  const aiAnswers = (ai: Record<string, number>) => answers({ known: ["domain:serverless"], learn: ["domain:ai"], ai });

  it("rejects unknown prerequisites and out-of-range familiarity", () => {
    expect(answersSchema.safeParse({ known: ["domain:ai"], level: "basic", formats: ["chalk"], ai: { quantum: 1 } }).success).toBe(false);
    expect(answersSchema.safeParse({ known: ["domain:ai"], level: "basic", formats: ["chalk"], ai: { llm: 3 } }).success).toBe(false);
  });

  it("leaves AI sessions untouched when the attendee skips the step", () => {
    const skipped = buildPlan([agentSession("300 – Advanced")], aiAnswers({}));
    expect(skipped.results[0]?.reasons.some((r) => /AI background/.test(r.text))).toBe(false);
  });

  it("ranks AI sessions higher when the attendee has the background they assume", () => {
    const ready = buildPlan([agentSession("300 – Advanced")], aiAnswers({ llm: 2, agents: 2, bedrock: 2 })).results[0];
    const partial = buildPlan([agentSession("300 – Advanced")], aiAnswers({ llm: 2, agents: 1, bedrock: 2 })).results[0];
    expect(ready!.score).toBeGreaterThan(partial!.score);
    expect(ready!.reasons.some((r) => r.kind === "pro" && /AI background covers/.test(r.text))).toBe(true);
    expect(partial!.reasons.some((r) => r.kind === "con" && /AI agents & tool use/.test(r.text))).toBe(true);
  });

  it("hides advanced AI sessions the attendee is not ready for, but keeps introductory ones", () => {
    const plan = buildPlan(
      [agentSession("400 – Expert", "A1"), agentSession("100 – Foundational", "A2")],
      aiAnswers({ llm: 0, agents: 0 }),
    );
    expect(plan.hidden.aiNotReady).toBe(1);
    expect(plan.results.map((r) => r.session.id)).toEqual(["A2"]);
  });
});

describe("reserved seating", () => {
  const talk = (id: string, type: string, extra: Record<string, unknown> = {}) =>
    session({
      sessionId: id,
      abbreviation: `SVS30${id}`,
      title: `Scaling Lambda ${id}`,
      type,
      level: "300 – Advanced",
      topics: ["Serverless"],
      services: ["AWS Lambda"],
      ...extra,
    });
  const all = answers({ formats: ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning"] });

  it("puts sessions that need a reserved seat first within an intent", () => {
    const plan = buildPlan([talk("1", "Breakout session"), talk("2", "Chalk talk"), talk("3", "Lightning talk")], all);
    expect(plan.results.map((r) => [r.session.id, r.reservable])).toEqual([
      ["2", true],
      ["1", false],
      ["3", false],
    ]);
    expect(plan.results[0]?.reasons.some((r) => /reserved seat/.test(r.text))).toBe(true);
  });

  it("switches to the catalog's own flag once reserved seating opens", () => {
    const plan = buildPlan([talk("1", "Chalk talk", { isReservable: false }), talk("2", "Breakout session", { isReservable: true })], all);
    const reservable = Object.fromEntries(plan.results.map((r) => [r.session.id, r.reservable]));
    expect(reservable).toEqual({ "1": false, "2": true });
  });
});

describe("platforms you ignore", () => {
  const windows = session({
    sessionId: "W1",
    abbreviation: "SVS311",
    title: "Serverless for Windows workloads",
    type: "Chalk talk",
    level: "300 – Advanced",
    topics: ["Serverless"],
    areasOfInterest: ["Microsoft & .NET"],
  });
  const mentions = session({
    sessionId: "W2",
    abbreviation: "SVS312",
    title: "Serverless data access",
    abstract: "Patterns that also apply to SQL Server.",
    type: "Chalk talk",
    level: "300 – Advanced",
    topics: ["Serverless"],
  });

  it("hides sessions built around an ignored platform and lowers ones that mention it", () => {
    const without = buildPlan([windows, mentions], answers());
    const withIgnore = buildPlan([windows, mentions], answers({ ignore: ["microsoft"] }));
    expect(withIgnore.hidden.ignored).toBe(1);
    expect(withIgnore.results.map((r) => r.session.id)).toEqual(["W2"]);
    const before = without.results.find((r) => r.session.id === "W2")!.score;
    const after = withIgnore.results.find((r) => r.session.id === "W2")!;
    expect(after.score).toBeLessThan(before);
    expect(after.reasons.some((r) => r.kind === "con" && /Microsoft/.test(r.text))).toBe(true);
  });

  it("rejects unknown platforms", () => {
    expect(answersSchema.safeParse({ known: ["domain:ai"], level: "basic", formats: ["chalk"], ignore: ["cobol"] }).success).toBe(false);
  });
});

describe("scores do not saturate", () => {
  it("separates two sessions that max every component except goal coverage", () => {
    const base = { type: "Workshop", level: "300 – Advanced", topics: ["Serverless"], abstract: "Trade-offs, failure modes, multi-Region resilience at scale." };
    const narrow = session({ ...base, sessionId: "N1", abbreviation: "SVS320", title: "Serverless patterns", services: ["AWS Lambda"] });
    const broad = session({
      ...base,
      sessionId: "N2",
      abbreviation: "SVS321",
      title: "Serverless patterns with Step Functions and API Gateway",
      services: ["AWS Lambda", "AWS Step Functions", "Amazon API Gateway"],
    });
    const fixture = [narrow, broad, ...Array.from({ length: 3 }, (_, i) => session({ ...base, sessionId: `F${i}`, abbreviation: `SVS33${i}`, services: ["AWS Lambda", "AWS Step Functions", "Amazon API Gateway"] }))];
    const plan = buildPlan(fixture, answers());
    const score = (id: string) => plan.results.find((r) => r.session.id === id)!.score;
    expect(score("N2")).toBeGreaterThan(score("N1"));
    expect(Math.max(...plan.results.map((r) => r.score))).toBeLessThan(100);
  });
});

describe("level per topic", () => {
  const topics = (level: string) => answers({ topics: [{ key: "domain:serverless", level }] });

  it("judges each session against your level in its topic", () => {
    // Basic aims at 200 and Intermediate at 300, so a 300 session fits Intermediate and stretches Basic.
    const basic = buildPlan([lambda300], topics("basic")).results[0]!;
    const intermediate = buildPlan([lambda300], topics("intermediate")).results[0]!;
    expect(basic.intent).toBe("reinforce");
    expect(intermediate.score).toBeGreaterThan(basic.score);
    expect(basic.reasons[0]?.text).toMatch(/one of your topics \(you are Basic\)/);
    expect(basic.reasons.find((r) => r.about === "level")?.kind).toBe("con");
  });

  it("judges by the technology in the title when you know it less than the track's topic", () => {
    const gitops = session({
      sessionId: "G1",
      abbreviation: "OPN315",
      title: "Bootstrapping GitOps on Amazon EKS with Argo CD",
      type: "Code talk",
      level: "300 – Advanced",
      services: ["Amazon Elastic Kubernetes Service (Amazon EKS)"],
    });
    const plan = (containers: string) =>
      buildPlan(
        [gitops],
        answers({
          formats: ["code"],
          topics: [
            { key: "domain:devtools", level: "intermediate" },
            { key: "domain:containers", level: containers },
          ],
        }),
      ).results[0]!;
    expect(plan("basic").reasons[0]?.text).toMatch(/Goes deeper on Amazon EKS, part of Containers.* \(you are Basic\)/);
    expect(plan("basic").score).toBeLessThan(plan("advanced").score);
    // Known better than the track's topic, the track still decides.
    expect(plan("advanced").reasons[0]?.text).toMatch(/Developer Tools/);
  });

  it("treats a topic marked new as one to learn", () => {
    expect(buildPlan([lambda300], topics("new")).results[0]?.intent).toBe("learn");
  });

  it("mixes levels: advanced in one topic, new in another", () => {
    const plan = buildPlan(
      [lambda300],
      answers({ topics: [{ key: "domain:serverless", level: "advanced" }, { key: "domain:containers", level: "new" }] }),
    );
    expect(plan.context.known).toContain("domain:serverless");
    expect(plan.context.learn).toContain("domain:containers");
  });
});

describe("reason tags", () => {
  it("tags every reason so the card can keep only match, skills and AI", () => {
    const aiSession = session({
      sessionId: "R1",
      abbreviation: "AIM301",
      title: "Agents with Bedrock",
      type: "Chalk talk",
      level: "300 – Advanced",
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Agentic AI"],
      abstract: "Resilience patterns for agents at scale.",
    });
    const plan = buildPlan([aiSession, lambda300], answers({ topics: [{ key: "domain:ai", level: "basic" }, { key: "domain:serverless", level: "intermediate" }], ai: { llm: 2, agents: 1, bedrock: 1 } }));
    const reasons = plan.results.flatMap((r) => r.reasons);
    expect(reasons.every((r) => r.about)).toBe(true);
    const card = (id: string) =>
      plan.results.find((r) => r.session.id === id)!.reasons.filter((r) => ["match", "skills", "ai"].includes(r.about)).map((r) => r.about);
    expect(card("R1")).toEqual(expect.arrayContaining(["match", "ai"]));
    expect(card("R1")[0]).toBe("match");
  });
});

describe("format groups", () => {
  it("place every format choice in exactly one audience group", async () => {
    const { FORMAT_CHOICES, FORMAT_GROUPS } = await import("../src/plan/answers.js");
    const grouped = FORMAT_GROUPS.flatMap((g) => g.formats);
    expect(grouped.sort()).toEqual(FORMAT_CHOICES.map((f) => f.id).sort());
  });
});

// Findings of the persona review (test/personas, npm run personas), kept as regressions.
describe("persona review", () => {
  const talk = (code: string, title: string, level: string, type = "Chalk talk", extra: Record<string, unknown> = {}) =>
    session({ sessionId: code, abbreviation: code, title, type, level, ...extra });
  const everyFormat = ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning", "exam"];

  it("treats 300 (the catalog's Advanced) as at level for an Advanced topic", () => {
    const plan = buildPlan(
      [talk("SEC301", "IAM policy evaluation in depth", "300 – Advanced", "Chalk talk", { topics: ["Security & Identity"] })],
      answers({ topics: [{ key: "domain:security", level: "advanced" }], formats: everyFormat }),
    );
    const item = plan.results[0]!;
    expect(item.fitsLevel).toBe(true);
    expect(item.reasons.find((r) => r.about === "level")?.text).toMatch(/matches your level/);
  });

  it("puts a right-level walk-in ahead of a reservable session at the wrong level", () => {
    const plan = buildPlan(
      [
        talk("SVS401", "Lambda internals", "400 – Expert", "Chalk talk", { topics: ["Serverless"] }),
        talk("SVS301", "Lambda for your team", "300 – Advanced", "Breakout session", { topics: ["Serverless"] }),
      ],
      answers({ topics: [{ key: "domain:serverless", level: "intermediate" }], formats: everyFormat }),
    );
    expect(plan.results.map((r) => r.session.code)).toEqual(["SVS301", "SVS401"]);
  });

  it("hides sessions two levels above a Basic topic, and lets its 300s lead", () => {
    const plan = buildPlan(
      [
        talk("SVS401", "Lambda internals", "400 – Expert", "Chalk talk", { topics: ["Serverless"] }),
        talk("SVS301", "Lambda at scale", "300 – Advanced", "Chalk talk", { topics: ["Serverless"] }),
      ],
      answers({ topics: [{ key: "domain:serverless", level: "basic" }], formats: everyFormat }),
    );
    expect(plan.results.map((r) => [r.session.code, r.fitsLevel])).toEqual([["SVS301", true]]);
    expect(plan.hidden.tooAdvanced).toBe(1);
  });

  it("leaves out new ground two levels above where someone new can start", () => {
    const plan = buildPlan(
      [
        talk("CMP401", "EC2 performance deep dive", "400 – Expert", "Workshop", { topics: ["Compute"] }),
        talk("CMP201", "Getting started with EC2", "200 – Intermediate", "Breakout session", { topics: ["Compute"] }),
      ],
      answers({ topics: [{ key: "domain:compute", level: "new" }], formats: everyFormat }),
    );
    expect(plan.results.map((r) => r.session.code)).toEqual(["CMP201"]);
    expect(plan.hidden.tooAdvanced).toBe(1);
  });

  it("offers entry sessions next to a topic someone wants to learn", () => {
    const plan = buildPlan(
      [talk("CON201", "Launch a container app", "200 – Intermediate", "Builders' session", { topics: ["Containers"] })],
      answers({ topics: [{ key: "domain:compute", level: "new" }], formats: everyFormat }),
    );
    expect(plan.results.map((r) => [r.session.code, r.intent])).toEqual([["CON201", "learn"]]);
  });

  it("never hides a session whose main topic is not AI for lack of AI background", () => {
    const secondary = talk("SEC401", "Agent identity and least privilege", "400 – Expert", "Chalk talk", {
      topics: ["Security & Identity", "Artificial Intelligence"],
      areasOfInterest: ["Agentic AI"],
    });
    const plan = buildPlan([secondary], answers({ topics: [{ key: "domain:security", level: "advanced" }], ai: { llm: 1 }, formats: everyFormat }));
    expect(plan.hidden.aiNotReady).toBe(0);
    expect(plan.results).toHaveLength(1);
  });

  it("lowers, but never hides, AI sessions for questions left unanswered when AI is new or basic", () => {
    const training = talk("AIM301", "Distributed training on Trainium", "300 – Advanced", "Chalk talk", {
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Machine Learning"],
    });
    const scoreWith = (ai: Record<string, number>) =>
      buildPlan([training], answers({ topics: [{ key: "domain:ai", level: "basic" }], ai, formats: everyFormat })).results[0]?.score;
    expect(scoreWith({ llm: 1 })).toBeDefined();
    expect(scoreWith({ llm: 1 })!).toBeLessThan(scoreWith({ llm: 1, ml: 2, training: 2, infra: 2 })!);
    // An explicit "not yet" still hides it.
    expect(buildPlan([training], answers({ topics: [{ key: "domain:ai", level: "basic" }], ai: { llm: 0, ml: 0, training: 0, infra: 0 }, formats: everyFormat })).hidden.aiNotReady).toBe(1);
  });

  it("does not let architecture wording outrank someone's own topic unless they picked Architecture", () => {
    const resilience = talk("ANT301", "Cross-region disaster recovery trade-offs at scale for analytics", "300 – Advanced", "Chalk talk", {
      topics: ["Analytics"],
      abstract: "Failure modes, blast radius, multi-region failover and the trade-offs of consistency at scale.",
    });
    const spark = talk("ANT302", "Tuning Apache Spark jobs", "300 – Advanced", "Chalk talk", { topics: ["Analytics"], abstract: "Spark tuning." });
    const score = (topics: { key: string; level: string }[]) => {
      const plan = buildPlan([resilience, spark], answers({ topics, formats: everyFormat }));
      const of = (code: string) => plan.results.find((r) => r.session.code === code)!.score;
      return of("ANT301") - of("ANT302");
    };
    const dataEngineer = score([{ key: "domain:analytics", level: "advanced" }]);
    const architect = score([{ key: "domain:analytics", level: "advanced" }, { key: "domain:architecture", level: "advanced" }]);
    expect(dataEngineer).toBeLessThan(architect);
    expect(dataEngineer).toBeLessThanOrEqual(5);
  });

  it("keeps Learn short when nothing is marked new", () => {
    const far = Array.from({ length: 60 }, (_, i) =>
      talk(`STG2${String(i).padStart(2, "0")}`, `Storage story ${i}`, "200 – Intermediate", "Breakout session", { topics: ["Storage"] }),
    );
    // Storage is two steps from Serverless (through Databases): explored, but at most 8 sessions of one topic.
    const plan = buildPlan(far, answers({ topics: [{ key: "domain:serverless", level: "intermediate" }], formats: everyFormat }));
    const learn = plan.results.filter((r) => r.intent === "learn").length;
    expect(learn).toBeGreaterThan(0);
    expect(learn).toBeLessThanOrEqual(8);
  });

  it("leaves out sessions reserved for AWS Partners", () => {
    const partners = talk("TNC210", "Partner bootcamp", "200 – Intermediate", "Bootcamp", {
      topics: ["Serverless"],
      abstract: "A bootcamp for AWS Partners only.",
    });
    const plan = buildPlan([partners], answers({ topics: [{ key: "domain:serverless", level: "basic" }], formats: everyFormat }));
    expect(plan.results).toHaveLength(0);
  });

  it("says a technology comes from a picked topic instead of claiming the attendee knows it", () => {
    const plan = buildPlan(
      [talk("CON301", "Scaling Amazon EKS clusters", "200 – Intermediate", "Chalk talk", { topics: ["Containers"], services: ["Amazon Elastic Kubernetes Service (Amazon EKS)"] })],
      answers({ topics: [{ key: "domain:containers", level: "basic" }], formats: everyFormat }),
    );
    const match = plan.results[0]!.reasons.find((r) => r.about === "match")!.text;
    expect(match).toMatch(/Containers/);
  });
});

it("never lets the Learn cap drop a session the attendee already picked", () => {
  const talk = (i: number) =>
    session({ sessionId: `STG${i}`, abbreviation: `STG2${String(i).padStart(2, "0")}`, title: `Storage story ${i}`, type: "Breakout session", level: "200 – Intermediate", topics: ["Storage"] });
  const far = Array.from({ length: 60 }, (_, i) => talk(i));
  const opts = { topics: [{ key: "domain:serverless", level: "intermediate" }], formats: ["breakout"] };
  expect(buildPlan(far, answers(opts)).results.some((r) => r.session.id === "STG59")).toBe(false);
  expect(buildPlan(far, answers(opts), new Set(["STG59"])).results.some((r) => r.session.id === "STG59")).toBe(true);
});

describe("persona review, round two", () => {
  const talk = (code: string, title: string, level: string, type = "Chalk talk", extra: Record<string, unknown> = {}) =>
    session({ sessionId: code, abbreviation: code, title, type, level, ...extra });
  const everyFormat = ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning", "exam"];

  it("lets a better walk-in beat a reservable session at the same level", () => {
    const plan = buildPlan(
      [
        talk("MAM301", "Migration chalk talk", "200 – Intermediate", "Chalk talk", { topics: ["Migration & Modernization"] }),
        talk("MAM206", "How United Airlines migrated: lessons learned", "200 – Intermediate", "Breakout session", {
          topics: ["Migration & Modernization", "Architecture"],
          services: ["AWS Application Migration Service", "AWS Database Migration Service"],
        }),
      ],
      answers({ topics: [{ key: "domain:migration", level: "basic" }, { key: "domain:architecture", level: "basic" }], formats: everyFormat }),
    );
    expect(plan.results[0]!.session.code).toBe("MAM206");
  });

  it("deals Reinforce topic by topic, two cards per round for an Advanced topic", () => {
    expect(interleave(["s1", "s2", "s3", "a1", "a2", "n1"], (x) => x[0]!, (g) => (g === "s" ? 2 : 1))).toEqual([
      "s1", "s2", "a1", "n1", "s3", "a2",
    ]);
    const arc = (i: number) => talk(`ARC30${i}`, `Resilience patterns ${i}`, "300 – Advanced", "Chalk talk", { topics: ["Architecture"], abstract: "Failure modes, blast radius and trade-offs at scale." });
    const sec = (i: number) => talk(`SEC30${i}`, `IAM deep dive ${i}`, "300 – Advanced", "Chalk talk", { topics: ["Security & Identity"] });
    const plan = buildPlan(
      [arc(1), arc(2), arc(3), sec(1), sec(2), sec(3)],
      answers({ topics: [{ key: "domain:security", level: "advanced" }, { key: "domain:architecture", level: "intermediate" }], formats: everyFormat }),
    );
    expect(plan.results.slice(0, 3).filter((r) => r.session.code.startsWith("SEC")).length).toBeGreaterThanOrEqual(2);
  });

  it("judges whether a session leads by the strongest topic it is about", () => {
    // As in the catalog, SageMaker AI is one of the AI topic's technologies.
    const sagemaker = (i: number) =>
      talk(`AIM31${i}`, `SageMaker session ${i}`, "300 – Advanced", "Chalk talk", { topics: ["Artificial Intelligence"], services: ["Amazon SageMaker AI"] });
    const plan = buildPlan(
      [sagemaker(1), sagemaker(2), sagemaker(3), talk("CON313", "Scalable inference on Amazon EKS", "300 – Advanced", "Chalk talk", {
        topics: ["Artificial Intelligence", "Containers"],
        services: ["Amazon Elastic Kubernetes Service (Amazon EKS)", "Amazon SageMaker AI"],
      })],
      answers({ topics: [{ key: "domain:ai", level: "advanced" }, { key: "domain:containers", level: "basic" }], ai: { llm: 2, ml: 2, infra: 2, training: 2, agents: 2, rag: 2, mcp: 2, eval: 2, bedrock: 2 }, formats: everyFormat }),
    );
    expect(plan.results.find((r) => r.session.code === "CON313")!.fitsLevel).toBe(true);
  });

  it("treats an agent lab filed under Learning as an AI session", () => {
    const lab = talk("TNC215", "Build your first AI agent", "200 – Intermediate", "Lab", { areasOfInterest: ["Agentic AI", "Training & Certification"] });
    const noAi = { llm: 0, ml: 0, rag: 0, agents: 0, mcp: 0, training: 0, eval: 0, infra: 0, bedrock: 0 };
    const plan = buildPlan([lab], answers({ topics: [{ key: "domain:compute", level: "new" }, { key: "domain:learning", level: "new" }], ai: noAi, formats: everyFormat }));
    expect(plan.hidden.aiNotReady).toBe(1);
  });

  it("does not say AI background covers a session when it is all 'not yet'", () => {
    const intro = talk("AIM101", "Introduction to generative AI", "100 – Foundational", "Breakout session", { topics: ["Artificial Intelligence"], areasOfInterest: ["Generative AI"] });
    const plan = buildPlan([intro], answers({ topics: [{ key: "domain:ai", level: "new" }], ai: { llm: 0, bedrock: 0 }, formats: everyFormat }));
    expect(plan.results[0]!.reasons.some((r) => /covers what it assumes/.test(r.text))).toBe(false);
  });

  it("never lets a sponsored session lead", () => {
    const plan = buildPlan(
      [talk("AIM227-S", "Partner AI platform (sponsored by Example)", "200 – Intermediate", "Breakout session", { topics: ["Artificial Intelligence"] })],
      answers({ topics: [{ key: "domain:ai", level: "basic" }], formats: everyFormat }),
    );
    expect(plan.results[0]!.fitsLevel).toBe(false);
  });

  it("recognizes a service named only in the abstract", () => {
    const listed = talk("AIM401", "Train models", "300 – Advanced", "Workshop", { topics: ["Artificial Intelligence"], services: ["Amazon SageMaker AI"] });
    const unlisted = talk("AIM404", "Deploy inference endpoints", "300 – Advanced", "Workshop", {
      topics: ["Artificial Intelligence"],
      abstract: "Host models on Amazon SageMaker AI endpoints and connect them to your apps.",
    });
    const plan = buildPlan([listed, unlisted], answers({ topics: [{ key: "domain:ai", level: "advanced" }], formats: everyFormat }));
    expect(plan.results.find((r) => r.session.code === "AIM404")!.keys).toContain("tech:Amazon SageMaker AI");
    expect(plan.results.find((r) => r.session.code === "AIM404")!.keys).not.toContain("tech:Amazon Connect");
  });

  it("files senior-leader sessions under Leadership and partner sessions under Partners", () => {
    const plan = buildPlan(
      [
        talk("SNR304", "How AI changes the way Amazon works", "300 – Advanced", "Breakout session"),
        talk("PEX313", "Sell through AWS Marketplace", "300 – Advanced", "Chalk talk"),
      ],
      answers({ topics: [{ key: "domain:leadership", level: "intermediate" }], formats: everyFormat }),
    );
    const snr = plan.results.find((r) => r.session.code === "SNR304")!;
    expect(snr.intent).toBe("reinforce");
    expect(plan.results.find((r) => r.session.code === "PEX313")?.intent).not.toBe("reinforce");
  });
});

describe("persona review, round three", () => {
  const talk = (code: string, title: string, level: string, type = "Chalk talk", extra: Record<string, unknown> = {}) =>
    session({ sessionId: code, abbreviation: code, title, type, level, ...extra });
  const everyFormat = ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning", "exam"];

  it("reads service names in text without false matches", async () => {
    const { servicesInText, technologyLabel, textAliases } = await import("../src/taxonomy/tagger.js");
    const labels = ["Amazon Bedrock", "Amazon Bedrock AgentCore", "Amazon EKS", technologyLabel("AWS GovCloud (US)")];
    const known = new Map(labels.map((l) => [l, textAliases(l)]));
    expect(technologyLabel("AWS GovCloud (US)")).toBe("AWS GovCloud (US)");
    expect(servicesInText("Join us to build with Amazon Bedrock AgentCore on EKS", known)).toEqual(["Amazon Bedrock AgentCore", "Amazon EKS"]);
    expect(servicesInText("teams that seek to join us", known)).toEqual([]);
  });

  it("files gamified sessions under their catalog topic", () => {
    const tabletop = talk("GHJ201", "Cloud Migration Journey Tabletop", "200 – Intermediate", "Gamified learning", { topics: ["Migration & Modernization"] });
    const plan = buildPlan([tabletop], answers({ topics: [{ key: "domain:migration", level: "basic" }], ai: { llm: 0 }, formats: everyFormat }));
    expect(plan.results.map((r) => r.intent)).toEqual(["reinforce"]);
  });

  it("ranks deep training and inference sessions first for an ML engineer", () => {
    const ml = { llm: 2, ml: 2, rag: 2, agents: 2, mcp: 2, training: 2, eval: 2, infra: 2, bedrock: 2 };
    const workshop = talk("AIM404", "Deploy fine-tuned models to inference endpoints", "300 – Advanced", "Workshop", {
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Machine Learning"],
    });
    const generic = talk("AIM363", "From foundation to business value with generative AI", "300 – Advanced", "Workshop", {
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Generative AI"],
    });
    const plan = buildPlan([generic, workshop], answers({ topics: [{ key: "domain:ai", level: "advanced" }], ai: ml, formats: everyFormat }));
    expect(plan.results[0]!.session.code).toBe("AIM404");
  });

  it("puts a session in Learn only for a learning goal it is about", () => {
    const mention = talk("API306", "Event routing patterns with EventBridge", "200 – Intermediate", "Chalk talk", {
      topics: ["Application Integration"],
      abstract: "Route events between services. We also touch on MCP servers.",
    });
    const plan = buildPlan([mention], answers({ topics: [{ key: "domain:security", level: "advanced" }, { key: "domain:ai", level: "new" }], formats: everyFormat }));
    expect(plan.results.find((r) => r.session.code === "API306")?.reasons[0]?.text ?? "").not.toMatch(/Covers MCP/);
  });
});

describe("persona review, round four", () => {
  const talk = (code: string, title: string, level: string, type = "Chalk talk", extra: Record<string, unknown> = {}) =>
    session({ sessionId: code, abbreviation: code, title, type, level, ...extra });
  const everyFormat = ["workshop", "builders", "chalk", "code", "lab", "breakout", "lightning", "exam"];

  it("leads Learn with AI sessions about the attendee's strongest topic when AI is new", () => {
    const bridge = talk("AIM327", "Secure AI the same way you secure everything else", "300 – Advanced", "Chalk talk", {
      topics: ["Artificial Intelligence"],
      areasOfInterest: ["Generative AI"],
    });
    const mention = talk("IND317", "Industry story with a touch of AI", "300 – Advanced", "Chalk talk", {
      topics: ["Industry Solutions", "Artificial Intelligence"],
      areasOfInterest: ["Generative AI"],
    });
    const plan = buildPlan(
      [mention, bridge],
      answers({ topics: [{ key: "domain:security", level: "advanced" }, { key: "domain:ai", level: "new" }], ai: { llm: 1 }, formats: everyFormat }),
    );
    expect(plan.results.filter((r) => r.intent === "learn")[0]?.session.code).toBe("AIM327");
  });

  it("files an Amazon engineering story under its catalog topic, a leadership one under Leadership", () => {
    const plan = buildPlan(
      [
        talk("AMZ302", "Zero-trust by design: how Bee protects personal data", "300 – Advanced", "Breakout session", { topics: ["Security & Identity"] }),
        talk("AMZ301", "How Amazon leaders build a culture of invention", "300 – Advanced", "Breakout session"),
      ],
      answers({ topics: [{ key: "domain:leadership", level: "intermediate" }, { key: "domain:security", level: "intermediate" }], formats: everyFormat }),
    );
    const topicOf = (code: string) => plan.results.find((r) => r.session.code === code)!.keys[0];
    expect(topicOf("AMZ302")).toBe("domain:security");
    expect(topicOf("AMZ301")).toBe("domain:leadership");
  });

  it("does not read post-quantum cryptography as quantum computing", () => {
    const plan = buildPlan(
      [talk("GHJ203", "Post-Quantum Cryptography Tabletop Experience", "200 – Intermediate", "Gamified learning", { topics: ["Security & Identity"] })],
      answers({ topics: [{ key: "domain:security", level: "basic" }, { key: "domain:compute", level: "basic" }], formats: everyFormat }),
    );
    expect(plan.results[0]!.keys).not.toContain("domain:compute");
  });

  it("keeps a thin session out of a weaker topic's slot", () => {
    const strong = (i: number) =>
      talk(`ANT30${i}`, `Streaming analytics with Apache Iceberg ${i}`, "300 – Advanced", "Chalk talk", { topics: ["Analytics"] });
    const thin = talk("DAT313", "Oracle Database@AWS", "300 – Advanced", "Chalk talk", { topics: ["Databases"] });
    const plan = buildPlan(
      [strong(1), strong(2), strong(3), strong(4), thin],
      answers({ topics: [{ key: "domain:analytics", level: "advanced" }, { key: "domain:databases", level: "intermediate" }], formats: everyFormat }),
    );
    expect(plan.results.filter((r) => r.intent === "reinforce").at(-1)?.session.code).toBe("DAT313");
  });
});

describe("learning from picks", () => {
  const talk = (code: string, title: string, services: string[], level = "300 – Advanced") =>
    session({ sessionId: code, abbreviation: code, title, type: "Chalk talk", level, topics: ["Containers"], services });
  // A catalog big enough that three ECS sessions are a specific technology (under 5%).
  const filler = Array.from({ length: 80 }, (_, i) => talk(`CMP${300 + i}`, `Compute talk ${i}`, [`Service ${i}`]));
  const picked = talk("CON318", "Resilient deployment pipelines with Amazon ECS", ["Amazon Elastic Container Service (Amazon ECS)"]);
  const alike = talk("CON202", "Launch a container app with Amazon ECS", ["Amazon Elastic Container Service (Amazon ECS)"], "200 – Intermediate");
  const other = talk("CON301", "Kubernetes networking", ["Amazon Elastic Kubernetes Service (Amazon EKS)"], "200 – Intermediate");
  const opts = answers({ topics: [{ key: "domain:containers", level: "basic" }], formats: ["chalk"] });

  it("lifts sessions sharing a specific technology with two ❤️ picks, and says so", () => {
    const without = buildPlan([...filler, picked, talk("CON320", "Blue/green deployments on Amazon ECS", ["Amazon Elastic Container Service (Amazon ECS)"]), alike, other], opts);
    const second = talk("CON320", "Blue/green deployments on Amazon ECS", ["Amazon Elastic Container Service (Amazon ECS)"]);
    const withPick = buildPlan([...filler, picked, second, alike, other], opts, new Set(["CON318", "CON320"]), new Set(["CON318", "CON320"]));
    const score = (plan: typeof without, code: string) => plan.results.find((r) => r.session.code === code)!.score;
    expect(score(withPick, "CON202")).toBeGreaterThan(score(without, "CON202"));
    expect(score(withPick, "CON301")).toBe(score(without, "CON301"));
    const reason = withPick.results.find((r) => r.session.code === "CON202")!.reasons.find((r) => r.about === "affinity");
    expect(reason?.text).toMatch(/Like CON318 and CON320, which you ❤️: Amazon ECS/);
    // A single pick is not a pattern yet.
    const onePick = buildPlan([...filler, picked, alike, other], opts, new Set(["CON318"]), new Set(["CON318"]));
    expect(onePick.results.find((r) => r.session.code === "CON202")!.reasons.some((r) => r.about === "affinity")).toBe(false);
  });
});
