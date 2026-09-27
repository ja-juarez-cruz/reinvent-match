import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { buildIcs, toApiUtc, type BlockKind, type CalendarBlock } from "../calendar";
import { clock, formatDay } from "../format";
import type { PlanItem } from "../types";

const KINDS: { kind: BlockKind; label: string }[] = [
  { kind: "lunch", label: "🍽 Lunch" },
  { kind: "walk", label: "🚶 Walks between venues" },
  { kind: "free", label: "☕ Free time (30 min or more)" },
];

/**
 * Takes the week outside the app: the planned blocks (lunch, walks, free time) as personal time on the re:Invent
 * schedule, where the AWS Events app shows them next to the sessions, and everything as an .ics file for any calendar.
 */
export function CalendarModal({
  eventId,
  eventName,
  offset,
  sessions,
  blocks,
  signedIn,
  onSignIn,
  onClose,
}: {
  eventId: string;
  eventName: string;
  /** Minutes the event's local time is ahead of UTC. */
  offset: number;
  sessions: PlanItem[];
  blocks: CalendarBlock[];
  signedIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const [kinds, setKinds] = useState<Set<BlockKind>>(() => new Set(["lunch", "walk", "free"]));
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = blocks.filter((b) => kinds.has(b.kind));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (kind: BlockKind) =>
    setKinds((k) => {
      const next = new Set(k);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  async function sync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.syncPersonalTime(
        eventId,
        chosen.map((b) => ({
          startDateTime: toApiUtc(b.date, b.start, offset),
          endDateTime: toApiUtc(b.date, b.end, offset),
          title: b.title,
          description: b.description,
          ...(b.location ? { location: b.location } : {}),
        })),
      );
      setResult(
        `✓ Added ${r.created}, moved ${r.updated}, removed ${r.deleted}, kept ${r.kept}.` +
          (r.failed.length ? ` ${r.failed.length} refused: ${r.failed.map((f) => f.message).join("; ")}` : ""),
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "signin"
          ? "Sign in again to sync."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setSyncing(false);
    }
  }

  function download() {
    const ics = buildIcs({ calendarName: `${eventName} · Reinvent:Match`, sessions, blocks: chosen, offset });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventId}-reinvent-match.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel fill-week"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="calendar-title">📅 Calendar</h2>
        <p className="muted small">
          Blocks planned around your {sessions.length} ❤️ sessions. Sync them to your re:Invent schedule as personal
          time (the AWS Events app shows them next to your sessions), or download everything for your phone's calendar.
        </p>
        <div className="chips">
          {KINDS.map(({ kind, label }) => (
            <button key={kind} className={`chip small ${kinds.has(kind) ? "on" : ""}`} onClick={() => toggle(kind)}>
              {label} <span className="count">{blocks.filter((b) => b.kind === kind).length}</span>
            </button>
          ))}
        </div>
        <ul className="calendar-blocks small">
          {chosen.map((b) => (
            <li key={`${b.kind}-${b.date}-${b.start}`}>
              <span className="code">
                {formatDay(b.date)} {clock(b.start)}–{clock(b.end)}
              </span>{" "}
              {b.title}
            </li>
          ))}
        </ul>
        {result && <p className="small">{result}</p>}
        {error && <p className="error small">{error}</p>}
        <div className="modal-actions">
          {signedIn ? (
            <button className="primary" disabled={syncing} onClick={sync}>
              {syncing ? "Syncing…" : `🕒 Sync ${chosen.length} blocks to my re:Invent schedule`}
            </button>
          ) : (
            <button className="ghost" onClick={onSignIn}>
              Sign in to sync personal time
            </button>
          )}
          <button className="ghost" onClick={download}>
            ⤓ Download .ics ({sessions.length} sessions{chosen.length ? ` + ${chosen.length} blocks` : ""})
          </button>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted small">
          Syncing only replaces the blocks Reinvent:Match added before; personal time you created yourself is left
          alone.
        </p>
      </div>
    </div>
  );
}
