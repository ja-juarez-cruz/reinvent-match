import { useEffect, type ReactNode } from "react";
import { formatDay, formatTimeRange, venueOf } from "../format";
import type { PlanItem } from "../types";

const REASON_ICON = { pro: "✅", con: "⚠️", info: "ℹ️" } as const;

/** A session shown on top of the swipe card, with actions supplied by the caller. Esc or the backdrop closes it. */
export function SessionModal({
  item,
  heading,
  onClose,
  children,
}: {
  item: PlanItem;
  heading: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const s = item.session;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="muted small">{heading}</div>
        <div className="card-top">
          <span className="muted small">
            {s.code} · {item.intent} · {item.reservable ? "🎟 Reserved seating" : "Walk-in"}
          </span>
          <span className="score-small">{item.score}%</span>
        </div>
        <h2 id="session-modal-title" className="card-title">
          {s.title}
        </h2>
        <div className="meta">
          <span>{s.formatLabel ?? s.format}</span>
          {s.levelLabel && <span>{s.levelLabel}</span>}
          <span>
            {formatDay(s.schedule.date)} · {formatTimeRange(s)}
          </span>
          <span>{venueOf(s)}</span>
        </div>
        <ul className="reasons">
          {item.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className={`reason reason-${r.kind}`}>
              <span>{REASON_ICON[r.kind]}</span> {r.text}
            </li>
          ))}
        </ul>
        <div className="modal-actions">{children}</div>
      </div>
    </div>
  );
}
