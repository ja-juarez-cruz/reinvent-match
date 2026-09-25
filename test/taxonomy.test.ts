import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CachedCatalog } from "../src/catalog/cache.js";
import { normalizeSession } from "../src/catalog/normalize.js";
import { buildReport } from "../src/taxonomy/report.js";
import { tagSession, technologyLabel } from "../src/taxonomy/tagger.js";
import { session } from "./helpers.js";

describe("tagSession", () => {
  it("takes the main topic from the AWS track in the session code", () => {
    const tags = tagSession(
      session({ abbreviation: "SVS325", title: "Distributed transactions with Step Functions", topics: ["Serverless", "Architecture"] }),
    );
    expect(tags.track).toEqual({ code: "SVS", label: "Serverless" });
    expect(tags.primaryDomain).toBe("serverless");
    expect(tags.domains).toEqual(expect.arrayContaining(["serverless", "architecture"]));
  });

  it("falls back to the first catalog topic when the track has no domain", () => {
    expect(tagSession(session({ abbreviation: "INV502", topics: ["Security & Identity"] })).primaryDomain).toBe("security");
  });

  it("tags technologies from services and from the text", () => {
    const tags = tagSession(
      session({
        services: ["Amazon Managed Streaming for Apache Kafka (Amazon MSK)"],
        abstract: "Stream events with Kafka and trace them with OpenTelemetry.",
      }),
    );
    expect(tags.technologies).toEqual(expect.arrayContaining(["Amazon MSK", "Apache Kafka", "OpenTelemetry"]));
    expect(tags.domains).toContain("analytics");
  });

  it("groups catalog roles into audiences and leaves unknowns empty", () => {
    const tags = tagSession(session({ roles: ["Solution / Systems Architect", "DevOps Engineer", "IT Executive"] }));
    expect(tags.audiences).toEqual(["architect", "devops", "tech-leader"]);
    expect(tagSession(session()).audiences).toEqual([]);
  });

  it("derives learning style, content types, AI subtopics and concepts", () => {
    const tags = tagSession(
      session({
        abbreviation: "AIM410",
        type: "Workshop",
        level: "400 – Expert",
        title: "Build multi-agent systems with MCP",
        abstract: "Design for failover and multi-Region resilience; trade-offs at scale.",
        areasOfInterest: ["Agentic AI"],
      }),
    );
    expect(tags.learningStyle).toBe("hands-on");
    expect(tags.level).toBe("400+");
    expect(tags.aiSubtopics).toEqual(expect.arrayContaining(["agentic-ai", "mcp"]));
    expect(tags.contentTypes).toEqual(expect.arrayContaining(["deep-technical", "patterns"]));
    expect(tags.concepts).toEqual(expect.arrayContaining(["resilience", "multi-region"]));
  });

  it("does not read AI into a non-AI session from a keyword inside another word", () => {
    const tags = tagSession(session({ abbreviation: "NET210", title: "Designing your VPC for scale" }));
    expect(tags.domains).not.toContain("ai");
    expect(tags.aiSubtopics).toEqual([]);
  });

  it("shortens service names to their common form", () => {
    expect(technologyLabel("Amazon Elastic Kubernetes Service (Amazon EKS)")).toBe("Amazon EKS");
    expect(technologyLabel("AWS Lambda")).toBe("AWS Lambda");
  });
});

describe("buildReport", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("./fixtures/summit-dubai-2026.json", import.meta.url), "utf8"),
  ) as CachedCatalog;
  const report = buildReport("Summit-Dubai-2026", catalog.fetchedAt, catalog.sessions.map(normalizeSession));

  it("assigns every session exactly one main topic", () => {
    const total = report.dimensions.primaryDomain.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(report.total);
    expect(report.sessions).toHaveLength(catalog.sessions.length);
  });

  it("builds cross-tabs consistent with the main-topic counts", () => {
    const { rows, cells } = report.crossTabs.domainByLevel;
    rows.forEach((row, i) => {
      const expected = report.dimensions.primaryDomain.find((b) => b.id === row.id)!.count;
      expect(cells[i]!.reduce((a, b) => a + b, 0)).toBe(expected);
    });
  });

  it("orders levels from foundational to expert", () => {
    const ids = report.dimensions.level.map((b) => b.id);
    expect(ids).toEqual([...ids].sort((a, b) => ["100", "200", "300", "400+", "none"].indexOf(a) - ["100", "200", "300", "400+", "none"].indexOf(b)));
  });
});

describe("platforms", () => {
  it("tells a session built around a platform from one that only mentions it", () => {
    const built = tagSession(
      session({ title: "Build and test HA/DR architectures for Microsoft workloads", areasOfInterest: ["Microsoft & .NET"] }),
    );
    expect(built.platforms).toEqual(["microsoft"]);
    const mention = tagSession(session({ title: "Resilient databases", abstract: "Covers Aurora, and SQL Server too." }));
    expect(mention.platforms).toEqual([]);
    expect(mention.platformMentions).toEqual(["microsoft"]);
  });

  it("does not file Microsoft, SAP or VMware sessions under Migration by themselves", () => {
    const tags = tagSession(session({ abbreviation: "NET201", areasOfInterest: ["VMware", "SAP"], title: "Networking for VMware" }));
    expect(tags.domains).not.toContain("migration");
    expect(tags.platforms).toEqual(expect.arrayContaining(["vmware", "sap"]));
  });
});
