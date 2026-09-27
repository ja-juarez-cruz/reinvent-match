import type { Agenda, AgendaPick, FreeTime } from "../agenda";
import { clock, formatDay, formatTimeRange, venueOf } from "../format";
import { INTENT_META } from "../intents";
import type { Decision, PlanItem, SwipeLog } from "../types";

type OnOpen = (item: PlanItem, pick?: PlanItem) => void;

/** The marks the agenda can show, as filters. */
export const AGENDA_FILTERS: { decision: Decision; icon: string; label: string; hint: string }[] = [
  { decision: "like", icon: "❤️", label: "Interested", hint: "Your picks: the sessions you plan to attend" },
  { decision: "save", icon: "🔖", label: "Maybe", hint: "Backups: add them to see where they overlap your picks" },
  { decision: "pass", icon: "❌", label: "Not for me", hint: "Sessions you passed on: open one to take it back" },
];

const DECISION_MARK: Record<Decision, string> = { like: "", save: "🔖 Maybe", pass: "❌ Not for me" };

/** Your week as a table: days across, hours down; each pick sits in the hour it starts, with its alternatives. */
export function AgendaGrid({
  agenda,
  swipes,
  favorites,
  show,
  counts,
  onToggle,
  onOpen,
}: {
  agenda: Agenda;
  swipes: SwipeLog;
  favorites: Set<string>;
  /** The marks shown on the grid. */
  show: ReadonlySet<Decision>;
  counts: Record<Decision, number>;
  onToggle: (decision: Decision) => void;
  onOpen: OnOpen;
}) {
  return (
    <>
      <div className="agenda-filters" role="group" aria-label="Show on the calendar">
        {AGENDA_FILTERS.map((f) => (
          <button
            key={f.decision}
            className={`chip small ${show.has(f.decision) ? "on" : ""}`}
            aria-pressed={show.has(f.decision)}
            title={f.hint}
            onClick={() => onToggle(f.decision)}
          >
            {f.icon} {f.label} <span className="count">{counts[f.decision]}</span>
          </button>
        ))}
        <span className="muted small" title="Free time between sessions, after the walk to the next venue">
          ☕ free time · <span className="warn">⚠️</span> overlap
        </span>
      </div>
      <div className="agenda-scroll">
        <table className="agenda">
          <thead>
            <tr>
              <th className="agenda-hour" />
              {agenda.days.map((d) => (
                <th key={d.date}>
                  {formatDay(d.date)}
                  <span className="muted small"> · {d.picks.filter((p) => p.decision === "like").length} ❤️</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agenda.hours.map((hour) => (
              <tr key={hour}>
                <th className="agenda-hour muted small">{clock(hour * 60)}</th>
                {agenda.days.map((d) => {
                  const from = hour * 60;
                  const to = from + 60;
                  const starting = d.picks.filter((p) => p.start >= from && p.start < to);
                  const continuing = d.picks.filter((p) => p.start < from && p.end > from);
                  const lunch = d.lunchSlot && d.lunchSlot.start >= from && d.lunchSlot.start < to ? d.lunchSlot : null;
                  return (
                    <td key={d.date}>
                      {continuing.map((p) => (
                        <div key={p.item.session.id} className="agenda-cont">
                          ↳ {p.item.session.code} until {clock(p.end)}
                        </div>
                      ))}
                      {[
                        ...(lunch
                          ? [
                              {
                                start: lunch.start,
                                node: (
                                  <div key="lunch" className="agenda-lunch small">
                                    🍽 Lunch {clock(lunch.start)}–{clock(lunch.end)}
                                  </div>
                                ),
                              },
                            ]
                          : []),
                        ...d.freeTime
                          .filter((f) => f.start >= from && f.start < to)
                          .map((f) => ({ start: f.start, node: <FreeTimeNote key={`free-${f.start}`} free={f} /> })),
                        ...starting.map((p) => ({
                          start: p.start,
                          node: (
                            <PickCard
                              key={p.item.session.id}
                              pick={p}
                              swipes={swipes}
                              favorite={favorites.has(p.item.session.id)}
                              onOpen={onOpen}
                            />
                          ),
                        })),
                      ]
                        .sort((a, b) => a.start - b.start)
                        .map((entry) => entry.node)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FreeTimeNote({ free }: { free: FreeTime }) {
  return (
    <div className="agenda-free small" title={free.idea}>
      <div>
        ☕ {clock(free.start)}–{clock(free.end)} · <strong>{free.minutes} min free</strong>
      </div>
      <div className="muted">{free.idea}</div>
      {free.walk && (
        <div className="muted">
          🚶 then {free.walk.minutes} min to {free.walk.to}
        </div>
      )}
    </div>
  );
}

function PickCard({
  pick,
  swipes,
  favorite,
  onOpen,
}: {
  pick: AgendaPick;
  swipes: SwipeLog;
  favorite: boolean;
  onOpen: OnOpen;
}) {
  const s = pick.item.session;
  return (
    <div
      className={`agenda-pick decision-${pick.decision} ${pick.clashes.length + pick.repeats.length > 0 ? "clash" : ""}`}
    >
      <button className="agenda-pick-main" onClick={() => onOpen(pick.item)} title={`${s.code}: ${s.title}`}>
        <span className="small agenda-mark">
          {INTENT_META[pick.item.intent].icon} {INTENT_META[pick.item.intent].label}
          {DECISION_MARK[pick.decision] && <span className="muted"> · {DECISION_MARK[pick.decision]}</span>}
        </span>
        <span className="muted small">
          {formatTimeRange(s)} · {venueOf(s)}
        </span>
        <strong className="agenda-title">{s.title}</strong>
        <span className="muted small">
          {s.code} · {pick.item.score}%{pick.item.reservable ? " · 🎟" : ""}
          {favorite ? " · ★" : ""}
        </span>
      </button>
      {pick.repeats.map((r) => (
        <div key={r.session.id} className="small warn">
          🔁 Same session as {r.session.code} ({formatDay(r.session.schedule.date)} {r.session.schedule.startTime}):
          keep one
        </div>
      ))}
      {pick.otherTimes.length > 0 && (
        <div className="small muted" title="The same session at other times">
          🔁 Also{" "}
          {pick.otherTimes
            .map((o) => `${formatDay(o.session.schedule.date)} ${o.session.schedule.startTime}`)
            .join(", ")}
        </div>
      )}
      {pick.clashes.length > 0 && (
        <div className="small warn">⚠️ Clashes with {pick.clashes.map((c) => c.session.code).join(", ")}</div>
      )}
      {pick.alternatives.length > 0 && (
        // Collapsed by default: the week reads cleaner, and alternatives are one click away.
        <details className="agenda-alts">
          <summary className="muted small">
            ↔ Alternatives ({pick.alternatives.length + pick.moreAlternatives})
            {pick.alternatives.some((a) => swipes[a.session.id]?.decision === "save") ? " · 🔖 incl. a maybe" : ""}
          </summary>
          {pick.alternatives.map((a) => (
            <button
              key={a.session.id}
              className="agenda-alt small"
              onClick={() => onOpen(a, pick.item)}
              title={`${a.session.code}: ${a.session.title}, ${formatTimeRange(a.session)} · ${venueOf(a.session)}`}
            >
              <span>
                {swipes[a.session.id]?.decision === "save" ? "🔖 " : ""}
                {a.session.code} · {a.session.schedule.startTime} · {a.score}%
              </span>
              <span className="agenda-alt-title muted">{a.session.title}</span>
            </button>
          ))}
          {pick.moreAlternatives > 0 && <span className="muted small">+{pick.moreAlternatives} more at that time</span>}
        </details>
      )}
    </div>
  );
}

/** Sessions outside the grid: maybes that fit free time, or picks without a time yet. */
export function AgendaList({ items, swipes, onOpen }: { items: PlanItem[]; swipes?: SwipeLog; onOpen: OnOpen }) {
  return (
    <ul className="agenda-list">
      {items.map((r) => (
        <li key={r.session.id}>
          <button className="link" onClick={() => onOpen(r)}>
            {swipes?.[r.session.id]?.decision === "like" ? "❤️" : "🔖"} {r.session.code}
          </button>{" "}
          <span>{r.session.title}</span>{" "}
          <span className="muted small">
            {r.session.schedule.date ? `${formatDay(r.session.schedule.date)} · ${formatTimeRange(r.session)} · ` : ""}
            {r.score}%
          </span>
        </li>
      ))}
    </ul>
  );
}
