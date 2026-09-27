import { describe, expect, it, vi } from "vitest";
import { EventsClient } from "../src/api/client.js";
import { PERSONAL_TIME_MARK, syncPersonalTime } from "../src/sync/personalTime.js";

const block = (start: string, end: string, title: string) => ({
  startDateTime: start,
  endDateTime: end,
  title,
  description: "Lunch break",
});

describe("syncPersonalTime", () => {
  it("replaces only its own blocks: keeps identical ones, removes stale ones, adds new ones", async () => {
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const mine = { personalTimeId: "user", startDateTime: "2026-12-01T20:00:00", endDateTime: "2026-12-01T21:00:00", title: "Dinner", description: "With friends" };
    const oldKept = { personalTimeId: "k", ...block("2026-12-01T19:00:00", "2026-12-01T20:00:00", "🍽 Lunch"), description: `Lunch · ${PERSONAL_TIME_MARK}` };
    const oldStale = { personalTimeId: "s", ...block("2026-12-02T19:00:00", "2026-12-02T20:00:00", "🍽 Lunch"), description: `Lunch · ${PERSONAL_TIME_MARK}` };
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: [], personalTime: [mine, oldKept, oldStale] });
    const del = vi.spyOn(client, "deletePersonalTime").mockResolvedValue();
    const create = vi.spyOn(client, "createPersonalTime").mockResolvedValue();

    const update = vi.spyOn(client, "updatePersonalTime").mockResolvedValue();

    const result = await syncPersonalTime(client, "reinvent2026", [
      block("2026-12-01T19:00:00", "2026-12-01T20:00:00", "🍽 Lunch"),
      // Lunch on Dec 2 moved half an hour: the old block is updated in place.
      block("2026-12-02T19:30:00", "2026-12-02T20:30:00", "🍽 Lunch"),
      block("2026-12-03T19:30:00", "2026-12-03T20:30:00", "🍽 Lunch"),
    ]);

    expect(update.mock.calls.map(([, id]) => id)).toEqual(["s"]);
    expect(del).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1].description).toContain(PERSONAL_TIME_MARK);
    expect(result).toMatchObject({ created: 1, updated: 1, deleted: 0, kept: 1, failed: [] });
  });

  it("removes its blocks that no longer apply", async () => {
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const old = { personalTimeId: "o", ...block("2026-12-02T19:00:00", "2026-12-02T20:00:00", "☕ Free time"), description: `x · ${PERSONAL_TIME_MARK}` };
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: [], personalTime: [old] });
    const del = vi.spyOn(client, "deletePersonalTime").mockResolvedValue();
    const result = await syncPersonalTime(client, "e", []);
    expect(del.mock.calls.map(([, id]) => id)).toEqual(["o"]);
    expect(result.deleted).toBe(1);
  });
});

describe("EventsClient personal time", () => {
  it("posts a block and deletes one by id", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const client = new EventsClient({ fetchImpl, getAccessToken: async () => "t" });
    await client.createPersonalTime("reinvent2026", block("2026-12-01T19:00:00", "2026-12-01T20:00:00", "Lunch"));
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://api.awsevents.com/v1/events/reinvent2026/personal-time");
    expect(fetchImpl.mock.calls[0]![1]?.method).toBe("POST");
    await client.deletePersonalTime("reinvent2026", "p1");
    expect(String(fetchImpl.mock.calls[1]![0])).toBe("https://api.awsevents.com/v1/events/reinvent2026/personal-time/p1");
    expect(fetchImpl.mock.calls[1]![1]?.method).toBe("DELETE");
  });
});
