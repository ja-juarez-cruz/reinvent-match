import { z } from "zod";

export const MAX_KNOWN = 8;
export const MAX_LEARN = 5;

export const LEVELS = ["basic", "intermediate", "advanced"] as const;
export type SelfLevel = (typeof LEVELS)[number];

/** Format choices shown to the attendee, each covering one or more catalog formats. */
export const FORMAT_CHOICES: { id: string; label: string; formats: string[] }[] = [
  { id: "workshop", label: "Workshops & bootcamps", formats: ["workshop", "bootcamp"] },
  { id: "builders", label: "Builders' sessions", formats: ["builders-session"] },
  { id: "chalk", label: "Chalk talks", formats: ["chalk-talk", "dev-chat"] },
  { id: "code", label: "Code talks", formats: ["code-talk"] },
  { id: "lab", label: "Labs & gamified", formats: ["lab", "gamified"] },
  { id: "breakout", label: "Breakouts & panels", formats: ["breakout", "panel", "other"] },
  { id: "lightning", label: "Lightning talks", formats: ["lightning-talk"] },
  { id: "exam", label: "Certification prep", formats: ["exam-prep"] },
];

/**
 * Tag keys are "<kind>:<id>": "domain:serverless", "tech:Amazon DynamoDB", "concept:event-driven". They point into
 * the taxonomy so matching is set-based instead of free-text.
 */
const tagKey = z.string().regex(/^(domain|tech|concept):.+$/, "Tag keys look like domain:serverless or tech:Amazon SQS");

export const answersSchema = z.object({
  name: z.string().max(80).optional(),
  known: z.array(tagKey).min(1, "Pick at least one thing you know").max(MAX_KNOWN),
  learn: z.array(tagKey).max(MAX_LEARN).default([]),
  level: z.enum(LEVELS),
  formats: z
    .array(z.string())
    .min(1, "Pick at least one format")
    .refine((ids) => ids.every((id) => FORMAT_CHOICES.some((f) => f.id === id)), "Unknown format"),
});

export type Answers = z.infer<typeof answersSchema>;
