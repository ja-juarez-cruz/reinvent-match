import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import { navigate } from "../App";
import { LearningPlanPanel } from "../components/LearningPlanPanel";
import { WeekStrip } from "../components/WeekStrip";
import { formatDay, formatTimeRange, venueOf } from "../format";
import { buildLearningPlan } from "../learningPlan";
import type { AwsEvent, Decision, Intent, PlanItem } from "../types";
import { usePlan } from "../usePlan";
import { buildWeek, impactOf } from "../week";

interface Props {
  event: AwsEvent | null;
  eventId: string | null;
  answersId: string | null;
}

export const INTENT_META: Record<Intent, { label: string; icon: string; hint: string }> = {
  reinforce: { label: "Reinforce", icon: "💪", hint: "Go deeper on what you already know, at your level or above." },
  broaden: { label: "Broaden", icon: "🧭", hint: "Take what you know into neighboring topics." },
  learn: { label: "Learn", icon: "🌱", hint: "New topics, at an entry level that fits your experience." },
};

const TABS: Intent[] = ["reinforce", "broaden", "learn"];
const REASON_ICON = { pro: "✅", con: "⚠️", info: "ℹ️" } as const;

export function SwipePage({ event, eventId, answersId }: Props) {
  const { data, error, decide } = usePlan(eventId, answersId);
  const [tab, setTab] = useState<Intent>("reinforce");
  const [history, setHistory] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  const byIntent = useMemo(() => {
    const groups = new Map<Intent, PlanItem[]>();
    for (const r of data?.results ?? []) groups.set(r.intent, [...(groups.get(r.intent) ?? []), r]);
    return groups;
  }, [data]);

  const queue = useMemo(
    () => (byIntent.get(tab) ?? []).filter((r) => !data?.swipes[r.session.id]),
    [byIntent, tab, data],
  );
  const current = queue[0];
  const plan = useMemo(() => (data ? buildLearningPlan(data.results, data.swipes, data.context) : null), [data]);
  const week = useMemo(() => (data ? buildWeek(data.results, data.swipes) : []), [data]);

  async function act(decision: Decision) {
    if (!current) return;
    setHistory((h) => [...h, current.session.id]);
    setExpanded(false);
    await decide(current.session.id, decision);
  }

  async function undo() {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    const item = data?.results.find((r) => r.session.id === last);
    if (item) setTab(item.intent);
    await decide(last, null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") void act("like");
      else if (e.key === "ArrowLeft") void act("pass");
      else if (e.key === "ArrowDown") void act("save");
      else if (e.key === "Backspace" || e.key.toLowerCase() === "u") void undo();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!answersId || (error instanceof ApiError && error.code === "answers-missing")) {
    return (
      <section className="page">
        <div className="panel">
          <p>Tell Re:Match what you know first; it builds your pre-list from that.</p>
          <button className="primary" onClick={() => navigate("profile")}>
            About you →
          </button>
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="page">
        <div className="panel">
          <p className="error">{error.message}</p>
          <button className="primary" onClick={() => navigate("home")}>
            Back to event
          </button>
        </div>
      </section>
    );
  }
  if (!data || !plan) return <section className="page muted">Building your pre-list for {event?.name ?? "the event"}…</section>;

  const s = current?.session;
  const meta = INTENT_META[tab];
  const impact = current ? impactOf(current, week) : null;

  return (
    <section className="page swipe-layout">
      <div className="swipe-main">
        <WeekStrip week={week} currentDate={s?.schedule.date ?? null} />
        <div className="swipe-head">
          <div className="tabs">
            {TABS.map((i) => {
              const left = (byIntent.get(i) ?? []).filter((r) => !data.swipes[r.session.id]).length;
              return (
                <button key={i} className={`tab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>
                  {INTENT_META[i].icon} {INTENT_META[i].label}
                  <span className="count">{left}</span>
                </button>
              );
            })}
          </div>
          <button className="ghost small" onClick={() => navigate("shortlist")}>
            Shortlist →
          </button>
        </div>
        <p className="muted small">
          {meta.hint} {data.hidden.format > 0 && `${data.hidden.format} sessions hidden by your format choices.`}{" "}
          {data.hidden.tooBasic > 0 && `${data.hidden.tooBasic} too basic for your level.`}
        </p>

        {!current || !s ? (
          <div className="panel empty">
            <p>You've reviewed every session in {meta.label}. Pick another tab or check your shortlist.</p>
          </div>
        ) : (
          <article className={`card intent-${current.intent}`} key={s.id}>
            <div className="card-top">
              <span className={`badge intent-${current.intent}`}>
                {INTENT_META[current.intent].icon} {INTENT_META[current.intent].label}
              </span>
              <span className="score" title="How well it fits your answers">
                {current.score}%
              </span>
            </div>
            <div className="code muted small">
              {s.code}
              {s.isSponsored ? " · Sponsored" : ""}
            </div>
            <h2 className="card-title">{s.title}</h2>
            <div className="meta">
              <span>{s.formatLabel ?? s.format}</span>
              {s.levelLabel && <span>{s.levelLabel}</span>}
              <span>
                {formatDay(s.schedule.date)} · {formatTimeRange(s)}
              </span>
              <span>{venueOf(s)}</span>
            </div>
            {impact && (impact.clashes.length > 0 || impact.full) && (
              <div className="impact">
                {impact.clashes.map(({ item, reason }) => (
                  <div key={item.session.id}>
                    ⚠️ {reason === "overlap" ? "Overlaps with" : "Not enough time to get to or from"} {item.session.code} (
                    {item.session.schedule.startTime ?? "TBA"}, {venueOf(item.session)}), already in your picks.
                  </div>
                ))}
                {impact.full && impact.day && (
                  <div>
                    ⛔ {formatDay(impact.day.date)} is full: with your {impact.day.liked.length} picks, lunch and travel, nothing
                    else fits.
                  </div>
                )}
              </div>
            )}
            <ul className="reasons">
              {current.reasons.map((r, i) => (
                <li key={i} className={`reason reason-${r.kind}`}>
                  <span>{REASON_ICON[r.kind]}</span> {r.text}
                </li>
              ))}
            </ul>
            <p className={`abstract ${expanded ? "open" : ""}`}>{s.abstract}</p>
            {s.abstract.length > 280 && (
              <button className="link small" onClick={() => setExpanded((x) => !x)}>
                {expanded ? "Show less" : "Read full abstract"}
              </button>
            )}
            {s.speakers.length > 0 && <p className="muted small">🎤 {s.speakers.join(" · ")}</p>}
            <div className="actions">
              <button className="act pass" onClick={() => act("pass")} title="Not for me (←)">
                ❌ <span>Not for me</span>
              </button>
              <button className="act save" onClick={() => act("save")} title="Maybe (↓)">
                🔖 <span>Maybe</span>
              </button>
              <button className="act like" onClick={() => act("like")} title="Interested (→)">
                ❤️ <span>Interested</span>
              </button>
            </div>
            <div className="keys muted small">
              ← not for me · ↓ maybe · → interested · U undo
              {history.length > 0 && (
                <button className="link small" onClick={undo}>
                  Undo last
                </button>
              )}
            </div>
          </article>
        )}
        <p className="muted small center">
          {queue.length} left in {meta.label}
        </p>
      </div>
      <LearningPlanPanel plan={plan} compact />
    </section>
  );
}
