import { useEffect, useState } from "react";
import { formatDay, formatTimeRange, venueOf } from "../format";
import { INTENT_META } from "../intents";
import type { Suggestion } from "../suggest";
import { SUGGEST_MIN_SCORE } from "../suggest";

/** The suggested sessions for the free time in the week, to review and add in one go. */
export function FillWeekModal({
  suggestions,
  onAdd,
  onClose,
}: {
  suggestions: Suggestion[];
  onAdd: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(() => new Set(suggestions.map((s) => s.item.session.id)));
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = [...new Set(suggestions.map((s) => s.item.session.schedule.date))];
  const toggle = (id: string) =>
    setChosen((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel fill-week"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fill-week-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fill-week-title">✨ Fill my week</h2>
        {suggestions.length === 0 ? (
          <p className="muted">
            Your week is full, or nothing left scores {SUGGEST_MIN_SCORE}% or more in your free time.
          </p>
        ) : (
          <>
            <p className="muted small">
              Sessions that fit your free time around your picks, lunch and travel: your 🔖 maybes first, then your best
              matches. Untick any you don't want.
            </p>
            {days.map((day) => (
              <div key={day} className="fill-day">
                <h3>{formatDay(day)}</h3>
                {suggestions
                  .filter((s) => s.item.session.schedule.date === day)
                  .map(({ item, from }) => (
                    <label key={item.session.id} className="fill-row">
                      <input
                        type="checkbox"
                        checked={chosen.has(item.session.id)}
                        onChange={() => toggle(item.session.id)}
                      />
                      <span className="code small">{formatTimeRange(item.session)}</span>
                      <span>
                        <strong>{item.session.title}</strong>
                        <span className="muted small">
                          {" "}
                          · {INTENT_META[item.intent].icon} {item.session.code} · {venueOf(item.session)} · {item.score}
                          %{from === "maybe" ? " · 🔖 your maybe" : ""}
                          {item.reservable ? " · 🎟" : ""}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          {suggestions.length > 0 && (
            <button
              className="primary"
              disabled={chosen.size === 0 || adding}
              onClick={async () => {
                setAdding(true);
                await onAdd([...chosen]);
                setAdding(false);
              }}
            >
              {adding ? "Adding…" : `❤️ Add ${chosen.size} to my agenda`}
            </button>
          )}
          <button className="link" onClick={onClose}>
            {suggestions.length > 0 ? "Cancel" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
