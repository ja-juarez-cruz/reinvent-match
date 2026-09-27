import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { navigate } from "../App";
import { LearningPlanPanel } from "../components/LearningPlanPanel";
import { AgendaGrid, AgendaList } from "../components/AgendaGrid";
import { FillWeekModal } from "../components/FillWeekModal";
import { ImportFavoritesModal } from "../components/ImportFavoritesModal";
import { ReservationList } from "../components/ReservationList";
import { SessionModal } from "../components/SessionModal";
import { reservationPlan } from "../reservations";
import { suggestWeek, type Suggestion } from "../suggest";
import { buildAgenda } from "../agenda";
import { formatTimeRange } from "../format";
import { buildLearningPlan } from "../learningPlan";
import type {
  AwsEvent,
  Decision,
  FavoritesImportPreview,
  FavoritesSyncResult,
  PlanItem,
  Schedule,
  SessionInfo,
} from "../types";
import { usePlan } from "../usePlan";
import { distinctSessions } from "../repeats";
import { buildWeek } from "../week";

interface Props {
  event: AwsEvent | null;
  eventId: string | null;
  answersId: string | null;
  session: SessionInfo | null;
  onSignIn: () => void;
}

export function ShortlistPage({ event, eventId, answersId, session, onSignIn }: Props) {
  const { data, error, decide, reload } = usePlan(eventId, answersId);
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
    return data.results.filter((r) => {
      const d = data.swipes[r.session.id]?.decision;
      return d === "like" || d === "save";
    });
  }, [data]);
  const week = useMemo(() => (data ? buildWeek(data.results, data.swipes) : []), [data]);
  const agenda = useMemo(() => (data ? buildAgenda(data.results, data.swipes, week) : null), [data, week]);
  /** A session opened from the agenda: a pick to keep or drop, or an alternative to swap in for `pick`. */
  const [open, setOpen] = useState<{ item: PlanItem; pick?: PlanItem } | null>(null);
  const [view, setView] = useState<"week" | "reservations">("week");
  /** Suggestions for the free time, while the fill-my-week dialog is open. */
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  /** The difference with the portal's favorites, while the import dialog is open. */
  const [importPreview, setImportPreview] = useState<FavoritesImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const reservations = useMemo(() => (data ? reservationPlan(data.results, data.swipes) : []), [data]);

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

  async function choose(id: string, decision: Decision) {
    setOpen(null);
    await decide(id, decision);
  }

  async function openImport() {
    if (!eventId) return;
    setImporting(true);
    setSyncError(null);
    try {
      setImportPreview(await api.favoritesImport(eventId));
    } catch (e) {
      setSyncError(e instanceof ApiError && e.code === "signin" ? "Sign in again to import." : String(e));
    } finally {
      setImporting(false);
    }
  }

  async function applyImport(like: string[], downgrade: string[]) {
    if (!eventId) return;
    await api.applyFavoritesImport(eventId, like, downgrade);
    setImportPreview(null);
    // Imported favorites may be sessions the plan hid; the server keeps every pick, so fetch the plan again.
    reload();
  }

  async function addSuggestions(ids: string[]) {
    for (const id of ids) await decide(id, "like");
    setSuggestions(null);
  }

  /** ❤️ the alternative instead of the pick; the pick stays as a 🔖 backup. */
  async function swap(alternative: PlanItem, pick: PlanItem) {
    setOpen(null);
    await decide(pick.session.id, "save");
    await decide(alternative.session.id, "like");
  }

  if (!answersId || (error instanceof ApiError && error.code === "answers-missing")) {
    return (
      <section className="page">
        <div className="panel">
          <p>Tell Reinvent:Match about you first, then swipe to build your match.</p>
          <button className="primary" onClick={() => navigate("profile")}>
            Set up your preferences →
          </button>
        </div>
      </section>
    );
  }
  if (error) return <section className="page error">{error.message}</section>;
  if (!data || !plan || !agenda) return <section className="page muted">Loading your match…</section>;

  return (
    <section className="page swipe-layout">
      <div className="swipe-main">
        <div className="match-head">
          <div>
            <h1>❤️ My Match</h1>
            <p className="muted">
              {distinctSessions(liked).length} ❤️ · {picked.length - liked.length} 🔖 · click a session to swap or drop
              it
            </p>
          </div>
          {event?.authenticationRequired &&
            (canSync ? (
              <div className="row">
                <button
                  className="ghost"
                  title="Bring back favorites you added or removed in the re:Invent portal or the AWS Events app"
                  disabled={importing}
                  onClick={openImport}
                >
                  {importing ? "Checking…" : "⬇ Import from re:Invent"}
                </button>
                <button
                  className="primary"
                  title="Adds your ❤️ to your favorites in the re:Invent portal and app, and removes the ones you downgraded here. Favorites you made only in the portal are left alone."
                  disabled={syncing || (liked.length === 0 && (schedule?.favorites.length ?? 0) === 0)}
                  onClick={runSync}
                >
                  {syncing ? "Syncing…" : `★ Sync ${liked.length} to re:Invent favorites`}
                </button>
              </div>
            ) : (
              <button
                className="primary"
                onClick={onSignIn}
                title="Sign in to send your ❤️ to your re:Invent favorites"
              >
                Sign in to sync favorites
              </button>
            ))}
        </div>
        <div className="row between match-views">
          <div className="tabs">
            <button className={`tab ${view === "week" ? "active" : ""}`} onClick={() => setView("week")}>
              📅 Week
            </button>
            <button
              className={`tab ${view === "reservations" ? "active" : ""}`}
              onClick={() => setView("reservations")}
            >
              🎟 Reservations <span className="count">{reservations.length}</span>
            </button>
          </div>
          {view === "week" && picked.length > 0 && (
            <button
              className="ghost"
              title="Suggest sessions for your free time: your maybes first, then your best matches"
              onClick={() => setSuggestions(suggestWeek(data.results, data.swipes))}
            >
              ✨ Fill my week
            </button>
          )}
        </div>
        {(sync || syncError) && (
          <div className="panel sync-panel">
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

        {view === "reservations" ? (
          <ReservationList
            eventId={eventId ?? ""}
            plan={reservations}
            reservedOfficially={canSync ? (schedule?.reserved ?? []) : null}
            onReservedChange={(reserved) =>
              setSchedule((s) => (s ? { ...s, reserved } : { reserved, favorites: [], personalTime: [] }))
            }
            onSwap={async (from, to) => {
              await decide(to.session.id, "like");
              await decide(from.session.id, "save");
            }}
            onSignIn={onSignIn}
          />
        ) : picked.length === 0 ? (
          <div className="panel">
            <p>Nothing here yet. Swipe right (❤️) on sessions you want.</p>
            <button className="primary" onClick={() => navigate("swipe")}>
              Start swiping →
            </button>
          </div>
        ) : (
          <>
            <AgendaGrid
              agenda={agenda}
              swipes={data.swipes}
              favorites={favorites}
              onOpen={(item, pick) => setOpen({ item, pick })}
            />
            {agenda.freeMaybes.length > 0 && (
              <div className="panel">
                <h3>🔖 Maybes that fit your free time</h3>
                <AgendaList items={agenda.freeMaybes} onOpen={(item) => setOpen({ item })} />
              </div>
            )}
            {agenda.unscheduled.length > 0 && (
              <div className="panel">
                <h3>No time yet</h3>
                <p className="muted small">
                  The catalog has not scheduled these yet; they will land in your week once it does.
                </p>
                <AgendaList items={agenda.unscheduled} swipes={data.swipes} onOpen={(item) => setOpen({ item })} />
              </div>
            )}
          </>
        )}
      </div>
      <LearningPlanPanel plan={plan} compact />
      {importPreview && (
        <ImportFavoritesModal preview={importPreview} onApply={applyImport} onClose={() => setImportPreview(null)} />
      )}
      {suggestions && (
        <FillWeekModal suggestions={suggestions} onAdd={addSuggestions} onClose={() => setSuggestions(null)} />
      )}
      {open && (
        <SessionModal
          item={open.item}
          heading={
            open.pick
              ? `Alternative to ${open.pick.session.code} (${formatTimeRange(open.pick.session)})`
              : data.swipes[open.item.session.id]?.decision === "like"
                ? "❤️ In your agenda"
                : "🔖 Maybe"
          }
          onClose={() => setOpen(null)}
        >
          {open.pick && (
            <button className="primary" onClick={() => swap(open.item, open.pick!)}>
              Swap: ❤️ {open.item.session.code} instead of {open.pick.session.code}
            </button>
          )}
          {data.swipes[open.item.session.id]?.decision !== "like" && !open.pick && (
            <button className="primary" onClick={() => choose(open.item.session.id, "like")}>
              ❤️ Add to my agenda
            </button>
          )}
          {data.swipes[open.item.session.id]?.decision !== "save" && (
            <button className="ghost" onClick={() => choose(open.item.session.id, "save")}>
              🔖 {data.swipes[open.item.session.id]?.decision === "like" ? "Move to maybe" : "Keep as maybe"}
            </button>
          )}
          <button className="ghost" onClick={() => choose(open.item.session.id, "pass")}>
            ❌ Not for me
          </button>
          <button className="link" onClick={() => setOpen(null)}>
            Close
          </button>
        </SessionModal>
      )}
    </section>
  );
}
