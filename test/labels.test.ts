import { describe, expect, it } from "vitest";
import { aliasesOf, aliasMatches, textContains } from "../src/match/labels.js";

describe("aliasesOf", () => {
  it("strips vendor prefixes and keeps the parenthetical short name", () => {
    expect(aliasesOf("Amazon Elastic Kubernetes Service (Amazon EKS)")).toEqual(["elastic kubernetes service", "eks"]);
    expect(aliasesOf("AWS Lambda")).toEqual(["lambda"]);
  });

  it("removes accents so localized labels line up", () => {
    expect(aliasesOf("Analítica")).toEqual(["analitica"]);
  });
});

describe("aliasMatches", () => {
  it("only matches short aliases exactly", () => {
    expect(aliasMatches("eks", "eks")).toBe(true);
    expect(aliasMatches("s3", "s3 glacier")).toBe(false);
  });

  it("finds longer aliases inside a tag on word boundaries", () => {
    expect(aliasMatches("kafka", "managed streaming for apache kafka")).toBe(true);
    expect(aliasMatches("lambda", "lambdas")).toBe(false);
  });
});

describe("textContains", () => {
  it("treats hyphens and spaces as interchangeable", () => {
    expect(textContains("design a multi region backend", "multi-region")).toBe(true);
    expect(textContains("design a multiregion backend", "multi-region")).toBe(true);
  });

  it("respects word boundaries", () => {
    expect(textContains("using iam roles", "iam")).toBe(true);
    expect(textContains("the diameter", "iam")).toBe(false);
  });
});
