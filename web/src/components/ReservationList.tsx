import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatWhen, venueOf } from "../format";
import type { Reservation } from "../reservations";
import type { PlanItem } from "../types";
import { useStored } from "../useStored";

/** Seat bands from GetSession, in words. */
const SEATS: Record<string, string> = {
  available: "🟢 Seats available",
  limited: "🟡 Limited seats",
  veryLimited: "🟠 Very few seats",
  unavailable: "⛔ Full",
  walkUp: "🚶 Walk-up only",
};

type Seats = Record<string, { isReservable: boolean; seatAvailability: string | null }>;

/** Whether a seat can be booked now: reservations are open for it and it is neither full nor walk-up only. */
function bookable(seat: Seats[string] | undefined): boolean {
  return !!seat?.isReservable && seat.seatAvailability !== "unavailable" && seat.seatAvailability !== "walkUp";
}

/** Why the event refused a seat, in words (unknown codes read as a generic refusal). */
const REFUSALS: Record<string, string> = {
  sessionFull: "Full",
  scheduleConflict: "Clashes with another reservation",
  sessionNotReservable: "Not reservable",
  insufficientAccess: "Your pass does not include it",
  timePassed: "Already past",
};

interface Props {
  eventId: string;
  plan: Reservation[];
  /** Reservations the event reports (GetSchedule), or null when not signed in. */
  reservedOfficially: string[] | null;
  onReservedChange: (reserved: string[]) => void;
  /** A backup got the seat: it becomes the ❤️ pick and the full session a 🔖 maybe. */
  onSwap: (from: PlanItem, to: PlanItem) => Promise<void>;
  onSignIn: () => void;
}

/**
 * The ❤️ sessions that need a seat, in the order to book them when reserved seating opens, with a backup for each.
 * Signed in, it reserves through the AWS Events API (open from October 8); before that, the ticks are a checklist
 * for booking in the portal, kept in this browser only.
 */
export function ReservationList({ eventId, plan, reservedOfficially, onReservedChange, onSwap, onSignIn }: Props) {
  const [stored, setStored] = useStored(`rematch.reserved.${eventId}`, "[]");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<"all" | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [seats, setSeats] = useState<Seats>({});
  const [checking, setChecking] = useState(false);
  const ticked = new Set<string>(safeParse(stored));
  const official = new Set(reservedOfficially ?? []);
  const signedIn = reservedOfficially !== null;
  const pending = plan.filter((r) => !official.has(r.item.session.id));
  // Only what can be booked right now, in the plan's order: the count on the button is what a click would reserve.
  const bookableIds = pending.map((r) => r.item.session.id).filter((id) => bookable(seats[id]));
  const checked = pending.some((r) => seats[r.item.session.id]);
  const pendingKey = pending.map((r) => r.item.session.id).join(",");

  // Seats are checked as soon as the list opens, so the button never offers what cannot be booked.
  useEffect(() => {
    if (signedIn && pendingKey) void checkSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, eventId]);

  const toggle = (id: string) => {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStored(JSON.stringify([...next]));
  };

  async function reserve(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.reserve(eventId, ids);
      onReservedChange(result.schedule);
      setRefused((r) => {
        const next = { ...r };
        for (const id of result.reserved) delete next[id];
        for (const f of result.failed) next[f.sessionId] = f.code;
        return next;
      });
      return result;
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "signin"
          ? "Sign in again to reserve."
          : e instanceof Error
            ? e.message
            : String(e),
      );
      return null;
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function reserveBackup(from: PlanItem, backup: PlanItem) {
    const result = await reserve([backup.session.id]);
    if (result?.reserved.includes(backup.session.id)) await onSwap(from, backup);
  }

  /** Fresh seat bands for the sessions still to book (GetSession, 30 per request). */
  async function checkSeats() {
    setChecking(true);
    setError(null);
    try {
      const ids = pending.map((r) => r.item.session.id);
      const next: Seats = {};
      for (let i = 0; i < ids.length; i += 30) Object.assign(next, await api.seats(eventId, ids.slice(i, i + 30)));
      setSeats(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    setError(null);
    try {
      onReservedChange((await api.cancelReservation(eventId, id)).schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function copy() {
    const text = plan
      .map((r, i) => `${i + 1}. ${r.item.session.code} ${r.item.session.title} (${formatWhen(r.item.session)})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (plan.length === 0) {
    return (
      <div className="panel">
        <p className="muted">None of your ❤️ sessions needs a reserved seat. Walk-ins only: nothing to book.</p>
      </div>
    );
  }

  const done = plan.filter((r) => official.has(r.item.session.id) || ticked.has(r.item.session.id)).length;
  const notOpen = checked && bookableIds.length === 0 && pending.every((r) => !seats[r.item.session.id]?.isReservable);
  return (
    <div className="panel reservations">
      <p className="muted small">
        Book in this order: sessions offered only once first, then hands-on ones, which fill fastest. Reserved seating
        opens October 6 in the re:Invent portal; reserving from here works from October 8. {done}/{plan.length}{" "}
        reserved.
      </p>
      <div className="row">
        {signedIn ? (
          pending.length > 0 &&
          (confirming === "all" ? (
            <>
              <button className="primary" disabled={busy} onClick={() => reserve(bookableIds)}>
                {busy ? "Reserving…" : `Confirm: reserve ${plural(bookableIds.length)}`}
              </button>
              <button className="link" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy || checking || bookableIds.length === 0}
              onClick={() => setConfirming("all")}
              title="Only sessions with seats you can book now"
            >
              {checking && !checked
                ? "Checking seats…"
                : bookableIds.length > 0
                  ? `🎟 Reserve ${bookableIds.length} in this order`
                  : notOpen
                    ? "🎟 Reservations not open yet"
                    : "🎟 Nothing to reserve now"}
            </button>
          ))
        ) : (
          <button className="ghost" onClick={onSignIn}>
            Sign in to reserve from here
          </button>
        )}
        {signedIn && pending.length > 0 && (
          <button
            className="ghost small"
            disabled={checking}
            onClick={checkSeats}
            title="How full each session still to book is"
          >
            {checking ? "Checking…" : "↻ Check seats"}
          </button>
        )}
        <button className="ghost small" onClick={copy}>
          {copied ? "✓ Copied" : "Copy list"}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="reservation-head muted small" aria-hidden="true">
        <span />
        <span>Session</span>
        <span>Seats</span>
        <span />
      </div>
      <ol className="reservation-list">
        {plan.map(({ item, onlyTime, backups }) => {
          const s = item.session;
          const isOfficial = official.has(s.id);
          const refusal = refused[s.id];
          const seat = seats[s.id];
          const full = refusal === "sessionFull" || seat?.seatAvailability === "unavailable";
          return (
            <li key={s.id} className={isOfficial || ticked.has(s.id) ? "reserved" : ""}>
              <div className="reservation-row">
                {isOfficial ? (
                  <span className="reserved-mark" title="Reserved: the event confirms it">
                    ✓
                  </span>
                ) : (
                  <label className="reservation-check" title="Mark as reserved in the portal (this browser only)">
                    <input type="checkbox" checked={ticked.has(s.id)} onChange={() => toggle(s.id)} />
                  </label>
                )}
                <div className="reservation-info">
                  <div>
                    <strong className="code">{s.code}</strong> {s.title}
                  </div>
                  <div className="muted small">
                    {formatWhen(s)} · {venueOf(s)} · {s.formatLabel ?? s.format}
                    {onlyTime ? " · ⚠️ only time offered" : ""}
                  </div>
                  {backups.length > 0 && !isOfficial && (
                    <div className="small">
                      {full ? "Full, try:" : "If full:"}{" "}
                      {backups.map((b, i) => (
                        <span key={b.session.id}>
                          {i > 0 && " · "}
                          {b.session.code} ({formatWhen(b.session)})
                          {signedIn && full && (
                            <button className="link small" disabled={busy} onClick={() => reserveBackup(item, b)}>
                              Reserve instead
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="reservation-status small">
                  {isOfficial ? (
                    <span className="ok">✓ Reserved</span>
                  ) : refusal ? (
                    <span className="warn">⚠️ {REFUSALS[refusal] ?? `Refused (${refusal})`}</span>
                  ) : seat ? (
                    seat.isReservable ? (
                      (SEATS[seat.seatAvailability ?? ""] ?? "Reservable")
                    ) : (
                      <span className="muted">⏳ Not open yet</span>
                    )
                  ) : (
                    <span className="muted">{checking ? "…" : "—"}</span>
                  )}
                </div>
                <div className="reservation-action">
                  {isOfficial ? (
                    confirming === s.id ? (
                      <>
                        <button className="link small" disabled={busy} onClick={() => cancel(s.id)}>
                          Confirm cancel
                        </button>
                        <button className="link small" onClick={() => setConfirming(null)}>
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button className="link small" onClick={() => setConfirming(s.id)}>
                        Cancel
                      </button>
                    )
                  ) : signedIn && bookable(seat) ? (
                    confirming === `reserve:${s.id}` ? (
                      <>
                        <button className="primary small" disabled={busy} onClick={() => reserve([s.id])}>
                          Confirm
                        </button>
                        <button className="link small" onClick={() => setConfirming(null)}>
                          Not now
                        </button>
                      </>
                    ) : (
                      <button className="ghost small" disabled={busy} onClick={() => setConfirming(`reserve:${s.id}`)}>
                        🎟 Reserve
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function plural(n: number): string {
  return `${n} session${n === 1 ? "" : "s"}`;
}

function safeParse(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
