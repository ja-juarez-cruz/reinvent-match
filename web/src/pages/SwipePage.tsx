import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api";
import { navigate } from "../App";
import { SessionCode } from "../components/SessionCode";
import { SessionModal } from "../components/SessionModal";
import { WeekStrip, explainDay } from "../components/WeekStrip";
import { formatDay, formatTimeRange, venueOf } from "../format";
import { CARD_REASONS, type AwsEvent, type Decision, type Intent, type PlanItem } from "../types";
import { usePlan } from "../usePlan";
import { ALTERNATIVES_PER_PICK, buildQueue } from "../queue";
import { buildWeek, impactOf, nextDay } from "../week";

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
const ALTERNATIVES_LABEL = ["none", "one", "two", "three"][ALTERNATIVES_PER_PICK] ?? String(ALTERNATIVES_PER_PICK);
const REASON_ICON = { pro: "✅", con: "⚠️", info: "ℹ️" } as const;

export function SwipePage({ event, eventId, answersId }: Props) {
  const { data, error, decide } = usePlan(eventId, answersId);
  const [tab, setTab] = useState<Intent>("reinforce");
  const [history, setHistory] = useState<string[]>([]);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [fullNotice, setFullNotice] = useState<string | null>(null);
  /** A picked session that clashes with the current card, opened to review or swap. */
  const [openClash, setOpenClash] = useState<PlanItem | null>(null);
  /** Clashing sessions beyond each pick's alternatives, shown only when asked for. */
  const [showRest, setShowRest] = useState(false);
  /** Day of the last ❤️ and whether it was already full, to notice the moment it fills up. */
  const pendingFullCheck = useRef<{ date: string; wasFull: boolean } | null>(null);

  const byIntent = useMemo(() => {
    const groups = new Map<Intent, PlanItem[]>();
    for (const r of data?.results ?? []) groups.set(r.intent, [...(groups.get(r.intent) ?? []), r]);
    return groups;
  }, [data]);

  const onDay = (r: PlanItem) => !dayFilter || r.session.schedule.date === dayFilter;
  const week = useMemo(() => (data ? buildWeek(data.results, data.swipes) : []), [data]);
  // Sessions that fit around your picks come first so the calendar fills fast; clashing ones wait until nothing else
  // fits, and then come as alternatives to your picks.
  const queues = useMemo(() => {
    const byTab = new Map<Intent, ReturnType<typeof buildQueue>>();
    for (const i of TABS) {
      const items = (byIntent.get(i) ?? []).filter((r) => !dayFilter || r.session.schedule.date === dayFilter);
      byTab.set(i, buildQueue(items, data?.swipes ?? {}, week, showRest));
    }
    return byTab;
  }, [byIntent, data, week, dayFilter, showRest]);
  const tabQueue = queues.get(tab)!;
  const queue = tabQueue.queue;
  const current = queue[0];
  /** Other tabs that still have sessions fitting your calendar. */
  const tabsWithFit = TABS.filter((i) => i !== tab && (queues.get(i)?.fit ?? 0) > 0);
  /** Sessions you marked 🔖 maybe that still fit: the week strip counts them among the ones left. */
  const maybeFits = useMemo(
    () =>
      (data?.results ?? []).filter((r) => {
        if (data?.swipes[r.session.id]?.decision !== "save") return false;
        if (dayFilter && r.session.schedule.date !== dayFilter) return false;
        if (!r.session.schedule.date || !r.session.schedule.startTime) return false;
        const impact = impactOf(r, week);
        return impact.clashes.length === 0 && !impact.full && !impact.breaksLunch;
      }),
    [data, week, dayFilter],
  );

  useEffect(() => {
    const pending = pendingFullCheck.current;
    if (!pending) return;
    const day = week.find((d) => d.date === pending.date);
    if (day && day.remaining <= 0 && !pending.wasFull) setFullNotice(day.date);
    pendingFullCheck.current = null;
  }, [week]);

  async function act(decision: Decision) {
    if (!current) return;
    if (decision === "like" && current.session.schedule.date) {
      const day = week.find((d) => d.date === current.session.schedule.date);
      pendingFullCheck.current = { date: current.session.schedule.date, wasFull: (day?.remaining ?? 1) <= 0 };
    }
    setHistory((h) => [...h, current.session.id]);
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
      if (openClash) return;
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
          <p>Tell Reinvent:Match what you know first; it builds your pre-list from that.</p>
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
  if (!data) return <section className="page muted">Building your pre-list for {event?.name ?? "the event"}…</section>;

  const s = current?.session;
  const meta = INTENT_META[tab];
  const impact = current ? impactOf(current, week) : null;
  const fullDay = fullNotice ? week.find((d) => d.date === fullNotice) : undefined;
  const following = fullDay ? nextDay(week, fullDay.date) : undefined;

  /** Keep the current card instead of a clashing pick; the pick stays as a 🔖 backup. */
  async function swapFor(clash: PlanItem) {
    setOpenClash(null);
    await decide(clash.session.id, "save");
    await act("like");
  }

  async function unlike(clash: PlanItem) {
    setOpenClash(null);
    await decide(clash.session.id, "save");
  }

  function chooseDay(date: string | null) {
    setDayFilter(date);
    setFullNotice(null);
  }

  return (
    <section className="page swipe-solo">
      <div className="swipe-main">
        <WeekStrip week={week} currentDate={s?.schedule.date ?? null} selectedDate={dayFilter} onSelect={chooseDay} />
        {fullDay && (
          <div className="panel notice" role="status">
            <p>
              📅 <strong>{formatDay(fullDay.date)} is full.</strong> With your {fullDay.liked.length} picks, lunch and travel
              between venues, no more sessions fit in your calendar that day.
            </p>
            <p className="muted small">{explainDay(fullDay).slice(1, -1).join(" ")}</p>
            <div className="row">
              <button className="ghost" onClick={() => chooseDay(fullDay.date)}>
                Keep reviewing {formatDay(fullDay.date)}
              </button>
              {following ? (
                <button className="primary" onClick={() => chooseDay(following.date)}>
                  Go to {formatDay(following.date)} →
                </button>
              ) : (
                <button className="primary" onClick={() => chooseDay(null)}>
                  Review all days
                </button>
              )}
            </div>
          </div>
        )}
        <div className="swipe-head">
          <div className="tabs">
            {TABS.map((i) => {
              const left = (byIntent.get(i) ?? []).filter((r) => !data.swipes[r.session.id] && onDay(r)).length;
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
        {dayFilter && (
          <div className="row small">
            <span className="chip on small">Only {formatDay(dayFilter)}</span>
            <button className="link small" onClick={() => chooseDay(null)}>
              Show all days
            </button>
          </div>
        )}
        <p className="muted small">
          {meta.hint} Sessions that need a reserved seat come first. {data.hidden.format > 0 && `${data.hidden.format} sessions hidden by your format choices.`}{" "}
          {data.hidden.tooBasic > 0 && `${data.hidden.tooBasic} too basic for your level.`}{" "}
          {data.hidden.aiNotReady > 0 && `${data.hidden.aiNotReady} AI sessions assume more AI background than you have yet.`}{" "}
          {data.hidden.ignored > 0 && `${data.hidden.ignored} built around platforms you marked as not for you.`}
        </p>

        {tabQueue.stage !== "fill" && (tabQueue.alternatives > 0 || tabQueue.rest > 0) && (
          <div className="panel notice" role="status">
            {tabQueue.stage === "alternatives" ? (
              <p>
                🔁 <strong>No new sessions in {meta.label} fit your calendar{dayFilter ? ` on ${formatDay(dayFilter)}` : ""}.</strong>{" "}
                Now come alternatives to your picks, up to {ALTERNATIVES_LABEL} each: swap one in, keep both, or keep yours and
                pass.
              </p>
            ) : (
              <p>
                ✅ <strong>Your picks have their alternatives.</strong> {tabQueue.rest} more session
                {tabQueue.rest === 1 ? "" : "s"} in {meta.label} clash with your picks or land on full days.
              </p>
            )}
            <div className="row">
              {tabsWithFit.map((i) => (
                <button key={i} className="primary" onClick={() => setTab(i)}>
                  {queues.get(i)!.fit} still fit in {INTENT_META[i].icon} {INTENT_META[i].label} →
                </button>
              ))}
              {tabQueue.stage === "rest" && tabQueue.rest > 0 && (
                <button className="ghost" onClick={() => setShowRest((v) => !v)}>
                  {showRest ? "Hide them" : `Show the other ${tabQueue.rest}`}
                </button>
              )}
            </div>
            {maybeFits.length > 0 && (
              <div className="maybe-fits">
                <p className="muted small">
                  🔖 Still fit from your Maybe list (the week counts them as left):
                </p>
                <div className="row">
                  {maybeFits.map((r) => (
                    <span key={r.session.id} className="maybe-fit">
                      <SessionCode session={r.session} /> {formatDay(r.session.schedule.date)} {r.session.schedule.startTime}
                      <button className="ghost small" onClick={() => void decide(r.session.id, "like")}>
                        ❤️ Interested
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!current || !s ? (
          tabQueue.stage === "rest" && tabQueue.rest > 0 ? null : (
            <div className="panel empty">
              <p>
                You've reviewed every session in {meta.label}
                {dayFilter ? ` on ${formatDay(dayFilter)}` : ""}. Pick another tab{dayFilter ? " or day" : ""}, or check your
                shortlist.
              </p>
            </div>
          )
        ) : (
          <article className={`card intent-${current.intent}`} key={s.id}>
            <div className="card-top">
              <span className="badges">
                <span className={`badge intent-${current.intent}`}>
                  {INTENT_META[current.intent].icon} {INTENT_META[current.intent].label}
                </span>
                {current.reservable ? (
                  <span className="badge badge-reserve" title="Seats are limited: reserve when reserved seating opens">
                    🎟 Reserved seating
                  </span>
                ) : (
                  <span className="badge badge-walkin" title="No reservation: walk in">
                    Walk-in
                  </span>
                )}
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
            {impact && (impact.clashes.length > 0 || impact.full || impact.breaksLunch) && (
              <div className="impact">
                {impact.clashes.map(({ item, reason }) => (
                  <div key={item.session.id}>
                    ⚠️ {reason === "overlap" ? "Overlaps with" : "Not enough time to get to or from"}{" "}
                    <SessionCode session={item.session} onOpen={() => setOpenClash(item)} /> (
                    {item.session.schedule.startTime ?? "TBA"}, {venueOf(item.session)}),
                    already in your picks.
                  </div>
                ))}
                {impact.breaksLunch && !impact.full && <div>🍽 Leaves no time for lunch with your picks that day.</div>}
                {impact.full && impact.day && (
                  <div>
                    ⛔ {formatDay(impact.day.date)} is full: {explainDay(impact.day).slice(1, -1).join(" ")}
                  </div>
                )}
              </div>
            )}
            <ul className="reasons">
              {current.reasons.filter((r) => CARD_REASONS.has(r.about ?? "")).map((r, i) => (
                <li key={i} className={`reason reason-${r.kind}`}>
                  <span>{REASON_ICON[r.kind]}</span> {r.text}
                </li>
              ))}
            </ul>
            <p className="abstract">{s.abstract}</p>
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
          {tabQueue.stage === "fill"
            ? `${tabQueue.fit} that fit your calendar in ${meta.label}${tabQueue.alternatives + tabQueue.rest > 0 ? ` · ${tabQueue.alternatives + tabQueue.rest} clashing, for later` : ""}`
            : tabQueue.stage === "alternatives"
              ? `${tabQueue.alternatives} alternatives left in ${meta.label}`
              : showRest
                ? `${queue.length} left in ${meta.label}`
                : ""}
        </p>
      </div>
      {openClash && current && (
        <SessionModal
          item={openClash}
          heading={`Already in your picks · clashes with ${current.session.code}`}
          onClose={() => setOpenClash(null)}
        >
          <button className="primary" onClick={() => swapFor(openClash)}>
            Swap: ❤️ {current.session.code} instead
          </button>
          <button className="ghost" onClick={() => unlike(openClash)}>
            Remove ❤️ from {openClash.session.code}
          </button>
          <button className="link" onClick={() => setOpenClash(null)}>
            Keep both
          </button>
          <p className="muted small">
            A session you swap out or remove stays in your shortlist as 🔖 maybe, as a backup, and is removed from your
            official favorites the next time you sync.
          </p>
        </SessionModal>
      )}
    </section>
  );
}
