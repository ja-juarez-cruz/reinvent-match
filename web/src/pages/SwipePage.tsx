import { useEffect, useMemo, useState } from "react";
import { navigate } from "../App";
import { CATEGORY_META, formatDay, formatTimeRange, venueOf } from "../format";
import type { AwsEvent, Category, Decision, MatchResult } from "../types";
import { useMatch } from "../useMatch";

interface Props {
  event: AwsEvent | null;
  eventId: string | null;
  profileId: string | null;
}

const TABS: Category[] = ["deep-dive", "growth", "foundation", "discovery"];
const REASON_ICON = { pro: "✅", con: "⚠️", info: "ℹ️" } as const;

export function SwipePage({ event, eventId, profileId }: Props) {
  const { data, error, decide } = useMatch(eventId, profileId);
  const [tab, setTab] = useState<Category>("deep-dive");
  const [history, setHistory] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  const byCategory = useMemo(() => {
    const groups = new Map<Category, MatchResult[]>();
    for (const r of data?.results ?? []) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
    return groups;
  }, [data]);

  const queue = useMemo(
    () => (byCategory.get(tab) ?? []).filter((r) => !data?.swipes[r.session.id]),
    [byCategory, tab, data],
  );
  const current = queue[0];

  const tally = useMemo(() => {
    const counts = { like: 0, save: 0, pass: 0 };
    for (const s of Object.values(data?.swipes ?? {})) counts[s.decision] += 1;
    return counts;
  }, [data]);

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
    const result = data?.results.find((r) => r.session.id === last);
    if (result) setTab(result.category === "skip" ? tab : result.category);
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

  if (!profileId) {
    return (
      <section className="page">
        <div className="panel">
          <p>Create a profile first so Re:Match knows what fits you.</p>
          <button className="primary" onClick={() => navigate("profile")}>
            Build your profile →
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
  if (!data) return <section className="page muted">Matching {event?.name ?? "sessions"}…</section>;

  const s = current?.session;
  const meta = current ? CATEGORY_META[current.category] : null;

  return (
    <section className="page swipe-page">
      <div className="swipe-head">
        <div className="tabs">
          {TABS.map((c) => {
            const all = byCategory.get(c) ?? [];
            const left = all.filter((r) => !data.swipes[r.session.id]).length;
            return (
              <button key={c} className={`tab ${tab === c ? "active" : ""}`} onClick={() => setTab(c)}>
                {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                <span className="count">{left}</span>
              </button>
            );
          })}
        </div>
        <div className="tally">
          ❤️ {tally.like} · 🔖 {tally.save} · ❌ {tally.pass}
          <button className="ghost small" onClick={() => navigate("shortlist")}>
            Shortlist →
          </button>
        </div>
      </div>
      <p className="muted small">{meta ? meta.hint : CATEGORY_META[tab].hint}</p>

      {!current || !s || !meta ? (
        <div className="panel empty">
          <p>
            You've reviewed every {CATEGORY_META[tab].label} session. Pick another tab or check your shortlist.
          </p>
        </div>
      ) : (
        <article className={`card cat-${current.category}`} key={s.id}>
          <div className="card-top">
            <span className={`badge cat-${current.category}`}>
              {meta.icon} {meta.label}
            </span>
            <span className="score" title="Personal match">
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
        {queue.length} left in {CATEGORY_META[tab].label}
      </p>
    </section>
  );
}
