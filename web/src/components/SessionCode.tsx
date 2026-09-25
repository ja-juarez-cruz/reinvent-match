import { formatDay, formatTimeRange, venueOf } from "../format";
import type { Session } from "../types";

/**
 * A session code that shows the session's title, day, time and venue on hover or focus. With `onOpen` it is also a
 * button that opens the session.
 */
export function SessionCode({ session, onOpen }: { session: Session; onOpen?: () => void }) {
  // Drop focus when opening, so the hover/focus tooltip does not linger behind whatever opens.
  const open = (target: HTMLElement) => {
    target.blur();
    onOpen?.();
  };
  const when = `${formatDay(session.schedule.date)} · ${formatTimeRange(session)} · ${venueOf(session)}`;
  const label = `${session.code}: ${session.title}, ${when}${onOpen ? ". Open to review it" : ""}`;
  return (
    <span
      className={`session-code ${onOpen ? "clickable" : ""}`}
      tabIndex={0}
      role={onOpen ? "button" : undefined}
      aria-label={label}
      onClick={onOpen ? (e) => open(e.currentTarget) : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          open(e.currentTarget);
        }
      }}
    >
      {session.code}
      <span className="session-code-tip" role="tooltip">
        <strong>{session.title}</strong>
        <span>{when}</span>
        {onOpen && <span className="muted-tip">Click to review or swap it</span>}
      </span>
    </span>
  );
}
