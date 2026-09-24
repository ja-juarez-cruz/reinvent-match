import { useEffect, useState } from "react";
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

export function HomePage({ session, events, eventId, onSelectEvent, onSignIn }: Props) {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const event = events.find((e) => e.eventId === eventId);
  const needsSignIn = !!event?.authenticationRequired && !session?.signedIn;

  useEffect(() => {
    setStatus(null);
    setError(null);
    if (eventId) api.catalog(eventId).then(setStatus, () => setStatus({ downloaded: false }));
  }, [eventId]);

  async function download() {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.refreshCatalog(eventId));
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "not-registered"
          ? "Your Builder ID is not registered for this event. Register on the event site first."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...events].sort((a, b) => Number(b.authenticationRequired) - Number(a.authenticationRequired));

  return (
    <section className="page">
      <div className="hero">
        <h1>Too many sessions. Too few days. Which ones are yours?</h1>
        <p className="lead">
          Re:Match doesn't rank the <em>best</em> sessions. It finds the ones that <strong>fit you</strong>: what you
          already know, what you want to grow, and what you want to explore, and tells you why.
        </p>
      </div>

      <h2>Choose your event</h2>
      {events.length === 0 && <p className="muted">Loading AWS events…</p>}
      <div className="event-grid">
        {sorted.map((e) => (
          <button
            key={e.eventId}
            className={`event-card ${e.eventId === eventId ? "selected" : ""}`}
            onClick={() => onSelectEvent(e.eventId)}
          >
            <span className="event-name">{e.name}</span>
            <span className="muted small">
              {e.address?.city ?? "Online"} · {eventDate(e.startDate)}
            </span>
            <span className={`pill ${e.authenticationRequired ? "pill-warn" : "pill-ok"}`}>
              {e.authenticationRequired ? "Registered attendees" : "Public catalog"}
            </span>
          </button>
        ))}
      </div>

      {event && (
        <div className="panel">
          <h3>{event.name} catalog</h3>
          {needsSignIn ? (
            <>
              <p>
                This catalog is only available to registered attendees. Sign in with the AWS Builder ID you registered
                with. Your password is entered on AWS's page, never here.
              </p>
              <button className="primary" onClick={onSignIn}>
                Sign in with Builder ID
              </button>
            </>
          ) : (
            <>
              {status?.downloaded ? (
                <p>
                  ✅ <strong>{status.count?.toLocaleString()}</strong> sessions on your machine, downloaded{" "}
                  {status.fetchedAt ? new Date(status.fetchedAt).toLocaleString() : ""}.
                </p>
              ) : (
                <p>Download the catalog to your machine to start matching. It takes a few seconds.</p>
              )}
              <div className="row">
                <button className={status?.downloaded ? "ghost" : "primary"} disabled={busy} onClick={download}>
                  {busy ? "Downloading…" : status?.downloaded ? "Refresh catalog" : "Download catalog"}
                </button>
                {status?.downloaded && (
                  <button className="primary" onClick={() => navigate("profile")}>
                    Next: your profile →
                  </button>
                )}
              </div>
              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
