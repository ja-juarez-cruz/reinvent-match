import type { EventsClient } from "../api/client.js";
import type { BulkFailure } from "../api/types.js";

/** ReserveSessions accepts 1-10 distinct session IDs per request. */
const BATCH_SIZE = 10;

export interface ReservationResult {
  /** Sessions this request reserved, or found already reserved. */
  reserved: string[];
  /** Sessions the API refused, with why (sessionFull, scheduleConflict…). */
  failed: BulkFailure[];
  /** Every reservation the API reports after the request: the source of truth. */
  schedule: string[];
}

/**
 * Reserves sessions in the order given (the attendee's booking priority), ten at a time, skipping ones already
 * reserved. Seats go to whoever asks first, so order matters: a batch never mixes in a later priority ahead of an
 * earlier one.
 */
export async function reserveInOrder(client: EventsClient, eventId: string, sessionIds: string[]): Promise<ReservationResult> {
  const before = new Set((await client.getSchedule(eventId)).reserved);
  const todo = sessionIds.filter((id) => !before.has(id));
  const reserved = sessionIds.filter((id) => before.has(id));
  const failed: BulkFailure[] = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const result = await client.reserveSessions(eventId, todo.slice(i, i + BATCH_SIZE));
    reserved.push(...result.successful);
    // Already on the schedule is the outcome we wanted, not a failure.
    for (const f of result.failed) {
      if (f.code === "alreadyScheduled") reserved.push(f.sessionId);
      else failed.push(f);
    }
  }
  // Writes can partially fail; the schedule is the source of truth.
  const after = await client.getSchedule(eventId);
  return { reserved, failed, schedule: after.reserved };
}

/** Cancels one reservation and returns the reservations the API reports afterwards. */
export async function cancelAndReload(client: EventsClient, eventId: string, sessionId: string): Promise<string[]> {
  await client.cancelReservation(eventId, sessionId);
  return (await client.getSchedule(eventId)).reserved;
}
