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
 * Background an AI session assumes, and which AI subtopics (see ../taxonomy/taxonomy.ts) rely on it. With 71% of
 * re:Invent sessions touching AI, this is what separates the ones an attendee can get the most out of.
 */
export const AI_PREREQUISITES: { id: string; label: string; hint: string; subtopics: string[] }[] = [
  { id: "llm", label: "LLMs & prompting", hint: "How large language models behave, context windows, prompt design", subtopics: ["generative-ai", "agentic-ai", "rag", "ai-dev"] },
  { id: "ml", label: "Machine learning fundamentals", hint: "Training vs. inference, features, overfitting, metrics", subtopics: ["ml-training", "ai-infra"] },
  { id: "rag", label: "Embeddings, vector search & RAG", hint: "Grounding answers in your own data", subtopics: ["rag"] },
  { id: "agents", label: "AI agents & tool use", hint: "Agents that plan, call tools and act in loops", subtopics: ["agentic-ai", "mcp"] },
  { id: "mcp", label: "Model Context Protocol (MCP)", hint: "Connecting models to tools and data through MCP servers", subtopics: ["mcp"] },
  { id: "training", label: "Training, fine-tuning & MLOps", hint: "Customizing models and running them in production", subtopics: ["ml-training"] },
  { id: "eval", label: "Evaluation, guardrails & responsible AI", hint: "Measuring quality, safety and hallucinations", subtopics: ["responsible-ai"] },
  { id: "infra", label: "GPUs, accelerators & inference", hint: "Serving models efficiently: Trainium, Inferentia, GPUs", subtopics: ["ai-infra"] },
  { id: "bedrock", label: "Amazon Bedrock", hint: "Using foundation models through Bedrock and AgentCore", subtopics: ["generative-ai", "agentic-ai"] },
];

/** 0 not yet, 1 some, 2 comfortable. */
export const AI_FAMILIARITY = ["Not yet", "Some", "Comfortable"] as const;

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
  /** Optional AI background; only answered prerequisites affect scoring. */
  ai: z
    .record(
      z.enum(AI_PREREQUISITES.map((p) => p.id) as [string, ...string[]]),
      z.number().int().min(0).max(AI_FAMILIARITY.length - 1),
    )
    .default({}),
  formats: z
    .array(z.string())
    .min(1, "Pick at least one format")
    .refine((ids) => ids.every((id) => FORMAT_CHOICES.some((f) => f.id === id)), "Unknown format"),
});

export type Answers = z.infer<typeof answersSchema>;
