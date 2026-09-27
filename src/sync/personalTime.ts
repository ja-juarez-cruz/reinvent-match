import type { EventsClient } from "../api/client.js";
import type { PersonalTime, PersonalTimeInput } from "../api/types.js";

/** Blocks Reinvent:Match adds end their description with this, so a re-sync only ever touches its own. */
export const PERSONAL_TIME_MARK = "Planned with Reinvent:Match";

export interface PersonalTimeSyncResult {
  created: number;
  /** Blocks of the same kind on the same day that moved (lunch at another time): updated in place. */
  updated: number;
  deleted: number;
  kept: number;
  failed: { title: string; startDateTime: string; message: string }[];
  /** Every personal time entry the event reports afterwards. */
  personalTime: PersonalTime[];
}

const sameBlock = (a: PersonalTimeInput, b: PersonalTimeInput) =>
  a.startDateTime === b.startDateTime && a.endDateTime === b.endDateTime && a.title === b.title;

/**
 * Makes the Reinvent:Match blocks on the attendee's schedule (lunch, walks, free time) match `blocks`: its old
 * blocks that no longer apply are removed, identical ones kept, new ones added. Personal time the attendee created
 * elsewhere is never touched.
 */
export async function syncPersonalTime(
  client: EventsClient,
  eventId: string,
  blocks: PersonalTimeInput[],
): Promise<PersonalTimeSyncResult> {
  const ours = (await client.getSchedule(eventId)).personalTime.filter((p) => p.description.includes(PERSONAL_TIME_MARK));
  const wanted = blocks.map((b) => ({
    ...b,
    description: b.description.includes(PERSONAL_TIME_MARK)
      ? b.description
      : `${b.description} · ${PERSONAL_TIME_MARK}`.slice(0, 250),
  }));
  const failed: PersonalTimeSyncResult["failed"] = [];
  let deleted = 0;
  let created = 0;
  let updated = 0;
  // Old blocks no longer wanted as they are: reused for a moved block of the same kind and day, else removed.
  const stale = ours.filter((old) => !wanted.some((w) => sameBlock(w, old)));
  const day = (t: string) => t.slice(0, 10);
  for (const block of wanted) {
    if (ours.some((o) => sameBlock(o, block))) continue;
    const reuse = stale.findIndex((o) => o.title === block.title && day(o.startDateTime) === day(block.startDateTime));
    try {
      if (reuse >= 0) {
        await client.updatePersonalTime(eventId, stale[reuse]!.personalTimeId, block);
        stale.splice(reuse, 1);
        updated += 1;
      } else {
        await client.createPersonalTime(eventId, block);
        created += 1;
      }
    } catch (e) {
      failed.push({ title: block.title, startDateTime: block.startDateTime, message: e instanceof Error ? e.message : String(e) });
    }
  }
  for (const old of stale) {
    await client.deletePersonalTime(eventId, old.personalTimeId);
    deleted += 1;
  }
  const after = await client.getSchedule(eventId);
  return {
    created,
    updated,
    deleted,
    kept: wanted.length - created - updated - failed.length,
    failed,
    personalTime: after.personalTime,
  };
}
