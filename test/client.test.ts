import { describe, expect, it, vi } from "vitest";
import { EventsApiError, EventsClient } from "../src/api/client.js";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("EventsClient", () => {
  it("walks every page of a catalog", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [{ sessionId: "A", title: "a" }], totalCount: 2, nextToken: "t1" }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ sessionId: "B", title: "b" }], totalCount: 2 }));
    const client = new EventsClient({ fetchImpl });

    const sessions = await client.listAllSessions("reinvent2026", { locale: "en-US" });

    expect(sessions.map((s) => s.sessionId)).toEqual(["A", "B"]);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("nextToken=t1");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("locale=en-US");
  });

  it("sends the bearer token when one is available", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: [] }));
    await new EventsClient({ fetchImpl, getAccessToken: async () => "tok" }).listEvents();
    const init = fetchImpl.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("retries throttled requests, honoring Retry-After", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: "slow down" }, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    await new EventsClient({ fetchImpl, sleep }).listEvents();
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("surfaces non-retryable errors with their status", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ message: "sign in" }, 401));
    await expect(new EventsClient({ fetchImpl }).listAllSessions("reinvent2026")).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<EventsApiError>);
  });
});
