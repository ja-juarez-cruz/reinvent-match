import { join } from "node:path";
import { rematchHome } from "../paths.js";
import { readJson, safeFileName, writeJson } from "./jsonFile.js";

export const DECISIONS = ["like", "pass", "save"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface SwipeRecord {
  decision: Decision;
  at: string;
}

/** Decisions are per event, not per profile: liking a session is about the attendee, not the lens. */
export type SwipeLog = Record<string, SwipeRecord>;

function swipesPath(eventId: string): string {
  return join(rematchHome(), "swipes", `${safeFileName(eventId)}.json`);
}

export async function loadSwipes(eventId: string): Promise<SwipeLog> {
  return (await readJson<SwipeLog>(swipesPath(eventId))) ?? {};
}

export async function recordSwipe(eventId: string, sessionId: string, decision: Decision | null): Promise<SwipeLog> {
  const log = await loadSwipes(eventId);
  if (decision === null) delete log[sessionId];
  else log[sessionId] = { decision, at: new Date().toISOString() };
  await writeJson(swipesPath(eventId), log);
  return log;
}
