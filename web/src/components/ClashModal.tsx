import { useEffect } from "react";
import { formatWhen, venueOf } from "../format";
import { INTENT_META } from "../intents";
import type { Decision, PlanItem, SwipeLog } from "../types";
import { blockOf } from "../week";

const MARK: Record<Decision, string> = { like: "❤️", save: "🔖", pass: "❌" };

/**
 * Two sessions in view that clash, side by side, with the ways out: keep one (the other becomes a 🔖 backup, or is
 * dropped if it already was one), move one to another time it is offered, or keep both on purpose.
 */
export function ClashModal({
  a,
  b,
  swipes,
  otherTimes,
  clashesAt,
  onKeep,
  onMove,
  onClose,
}: {
  a: PlanItem;
  b: PlanItem;
  swipes: SwipeLog;
  /** Other times each session is offered (see ../repeats.ts). */
  otherTimes: (item: PlanItem) => PlanItem[];
  /** Picks another time would clash with, so a move does not trade one clash for another unseen. */
  clashesAt: (to: PlanItem, from: PlanItem) => PlanItem[];
  onKeep: (keep: PlanItem, drop: PlanItem) => Promise<void>;
  onMove: (from: PlanItem, to: PlanItem) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const x = blockOf(a);
  const y = blockOf(b);
  const overlap = !!x && !!y && x.start < y.end && y.start < x.end;
  // Two times of one session (SVS324-R and SVS324-R1): no move needed, just pick one.
  const sameSession = otherTimes(a).some((o) => o.session.id === b.session.id);
  const decisionOf = (item: PlanItem): Decision => swipes[item.session.id]?.decision ?? "like";
  const dropped = (item: PlanItem) => (decisionOf(item) === "like" ? "becomes 🔖 maybe" : "is dropped (❌)");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel clash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clash-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clash-title">⚠️ Resolve a clash</h2>
        <p className="muted small">
          {sameSession
            ? "The same session at two times: keep the time that suits you."
            : overlap
              ? "These two sessions overlap."
              : "These two don't overlap, but there isn't enough time to get from one venue to the other."}
        </p>
        <div className="clash-sides">
          {[
            [a, b],
            [b, a],
          ].map(([item, other]) => {
            const s = item!.session;
            const moves = sameSession ? [] : otherTimes(item!);
            return (
              <div key={s.id} className="panel clash-side">
                <div className="small">
                  {MARK[decisionOf(item!)]} {INTENT_META[item!.intent].icon} {INTENT_META[item!.intent].label} ·{" "}
                  {item!.score}%
                </div>
                <strong>{s.title}</strong>
                <div className="muted small">
                  {s.code} · {formatWhen(s)} · {venueOf(s)}
                </div>
                <button className="primary" onClick={() => onKeep(item!, other!)}>
                  Keep {s.code}
                </button>
                <div className="muted small">
                  {other!.session.code} {dropped(other!)}
                </div>
                {moves.map((m) => (
                  <button key={m.session.id} className="ghost small" onClick={() => onMove(item!, m)}>
                    🔁 Move {s.code} to {formatWhen(m.session)} · {venueOf(m.session)}
                    {clashesAt(m, item!).length > 0 && (
                      <span className="warn">
                        {" "}
                        · ⚠️ clashes there with{" "}
                        {clashesAt(m, item!)
                          .map((c) => c.session.code)
                          .join(", ")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="link" onClick={onClose}>
            Keep both for now
          </button>
        </div>
      </div>
    </div>
  );
}
