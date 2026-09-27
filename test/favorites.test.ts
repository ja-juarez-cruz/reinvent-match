import { describe, expect, it, vi } from "vitest";
import { EventsClient } from "../src/api/client.js";
import type { SwipeLog } from "../src/store/swipes.js";
import { planFavorites, syncFavorites } from "../src/sync/favorites.js";

const at = "2026-09-24T00:00:00Z";
const swipes: SwipeLog = {
  A: { decision: "like", at },
  B: { decision: "like", at },
  C: { decision: "pass", at },
  D: { decision: "pass", at },
  E: { decision: "save", at },
};

describe("planFavorites", () => {
  it("adds liked sessions and removes passed ones only if they are favorites", () => {
    expect(planFavorites(swipes, ["B", "C", "Z"])).toEqual({ toAdd: ["A"], toRemove: ["C"] });
  });

  it("removes a favorite downgraded to maybe, and leaves portal-only favorites alone", () => {
    expect(planFavorites(swipes, ["E", "Z"])).toEqual({ toAdd: ["A", "B"], toRemove: ["E"] });
  });
});

describe("syncFavorites", () => {
  it("batches adds, treats alreadyFavorited as done and re-reads the schedule", async () => {
    const many: SwipeLog = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`S${String(i).padStart(2, "0")}`, { decision: "like", at }]),
    );
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    const associate = vi
      .spyOn(client, "associateFavorites")
      .mockImplementation(async (_e, ids) => ({
        successful: ids.filter((id) => id !== "S03"),
        failed: ids.includes("S03") ? [{ sessionId: "S03", code: "alreadyFavorited" }] : [],
      }));
    vi.spyOn(client, "getSchedule")
      .mockResolvedValueOnce({ reserved: [], favorites: [], personalTime: [] })
      .mockResolvedValueOnce({ reserved: [], favorites: Object.keys(many), personalTime: [] });

    const result = await syncFavorites(client, "reinvent2026", many);

    expect(associate.mock.calls.map(([, ids]) => ids.length)).toEqual([10, 2]);
    expect(result.added).toHaveLength(12);
    expect(result.failed).toEqual([]);
    expect(result.favorites).toHaveLength(12);
  });

  it("reports sessions the API refused", async () => {
    const client = new EventsClient({ fetchImpl: vi.fn<typeof fetch>() });
    vi.spyOn(client, "associateFavorites").mockResolvedValue({
      successful: [],
      failed: [{ sessionId: "A", code: "insufficientAccess" }],
    });
    vi.spyOn(client, "getSchedule").mockResolvedValue({ reserved: [], favorites: [], personalTime: [] });
    const result = await syncFavorites(client, "e", { A: { decision: "like", at } });
    expect(result.failed).toEqual([{ sessionId: "A", code: "insufficientAccess", action: "add" }]);
  });
});

describe("planImport", () => {
  it("brings portal favorites back as picks and lists picks removed in the portal", async () => {
    const { planImport } = await import("../src/sync/favorites.js");
    const local = {
      A: { decision: "like" as const, at },
      B: { decision: "like" as const, at },
      C: { decision: "save" as const, at },
    };
    expect(planImport(local, ["A", "C", "D"])).toEqual({ toLike: ["C", "D"], notInPortal: ["B"] });
  });
});
