import type { EventsClient } from "../api/client.js";
import type { BulkFailure } from "../api/types.js";
import type { SwipeLog } from "../store/swipes.js";

/** AssociateFavorites accepts 1-10 distinct session IDs per request. */
const BATCH_SIZE = 10;

export interface FavoritesPlan {
  toAdd: string[];
  toRemove: string[];
}

/**
 * ❤️ becomes a favorite. ❌ removes a favorite only if the attendee had favorited it, so favorites made in the
 * portal are never touched unless the attendee explicitly passed on that session here. 🔖 changes nothing.
 */
export function planFavorites(swipes: SwipeLog, currentFavorites: string[]): FavoritesPlan {
  const current = new Set(currentFavorites);
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const [sessionId, { decision }] of Object.entries(swipes)) {
    if (decision === "like" && !current.has(sessionId)) toAdd.push(sessionId);
    if (decision === "pass" && current.has(sessionId)) toRemove.push(sessionId);
  }
  return { toAdd: toAdd.sort(), toRemove: toRemove.sort() };
}

export interface FavoritesSyncResult extends FavoritesPlan {
  added: string[];
  removed: string[];
  failed: (BulkFailure & { action: "add" | "remove" })[];
  /** Favorites as the API reports them after the sync. */
  favorites: string[];
}

export async function syncFavorites(
  client: EventsClient,
  eventId: string,
  swipes: SwipeLog,
): Promise<FavoritesSyncResult> {
  const before = await client.getSchedule(eventId);
  const plan = planFavorites(swipes, before.favorites);
  const added: string[] = [];
  const removed: string[] = [];
  const failed: FavoritesSyncResult["failed"] = [];

  for (let i = 0; i < plan.toAdd.length; i += BATCH_SIZE) {
    const result = await client.associateFavorites(eventId, plan.toAdd.slice(i, i + BATCH_SIZE));
    added.push(...result.successful);
    // Already a favorite is the outcome we wanted, not a failure.
    for (const f of result.failed) {
      if (f.code === "alreadyFavorited") added.push(f.sessionId);
      else failed.push({ ...f, action: "add" });
    }
  }
  for (const sessionId of plan.toRemove) {
    try {
      await client.disassociateFavorite(eventId, sessionId);
      removed.push(sessionId);
    } catch {
      failed.push({ sessionId, code: "other", action: "remove" });
    }
  }

  // Writes can partially fail; the schedule is the source of truth.
  const after = await client.getSchedule(eventId);
  return { ...plan, added, removed, failed, favorites: after.favorites };
}
