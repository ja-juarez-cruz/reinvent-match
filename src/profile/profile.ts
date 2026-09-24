import { readFile } from "node:fs/promises";
import { z } from "zod";

export const BUCKETS = ["know", "grow", "explore", "ignore"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const GOALS = ["deepen-known", "learn-new", "architecture-role", "hands-on", "networking"] as const;
export type Goal = (typeof GOALS)[number];

/** Proficiency assumed when a profile entry does not state one. */
export const DEFAULT_PROFICIENCY: Record<Bucket, number> = { know: 2, grow: 1, explore: 0, ignore: 0 };

const interestSchema = z.object({
  /** A catalog tag ("AWS Lambda", "Agentic AI") or a free concept ("multi-region"). */
  name: z.string().min(1),
  bucket: z.enum(BUCKETS),
  /** 0 none, 1 basic, 2 practical, 3 advanced. */
  proficiency: z.number().int().min(0).max(3).optional(),
  /** Extra words to look for in titles and abstracts, for concepts the catalog does not tag. */
  keywords: z.array(z.string().min(1)).optional(),
});

const weightsSchema = z.object({
  goalAlignment: z.number().min(0),
  levelFit: z.number().min(0),
  irreplaceability: z.number().min(0),
  formatPreference: z.number().min(0),
  archDepth: z.number().min(0),
});

export type Weights = z.infer<typeof weightsSchema>;

export const DEFAULT_WEIGHTS: Weights = {
  goalAlignment: 0.3,
  levelFit: 0.25,
  irreplaceability: 0.2,
  formatPreference: 0.15,
  archDepth: 0.1,
};

export const profileSchema = z.object({
  name: z.string().optional(),
  interests: z.array(interestSchema).min(1),
  goals: z.array(z.enum(GOALS)).default([]),
  /** 0-1 preference per format, e.g. { "chalk-talk": 1, "breakout": 0.4 }. Unlisted formats default to 0.5. */
  formatPreferences: z.record(z.string(), z.number().min(0).max(1)).default({}),
  weights: weightsSchema.partial().default({}),
});

export type Profile = z.infer<typeof profileSchema>;
export type Interest = z.infer<typeof interestSchema>;

export function proficiencyOf(interest: Interest): number {
  return interest.proficiency ?? DEFAULT_PROFICIENCY[interest.bucket];
}

export function weightsOf(profile: Profile): Weights {
  return { ...DEFAULT_WEIGHTS, ...profile.weights };
}

export async function loadProfile(path: string): Promise<Profile> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const result = profileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid profile ${path}:\n${issues}`);
  }
  return result.data;
}
