import type { Agenda, AgendaPick } from "../agenda";
import { clock, formatDay, formatTimeRange, venueOf } from "../format";
import type { PlanItem, SwipeLog } from "../types";

type OnOpen = (item: PlanItem, pick?: PlanItem) => void;

/** Your week as a table: days across, hours down; each pick sits in the hour it starts, with its alternatives. */
export function AgendaGrid({
  agenda,
  swipes,
  favorites,
  onOpen,
}: {
  agenda: Agenda;
  swipes: SwipeLog;
  favorites: Set<string>;
  onOpen: OnOpen;
}) {
  return (
    <div className="agenda-scroll">
      <table className="agenda">
        <thead>
          <tr>
            <th className="agenda-hour" />
            {agenda.days.map((d) => (
              <th key={d.date}>
                {formatDay(d.date)}
                <span className="muted small"> · {d.picks.length} ❤️</span>
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
                      <div key={p.item.session.id} className={`agenda-cont intent-${p.item.intent}`}>
                        ↳ {p.item.session.code} until {clock(p.end)}
                      </div>
                    ))}
                    {lunch && (
                      <div className="agenda-lunch small">
                        🍽 Lunch {clock(lunch.start)}–{clock(lunch.end)}
                      </div>
                    )}
                    {starting.map((p) => (
                      <PickCard
                        key={p.item.session.id}
                        pick={p}
                        swipes={swipes}
                        favorite={favorites.has(p.item.session.id)}
                        onOpen={onOpen}
                      />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className={`agenda-pick intent-${pick.item.intent} ${pick.clashes.length > 0 ? "clash" : ""}`}>
      <button className="agenda-pick-main" onClick={() => onOpen(pick.item)} title={`${s.code}: ${s.title}`}>
        <span className="muted small">
          {formatTimeRange(s)} · {venueOf(s)}
        </span>
        <strong className="agenda-title">{s.title}</strong>
        <span className="muted small">
          {s.code} · {pick.item.score}%{pick.item.reservable ? " · 🎟" : ""}
          {favorite ? " · ★" : ""}
        </span>
      </button>
      {pick.clashes.length > 0 && (
        <div className="small warn">⚠️ Clashes with {pick.clashes.map((c) => c.session.code).join(", ")}</div>
      )}
      {pick.alternatives.length > 0 && (
        <div className="agenda-alts">
          <span className="muted small">Alternatives</span>
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
        </div>
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
