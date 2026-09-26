import type { Intent } from "./types";

/** How each intent reads across the app; its color is the `--reinforce` / `--broaden` / `--learn` token. */
export const INTENT_META: Record<Intent, { label: string; icon: string; hint: string }> = {
  reinforce: { label: "Reinforce", icon: "💪", hint: "Go deeper on what you already know, at your level or above." },
  broaden: { label: "Broaden", icon: "🧭", hint: "Take what you know into neighboring topics." },
  learn: { label: "Learn", icon: "🌱", hint: "New topics, at an entry level that fits your experience." },
};

export const INTENTS: Intent[] = ["reinforce", "broaden", "learn"];
