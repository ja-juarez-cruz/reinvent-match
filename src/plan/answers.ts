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
 * Attendees pick topics ("domain:serverless"); the plan expands each one to its technologies ("tech:AWS Lambda") and
 * concepts ("concept:event-driven"), so the caps count topics, not tags.
 */
const topicKey = z.string().regex(/^domain:[a-z-]+$/, "Pick topics, such as domain:serverless");

export const answersSchema = z.object({
  name: z.string().max(80).optional(),
  known: z.array(topicKey).min(1, "Pick at least one topic you know").max(MAX_KNOWN),
  learn: z.array(topicKey).max(MAX_LEARN).default([]),
  level: z.enum(LEVELS),
  formats: z
    .array(z.string())
    .min(1, "Pick at least one format")
    .refine((ids) => ids.every((id) => FORMAT_CHOICES.some((f) => f.id === id)), "Unknown format"),
});

export type Answers = z.infer<typeof answersSchema>;
