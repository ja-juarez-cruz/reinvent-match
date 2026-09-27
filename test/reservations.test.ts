import { describe, expect, it, vi } from "vitest";
import { EventsClient } from "../src/api/client.js";
import { cancelAndReload, reserveInOrder } from "../src/sync/reservations.js";

const schedule = (reserved: string[]) => ({ reserved, favorites: [], personalTime: [] });

describe("reserveInOrder", () => {
  it("reserves in priority order, ten at a time, skipping ones already reserved", async () => {
    const ids = Array.from({ length: 13 }, (_, i) => `S${String(i).padStart(2, "0")}`);
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const reserve = vi.spyOn(client, "reserveSessions").mockImplementation(async (_e, batch) => ({
      successful: batch.filter((id) => id !== "S05" && id !== "S07"),
      failed: [
        ...(batch.includes("S05") ? [{ sessionId: "S05", code: "sessionFull" }] : []),
        ...(batch.includes("S07") ? [{ sessionId: "S07", code: "alreadyScheduled" }] : []),
      ],
    }));
    vi.spyOn(client, "getSchedule")
      .mockResolvedValueOnce(schedule(["S00"]))
      .mockResolvedValueOnce(schedule(ids.filter((id) => id !== "S05")));

    const result = await reserveInOrder(client, "reinvent2026", ids);

    expect(reserve.mock.calls.map(([, batch]) => batch)).toEqual([ids.slice(1, 11), ids.slice(11)]);
    expect(result.failed).toEqual([{ sessionId: "S05", code: "sessionFull" }]);
    expect(result.reserved).toContain("S00");
    expect(result.reserved).toContain("S07");
    expect(result.schedule).not.toContain("S05");
  });

  it("does not call the API when everything is already reserved", async () => {
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const reserve = vi.spyOn(client, "reserveSessions");
    vi.spyOn(client, "getSchedule").mockResolvedValue(schedule(["A"]));
    expect((await reserveInOrder(client, "e", ["A"])).reserved).toEqual(["A"]);
    expect(reserve).not.toHaveBeenCalled();
  });
});

describe("cancelAndReload", () => {
  it("cancels and returns the reservations left", async () => {
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const cancel = vi.spyOn(client, "cancelReservation").mockResolvedValue();
    vi.spyOn(client, "getSchedule").mockResolvedValue(schedule(["B"]));
    expect(await cancelAndReload(client, "e", "A")).toEqual(["B"]);
    expect(cancel).toHaveBeenCalledWith("e", "A");
  });
});

describe("EventsClient reservations", () => {
  it("posts the ids and unwraps the result; cancels with DELETE", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ result: { successful: ["A"], failed: [] } }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const client = new EventsClient({ fetchImpl, getAccessToken: async () => "t" });
    expect(await client.reserveSessions("reinvent2026", ["A"])).toEqual({ successful: ["A"], failed: [] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.awsevents.com/v1/events/reinvent2026/reservations");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ sessionIds: ["A"] });

    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.cancelReservation("reinvent2026", "A");
    expect(String(fetchImpl.mock.calls[1]![0])).toBe("https://api.awsevents.com/v1/events/reinvent2026/reservations/A");
    expect(fetchImpl.mock.calls[1]![1]?.method).toBe("DELETE");
  });
});
