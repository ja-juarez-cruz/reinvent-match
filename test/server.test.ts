import { cp, mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventsClient } from "../src/api/client.js";
import type { TokenSet } from "../src/auth/oauth.js";
import { AuthSession, type TokenStore } from "../src/auth/session.js";
import { CSRF_HEADER, createApp } from "../src/server/app.js";

class MemoryStore implements TokenStore {
  tokens: TokenSet | null = null;
  async load() {
    return this.tokens;
  }
  async save(t: TokenSet) {
    this.tokens = t;
  }
  async clear() {
    this.tokens = null;
  }
}

let server: Server;
let base: string;
const store = new MemoryStore();
const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });

beforeAll(async () => {
  const home = await mkdtemp(join(tmpdir(), "rematch-home-"));
  process.env.REMATCH_HOME = home;
  await cp(new URL("./fixtures/summit-dubai-2026.json", import.meta.url), join(home, "cache", "Summit-Dubai-2026.json"));
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  server.on("request", createApp({ client, auth: new AuthSession(store), store, port }));
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
  delete process.env.REMATCH_HOME;
});

const write = (path: string, method: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { [CSRF_HEADER]: "1", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("local server", () => {
  it("reports the session without exposing tokens", async () => {
    const body = await (await fetch(`${base}/api/session`)).json();
    expect(body).toEqual({ signedIn: false, email: null });
  });

  it("rejects writes without the CSRF header", async () => {
    const res = await fetch(`${base}/api/profiles/x`, { method: "PUT", body: "{}" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("csrf");
  });

  it("rejects requests for another Host (DNS rebinding)", async () => {
    const { request } = await import("node:http");
    const status = await new Promise<number>((resolve) => {
      request(`${base}/api/session`, { headers: { Host: "evil.example" } }, (res) => resolve(res.statusCode ?? 0)).end();
    });
    expect(status).toBe(403);
  });

  it("validates, stores and lists profiles", async () => {
    expect((await write("/api/profiles/bad", "PUT", { interests: [] })).status).toBe(400);
    const profile = { interests: [{ name: "Amazon Bedrock", bucket: "explore" }], goals: ["learn-new"] };
    expect((await write("/api/profiles/me", "PUT", profile)).status).toBe(200);
    const list = await (await fetch(`${base}/api/profiles`)).json();
    expect(list.map((p: { id: string }) => p.id)).toEqual(["me"]);
  });

  it("matches a cached catalog and records swipes", async () => {
    const match = await (await fetch(`${base}/api/match/Summit-Dubai-2026?profile=me`)).json();
    expect(match.results.length).toBeGreaterThan(0);
    const first = match.results[0].session.id as string;

    expect((await write(`/api/swipes/Summit-Dubai-2026/${first}`, "PUT", { decision: "like" })).status).toBe(200);
    expect((await write(`/api/swipes/Summit-Dubai-2026/${first}`, "PUT", { decision: "maybe" })).status).toBe(400);
    const again = await (await fetch(`${base}/api/match/Summit-Dubai-2026?profile=me`)).json();
    expect(again.swipes[first].decision).toBe("like");
  });

  it("explains a missing catalog or profile", async () => {
    expect((await (await fetch(`${base}/api/match/reinvent2026?profile=me`)).json()).error).toBe("catalog-missing");
    expect((await (await fetch(`${base}/api/match/Summit-Dubai-2026`)).json()).error).toBe("profile-required");
  });

  it("starts sign-in on this server's callback and rejects unknown callbacks", async () => {
    const { authorizeUrl } = await (await write("/api/auth/login", "POST")).json();
    const redirect = new URL(new URL(authorizeUrl).searchParams.get("redirect_uri")!);
    expect(redirect.origin).toBe(base);
    expect(redirect.pathname).toBe("/callback");
    expect((await fetch(`${base}/callback?code=x&state=unknown`)).status).toBe(400);
  });
});

describe("onboarding and plan", () => {
  it("rejects invalid answers and builds a plan from saved ones", async () => {
    expect((await write("/api/answers/me", "PUT", { known: [], level: "basic", formats: ["chalk"] })).status).toBe(400);
    const saved = await write("/api/answers/me", "PUT", {
      known: ["domain:ai"],
      level: "intermediate",
      formats: ["workshop", "chalk", "code", "breakout"],
    });
    expect(saved.status).toBe(200);
    const plan = await (await fetch(`${base}/api/plan/Summit-Dubai-2026?answers=me`)).json();
    expect(plan.results.length).toBeGreaterThan(0);
    expect(plan.results.every((r: { session: { format: string } }) => ["workshop", "chalk-talk", "code-talk", "breakout", "bootcamp", "dev-chat", "panel", "other"].includes(r.session.format))).toBe(true);
    expect(plan.context.known).toEqual(expect.arrayContaining(["domain:ai", "tech:Amazon Bedrock"]));
  });

  it("serves the vocabulary and onboarding options", async () => {
    const vocab = await (await fetch(`${base}/api/vocabulary/Summit-Dubai-2026`)).json();
    expect(vocab.technologies.length).toBeGreaterThan(0);
    const options = await (await fetch(`${base}/api/onboarding`)).json();
    expect(options.maxTopics).toBe(8);
    expect(options.topicLevels).toEqual(["new", "basic", "intermediate", "advanced"]);
  });
});

describe("reservations", () => {
  it("reserves in the given order and returns the schedule", async () => {
    const reserve = vi.spyOn(client, "reserveSessions").mockResolvedValue({ successful: ["A", "B"], failed: [] });
    vi.spyOn(client, "getSchedule")
      .mockResolvedValueOnce({ reserved: [], favorites: [], personalTime: [] })
      .mockResolvedValueOnce({ reserved: ["A", "B"], favorites: [], personalTime: [] });
    const res = await write("/api/reservations/reinvent2026", "POST", { sessionIds: ["A", "B"] });
    expect(res.status).toBe(200);
    expect((await res.json()).schedule).toEqual(["A", "B"]);
    expect(reserve).toHaveBeenCalledWith("reinvent2026", ["A", "B"]);
    vi.restoreAllMocks();
  });

  it("passes on a refusal from the event instead of calling it an unregistered Builder ID", async () => {
    const { EventsApiError } = await import("../src/api/client.js");
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: [], personalTime: [] });
    vi.spyOn(client, "reserveSessions").mockRejectedValue(new EventsApiError("Reserved seating is not open", 403, null));
    const res = await write("/api/reservations/reinvent2026", "POST", { sessionIds: ["A"] });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("reservations-refused");
    expect(body.message).toMatch(/Reserved seating is not open/);
    vi.restoreAllMocks();
  });

  it("validates the request and cancels with DELETE", async () => {
    expect((await write("/api/reservations/reinvent2026", "POST", { sessionIds: [] })).status).toBe(400);
    vi.spyOn(client, "cancelReservation").mockResolvedValue();
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: ["B"], favorites: [], personalTime: [] });
    const res = await write("/api/reservations/reinvent2026/A", "DELETE");
    expect(await res.json()).toEqual({ schedule: ["B"] });
    vi.restoreAllMocks();
  });
});

describe("favorites import", () => {
  it("previews the difference with the portal and applies what the attendee keeps", async () => {
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: ["X1"], personalTime: [] });
    await write("/api/swipes/Summit-Dubai-2026/L1", "PUT", { decision: "like" });
    const preview = await (await fetch(`${base}/api/favorites/Summit-Dubai-2026/import`)).json();
    expect(preview.toLike.map((s: { id: string }) => s.id)).toEqual(["X1"]);
    expect(preview.notInPortal.map((s: { id: string }) => s.id)).toContain("L1");
    const swipes = await (await write("/api/favorites/Summit-Dubai-2026/import", "POST", { like: ["X1"], downgrade: ["L1"] })).json();
    expect(swipes.X1.decision).toBe("like");
    expect(swipes.L1.decision).toBe("save");
    vi.restoreAllMocks();
  });
});

describe("onboarding from favorites", () => {
  it("drafts preferences from the portal's favorites", async () => {
    const plan = await (await fetch(`${base}/api/match/Summit-Dubai-2026?profile=me`)).json();
    const ids = plan.results.slice(0, 3).map((r: { session: { id: string } }) => r.session.id);
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: ids, personalTime: [] });
    const draft = await (await fetch(`${base}/api/onboarding/Summit-Dubai-2026/from-favorites`)).json();
    expect(draft.favorites).toHaveLength(3);
    expect(draft.answers.topics.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});

describe("seats and event", () => {
  it("checks seat bands one session at a time and reads one event", async () => {
    const get = vi
      .spyOn(client, "getSession")
      .mockImplementation(async (_e, id) => ({ sessionId: id, isReservable: true, seatAvailability: id === "A" ? "limited" : "unavailable" }) as never);
    const seats = await (await write("/api/sessions/reinvent2026/seats", "POST", { sessionIds: ["A", "B"] })).json();
    expect(seats).toEqual({ A: { isReservable: true, seatAvailability: "limited" }, B: { isReservable: true, seatAvailability: "unavailable" } });
    expect(get).toHaveBeenCalledTimes(2);
    vi.spyOn(client, "getEvent").mockResolvedValue({ eventId: "reinvent2026", startDate: "2026-11-30T00:00:00.000-08:00" } as never);
    expect((await (await fetch(`${base}/api/events/reinvent2026`)).json()).startDate).toMatch(/-08:00$/);
    vi.restoreAllMocks();
  });
});
