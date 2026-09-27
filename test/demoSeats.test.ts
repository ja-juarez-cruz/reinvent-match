import { describe, expect, it } from "vitest";
import { DemoSeats } from "../src/server/demo.js";

describe("DemoSeats", () => {
  it("shows every seat band in turn, then a session not open yet", () => {
    const seats = new DemoSeats().seats(["a", "b", "c", "d", "e", "f", "g"]);
    expect(Object.values(seats).map((s) => (s.isReservable ? s.seatAvailability : "closed"))).toEqual([
      "available",
      "limited",
      "veryLimited",
      "unavailable",
      "walkUp",
      "closed",
      "available",
    ]);
  });

  it("reserves what has seats and refuses the rest, as the API would", () => {
    const demo = new DemoSeats();
    demo.seats(["a", "b", "c", "d", "e", "f"]);
    const result = demo.reserve(["a", "d", "e", "f"]);
    expect(result.reserved).toEqual(["a"]);
    expect(result.failed).toEqual([
      { sessionId: "d", code: "sessionFull" },
      { sessionId: "e", code: "sessionNotReservable" },
      { sessionId: "f", code: "sessionNotReservable" },
    ]);
    expect(demo.cancel("a")).toEqual([]);
  });
});
