import { formatDay, formatTimeRange, venueOf } from "../format";
import type { Session } from "../types";

/** A session code that shows the session's title, day, time and venue on hover or focus. */
export function SessionCode({ session }: { session: Session }) {
  const when = `${formatDay(session.schedule.date)} · ${formatTimeRange(session)} · ${venueOf(session)}`;
  return (
    <span className="session-code" tabIndex={0} aria-label={`${session.code}: ${session.title}, ${when}`}>
      {session.code}
      <span className="session-code-tip" role="tooltip">
        <strong>{session.title}</strong>
        <span>{when}</span>
      </span>
    </span>
  );
}
