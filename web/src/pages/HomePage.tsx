import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";
import { navigate } from "../App";
import type { AwsEvent, CatalogStatus, SessionInfo } from "../types";

interface Props {
  session: SessionInfo | null;
  events: AwsEvent[];
  eventId: string | null;
  onSelectEvent: (id: string) => void;
  onSignIn: () => void;
}

// Event dates carry the event's own UTC offset; show the calendar date as the event states it.
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const eventDate = (iso: string) => DATE.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** "just now", "5 min ago", "3 h ago", "2 days ago": how fresh a downloaded catalog is. */
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} days ago`;
}

export function HomePage({ session, events, eventId, onSelectEvent, onSignIn }: Props) {
  const [statuses, setStatuses] = useState<Record<string, CatalogStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ eventId: string; message: string } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const event = events.find((e) => e.eventId === eventId);
  const status = eventId ? statuses[eventId] : undefined;
  const canDownload = (e: AwsEvent) => !e.authenticationRequired || !!session?.signedIn;

  useEffect(() => {
    for (const e of events) {
      api.catalog(e.eventId).then(
        (s) => setStatuses((all) => ({ ...all, [e.eventId]: s })),
        () => setStatuses((all) => ({ ...all, [e.eventId]: { downloaded: false } })),
      );
    }
  }, [events]);

  async function download(id: string) {
    setBusy(id);
    setError(null);
    try {
      const s = await api.refreshCatalog(id);
      setStatuses((all) => ({ ...all, [id]: s }));
    } catch (e) {
      setError({
        eventId: id,
        message:
          e instanceof ApiError && e.code === "not-registered"
            ? "Your Builder ID is not registered for this event. Register on the event site first."
            : e instanceof Error
              ? e.message
              : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  function scroll(direction: 1 | -1) {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const sorted = [...events].sort((a, b) => Number(b.authenticationRequired) - Number(a.authenticationRequired));

  return (
    <section className="page">
      <div className="hero">
        <h1>Too many sessions. Too few days. Which ones are yours?</h1>
        <p className="lead">
          Reinvent:Match finds the sessions that <strong>fit you</strong>, and tells you why.
        </p>
      </div>

      <div className="carousel-head">
        <h2>Choose your event</h2>
        <div className="row">
          <button className="icon-button" onClick={() => scroll(-1)} aria-label="Previous events">
            ‹
          </button>
          <button className="icon-button" onClick={() => scroll(1)} aria-label="More events">
            ›
          </button>
        </div>
      </div>
      {events.length === 0 && <p className="muted">Loading AWS events…</p>}
      <div className="carousel" ref={track}>
        {sorted.map((e) => {
          const s = statuses[e.eventId];
          const refreshing = busy === e.eventId;
          const refreshLabel = !canDownload(e)
            ? "Sign in to download this catalog"
            : s?.downloaded
              ? "Refresh catalog: download the latest sessions"
              : "Download catalog";
          return (
            <div key={e.eventId} className={`event-card ${e.eventId === eventId ? "selected" : ""}`}>
              <button className="event-select" onClick={() => onSelectEvent(e.eventId)}>
                <span className="event-name">{e.name}</span>
                <span className="muted small">
                  {e.address?.city ?? "Online"} · {eventDate(e.startDate)}
                </span>
                <span className={`pill small ${e.authenticationRequired ? "pill-warn" : "pill-ok"}`}>
                  {e.authenticationRequired ? "🔒 Attendees" : "Public"}
                </span>
              </button>
              <div className="event-catalog small">
                <span className="muted">
                  {s?.downloaded
                    ? `${s.count?.toLocaleString()} sessions · ${s.fetchedAt ? ago(s.fetchedAt) : ""}`
                    : "Catalog not downloaded"}
                </span>
                <button
                  className={`icon-button refresh ${refreshing ? "spinning" : ""}`}
                  onClick={() => {
                    onSelectEvent(e.eventId);
                    void download(e.eventId);
                  }}
                  disabled={!canDownload(e) || busy !== null}
                  title={refreshLabel}
                  aria-label={refreshLabel}
                >
                  {s?.downloaded ? "↻" : "⤓"}
                </button>
              </div>
              {error?.eventId === e.eventId && <p className="error small">{error.message}</p>}
            </div>
          );
        })}
      </div>

      {event &&
        (!canDownload(event) ? (
          <div className="panel row between">
            <p>🔒 Only registered attendees can see this catalog. Sign in with the Builder ID you registered with.</p>
            <button className="primary" onClick={onSignIn}>
              Sign in with Builder ID
            </button>
          </div>
        ) : status?.downloaded ? (
          <div className="row">
            <button className="primary" onClick={() => navigate("profile")}>
              Next: about you →
            </button>
            <button className="ghost" onClick={() => navigate("insights")}>
              📊 Explore the catalog
            </button>
          </div>
        ) : (
          <div className="row">
            <button className="primary" disabled={busy !== null} onClick={() => download(event.eventId)}>
              {busy === event.eventId ? "Downloading…" : `⤓ Download the ${event.name} catalog`}
            </button>
          </div>
        ))}
    </section>
  );
}
