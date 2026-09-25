import { z } from "zod";
import { PLATFORMS } from "../taxonomy/taxonomy.js";

/** Eight topics are plenty for a full agenda, even when one of them is AI. */
export const MAX_TOPICS = 8;

/** The attendee's level in each topic they pick: "new" means learn it, the rest mean go deeper. */
export const TOPIC_LEVELS = ["new", "basic", "intermediate", "advanced"] as const;
export type TopicLevel = (typeof TOPIC_LEVELS)[number];

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
 * Formats grouped by who they are mostly aimed at, from the catalog's own target roles on re:Invent 2026: code talks,
 * builders' sessions, workshops and labs over-index on developers, DevOps and architects (1.2–1.5×); chalk talks are
 * the design discussions architects and tech leads favor; breakouts and lightning talks over-index on technical
 * leaders (1.3×) and business, sales and presales roles (1.4–2.3×).
 */
export const FORMAT_GROUPS: { id: string; title: string; audience: string; formats: string[] }[] = [
  { id: "hands-on", title: "Hands-on", audience: "developers, DevOps & architects", formats: ["workshop", "builders", "code", "lab"] },
  { id: "design", title: "Design discussions", audience: "architects & tech leads", formats: ["chalk"] },
  { id: "overview", title: "Overviews & strategy", audience: "managers, leaders, sales & presales", formats: ["breakout", "lightning"] },
  { id: "certification", title: "Certification", audience: "anyone preparing an AWS exam", formats: ["exam"] },
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

const topicSchema = z.object({ key: topicKey, level: z.enum(TOPIC_LEVELS) });

const answersObject = z.object({
  name: z.string().max(80).optional(),
  /** Up to eight topics to learn or go deeper on, each with the attendee's level in it. */
  topics: z
    .array(topicSchema)
    .min(1, "Pick at least one topic")
    .max(MAX_TOPICS)
    .refine((topics) => new Set(topics.map((t) => t.key)).size === topics.length, "Each topic once"),
  /** Vendor platforms that are not relevant to the attendee: sessions built around them are hidden. */
  ignore: z.array(z.enum(PLATFORMS.map((p) => p.id) as [string, ...string[]])).default([]),
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

/**
 * Answers saved before per-topic levels had `known` topics with one global `level` and `learn` topics. Known
 * topics keep that level; topics only in `learn` become new.
 */
function migrateLegacy(input: unknown): unknown {
  if (typeof input !== "object" || input === null || "topics" in input) return input;
  const { known = [], learn = [], level = "intermediate", ...rest } = input as {
    known?: string[];
    learn?: string[];
    level?: string;
  };
  const topics = [
    ...known.map((key) => ({ key, level })),
    ...learn.filter((key) => !known.includes(key)).map((key) => ({ key, level: "new" })),
  ].slice(0, MAX_TOPICS);
  return { ...rest, topics };
}

export const answersSchema = z.preprocess(migrateLegacy, answersObject);

export type Answers = z.infer<typeof answersObject>;
