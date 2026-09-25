import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { navigate } from "../App";
import { LearningPlanPanel } from "../components/LearningPlanPanel";
import { SessionCode } from "../components/SessionCode";
import { formatDay, formatTimeRange, overlaps, sessionInterval, venueOf } from "../format";
import { buildLearningPlan } from "../learningPlan";
import type { AwsEvent, Decision, FavoritesSyncResult, PlanItem, Schedule, SessionInfo } from "../types";
import { usePlan } from "../usePlan";
import { INTENT_META } from "./SwipePage";

interface Props {
  event: AwsEvent | null;
  eventId: string | null;
  answersId: string | null;
  session: SessionInfo | null;
  onSignIn: () => void;
}

export function ShortlistPage({ event, eventId, answersId, session, onSignIn }: Props) {
  const { data, error, decide } = usePlan(eventId, answersId);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [sync, setSync] = useState<FavoritesSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const canSync = !!event?.authenticationRequired && !!session?.signedIn;

  useEffect(() => {
    if (canSync && eventId) api.schedule(eventId).then(setSchedule, () => setSchedule(null));
  }, [canSync, eventId]);

  const picked = useMemo(() => {
    if (!data) return [];
    return data.results
      .filter((r) => {
        const d = data.swipes[r.session.id]?.decision;
        return d === "like" || d === "save";
      })
      .sort((a, b) => {
        const x = sessionInterval(a.session);
        const y = sessionInterval(b.session);
        if (!x || !y) return x ? -1 : y ? 1 : 0;
        return x.day.localeCompare(y.day) || x.start - y.start;
      });
  }, [data]);

  const days = useMemo(() => {
    const groups = new Map<string, PlanItem[]>();
    for (const r of picked) {
      const day = r.session.schedule.date ?? "";
      groups.set(day, [...(groups.get(day) ?? []), r]);
    }
    return [...groups];
  }, [picked]);

  const liked = picked.filter((r) => data?.swipes[r.session.id]?.decision === "like");
  const favorites = new Set(sync?.favorites ?? schedule?.favorites ?? []);

  async function runSync() {
    if (!eventId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await api.syncFavorites(eventId);
      setSync(result);
    } catch (e) {
      setSyncError(e instanceof ApiError && e.code === "signin" ? "Sign in again to sync." : String(e));
    } finally {
      setSyncing(false);
    }
  }

  const plan = useMemo(() => (data ? buildLearningPlan(data.results, data.swipes, data.context) : null), [data]);

  if (!answersId || (error instanceof ApiError && error.code === "answers-missing")) {
    return (
      <section className="page">
        <div className="panel">
          <p>Tell Re:Match about you first, then swipe to build your shortlist.</p>
          <button className="primary" onClick={() => navigate("profile")}>
            About you →
          </button>
        </div>
      </section>
    );
  }
  if (error) return <section className="page error">{error.message}</section>;
  if (!data || !plan) return <section className="page muted">Loading your shortlist…</section>;

  return (
    <section className="page">
      <h1>Your shortlist</h1>
      <p className="lead">
        {liked.length} interested · {picked.length - liked.length} maybe. Overlapping sessions are flagged so you can
        decide before reserving; the agenda builder comes next.
      </p>

      <LearningPlanPanel plan={plan} />

      {event?.authenticationRequired && (
        <div className="panel sync-panel">
          <div>
            <h3>Send ❤️ to your official re:Invent favorites</h3>
            <p className="muted small">
              Favorites show up in the re:Invent portal and app, ready for when reserved seating opens. Sessions you
              marked ❌ are removed from favorites only if they were there. Maybe (🔖) is never sent.
            </p>
          </div>
          {canSync ? (
            <button
              className="primary"
              disabled={syncing || (liked.length === 0 && (schedule?.favorites.length ?? 0) === 0)}
              onClick={runSync}
            >
              {syncing ? "Syncing…" : `Sync ${liked.length} to favorites`}
            </button>
          ) : (
            <button className="primary" onClick={onSignIn}>
              Sign in to sync
            </button>
          )}
          {sync && (
            <p className="small">
              ✅ Added {sync.added.length}, removed {sync.removed.length}. The portal now shows{" "}
              {sync.favorites.length} favorites.
              {sync.failed.length > 0 && (
                <span className="error">
                  {" "}
                  {sync.failed.length} refused: {sync.failed.map((f) => `${f.sessionId} (${f.code})`).join(", ")}
                </span>
              )}
            </p>
          )}
          {syncError && <p className="error">{syncError}</p>}
        </div>
      )}

      {picked.length === 0 ? (
        <div className="panel">
          <p>Nothing here yet. Swipe right (❤️) on sessions you want.</p>
          <button className="primary" onClick={() => navigate("swipe")}>
            Start swiping →
          </button>
        </div>
      ) : (
        days.map(([day, items]) => (
          <div key={day} className="day">
            <h3>{formatDay(day || null)}</h3>
            {items.map((r) => {
              const s = r.session;
              const decision = data.swipes[s.id]?.decision as Decision;
              const clashes = items.filter((o) => o !== r && overlaps(o.session, s));
              return (
                <div key={s.id} className={`slot ${clashes.length ? "clash" : ""}`}>
                  <div className="slot-time">{formatTimeRange(s)}</div>
                  <div className="slot-body">
                    <div>
                      <span className={`badge small intent-${r.intent}`} title={INTENT_META[r.intent].label}>
                        {INTENT_META[r.intent].icon}
                      </span>{" "}
                      <strong>{s.title}</strong>
                      {r.reservable && (
                        <span className="pill small" title="Needs a reserved seat">
                          🎟 reserve
                        </span>
                      )}
                      {favorites.has(s.id) && <span className="pill pill-ok small">★ favorite</span>}
                    </div>
                    <div className="muted small">
                      {s.code} · {s.formatLabel} · {s.levelLabel} · {venueOf(s)} · {r.score}%
                    </div>
                    {clashes.length > 0 && (
                      <div className="small warn">
                        ⚠️ Overlaps{" "}
                        {clashes.map((c, i) => (
                          <span key={c.session.id}>
                            {i > 0 && ", "}
                            <SessionCode session={c.session} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="slot-actions">
                    <button
                      className={`chip small ${decision === "like" ? "on" : ""}`}
                      onClick={() => decide(s.id, "like")}
                    >
                      ❤️
                    </button>
                    <button
                      className={`chip small ${decision === "save" ? "on" : ""}`}
                      onClick={() => decide(s.id, "save")}
                    >
                      🔖
                    </button>
                    <button className="chip small" onClick={() => decide(s.id, "pass")} title="Remove">
                      ❌
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}
