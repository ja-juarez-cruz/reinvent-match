import type { Session } from "../src/api/types.js";
import { normalizeSession, type NormalizedSession } from "../src/catalog/normalize.js";
import { profileSchema, type Profile } from "../src/profile/profile.js";

export function session(overrides: Partial<Session> = {}): NormalizedSession {
  return normalizeSession({
    sessionId: "TST101",
    title: "Test session",
    abstract: "",
    type: "Breakout session",
    level: "300 – Advanced",
    ...overrides,
  });
}

export function profile(input: Record<string, unknown>): Profile {
  return profileSchema.parse(input);
}

export const serverlessEngineer = profile({
  goals: ["architecture-role"],
  interests: [
    { name: "AWS Lambda", bucket: "know", proficiency: 3 },
    { name: "Amazon DynamoDB", bucket: "know", proficiency: 3 },
    { name: "AWS Step Functions", bucket: "know", proficiency: 2 },
    { name: "Architecture", bucket: "grow", proficiency: 1 },
    { name: "Multi-Region", bucket: "grow", proficiency: 1, keywords: ["cross-region"] },
    { name: "EKS", bucket: "explore" },
    { name: "SAP", bucket: "ignore" },
  ],
});
