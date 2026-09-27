import type { BulkFailure } from "../api/types.js";
import type { ReservationResult } from "../sync/reservations.js";

export interface SeatStatus {
  isReservable: boolean;
  seatAvailability: string | null;
}

const BANDS = ["available", "limited", "veryLimited", "unavailable", "walkUp", null] as const;

/**
 * Made-up seats for trying the Reservations view before seating opens (REMATCH_DEMO_SEATS=1). Each session checked
 * gets the next band in turn (then "not open yet"), and reserving or cancelling works against those bands, in memory:
 * nothing reaches the Events API.
 */
export class DemoSeats {
  private readonly bands = new Map<string, SeatStatus>();
  private readonly reserved = new Set<string>();

  seats(sessionIds: string[]): Record<string, SeatStatus> {
    return Object.fromEntries(sessionIds.map((id) => [id, this.statusOf(id)]));
  }

  reserve(sessionIds: string[]): ReservationResult {
    const reserved: string[] = [];
    const failed: BulkFailure[] = [];
    for (const id of sessionIds) {
      const { isReservable, seatAvailability } = this.statusOf(id);
      if (this.reserved.has(id) || (isReservable && seatAvailability !== "unavailable" && seatAvailability !== "walkUp")) {
        this.reserved.add(id);
        reserved.push(id);
      } else {
        failed.push({ sessionId: id, code: seatAvailability === "unavailable" ? "sessionFull" : "sessionNotReservable" });
      }
    }
    return { reserved, failed, schedule: [...this.reserved] };
  }

  cancel(sessionId: string): string[] {
    this.reserved.delete(sessionId);
    return [...this.reserved];
  }

  private statusOf(id: string): SeatStatus {
    let status = this.bands.get(id);
    if (!status) {
      const band = BANDS[this.bands.size % BANDS.length]!;
      status = { isReservable: band !== null, seatAvailability: band };
      this.bands.set(id, status);
    }
    return status;
  }
}
