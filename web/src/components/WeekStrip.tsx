import { clock } from "../format";
import { LUNCH_MINUTES, SAME_VENUE_MINUTES, type WeekDay } from "../week";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const DAY_NUMBER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function capacityLabel(day: WeekDay): { text: string; tone: "ok" | "low" | "full" } {
  if (day.remaining <= 0) return { text: "Full", tone: "full" };
  return { text: `${day.remaining} left`, tone: day.remaining <= 1 ? "low" : "ok" };
}

/** Shortest slot a session needs between two picks: travel both ways around a 20-minute talk. */
const SHORTEST_FIT = 20 + 2 * SAME_VENUE_MINUTES;

/** Why a day has the room it has, in plain sentences; also used by the day-full notice. */
export function explainDay(day: WeekDay): string[] {
  const lines: string[] = [];
  if (day.liked.length === 0) {
    lines.push(`Nothing picked yet. Up to ${day.capacity} sessions could fit, for example back-to-back short talks.`);
    return lines;
  }
  lines.push(
    day.remaining > 0
      ? `With your picks, ${day.remaining} more ${day.remaining === 1 ? "session fits" : "sessions fit"}.`
      : "With your picks, nothing else fits.",
  );
  if (day.remaining <= 0 && day.span) {
    const minutes = (gaps: number[]) => [...new Set(gaps)].sort((a, b) => a - b).join(", ");
    const short = day.gaps.filter((g) => g > 0 && g < SHORTEST_FIT);
    const long = day.gaps.filter((g) => g >= SHORTEST_FIT);
    let text = `Your picks run from ${clock(day.span.start)} to ${clock(day.span.end)}.`;
    if (short.length > 0) {
      text += ` Gaps of ${minutes(short)} min are too short for a talk with travel (it needs ${SHORTEST_FIT} min).`;
    }
    if (long.length > 0) {
      text += day.lunchSlot
        ? ` The longer gap (${minutes(long)} min) goes to lunch or has no session that fits.`
        : ` No remaining session fits in the ${minutes(long)} min gap.`;
    }
    lines.push(text);
  }
  if (day.lunchSlot) lines.push(`Lunch fits at ${clock(day.lunchSlot.start)}–${clock(day.lunchSlot.end)}.`);
  else if (!day.lunchFits) lines.push(`Your picks leave no ${LUNCH_MINUTES}-minute lunch break between 11:00 and 14:00.`);
  lines.push(`At most ${day.capacity} sessions fit this day overall (for example, back-to-back short talks).`);
  return lines;
}

function describe(day: WeekDay): string {
  return [
    ...explainDay(day),
    ...day.liked.map((i) => `  ${i.session.schedule.startTime ?? "TBA"} ${i.session.code} ${i.session.title}`),
  ].join("\n");
}

export function WeekStrip({
  week,
  currentDate,
  selectedDate,
  onSelect,
}: {
  week: WeekDay[];
  currentDate: string | null;
  /** Day the swipe queue is limited to, if any. */
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}) {
  return (
    <div className="week" aria-label="Your week">
      {week.map((day) => {
        const date = new Date(`${day.date}T00:00:00Z`);
        const capacity = capacityLabel(day);
        const clashes = day.overlapping.length;
        const slots = day.liked.length + Math.max(day.remaining, 0);
        return (
          <button
            key={day.date}
            className={`week-day ${day.date === currentDate ? "current" : ""} ${day.date === selectedDate ? "selected" : ""}`}
            title={`${describe(day)}\n\nClick to review only this day.`}
            onClick={() => onSelect(day.date === selectedDate ? null : day.date)}
          >
            <span className={`capacity capacity-${capacity.tone}`}>{capacity.text}</span>
            <span className="week-name">{WEEKDAY.format(date)}</span>
            <span className="muted small">{DAY_NUMBER.format(date)}</span>
            <span className="week-slots" aria-hidden="true">
              {Array.from({ length: slots }, (_, i) => {
                const picked = day.liked[i];
                const cls = !picked ? "slot-empty" : day.overlapping.includes(picked) ? "slot-clash" : "slot-taken";
                return <span key={i} className={`week-slot ${cls}`} />;
              })}
            </span>
            <span className="small">
              {day.liked.length} ❤️{" "}
              <span className="muted">
                · {day.remaining > 0 ? `${day.remaining} more fit` : "Full"}
              </span>
            </span>
            <span className="week-marks">
              {clashes > 0 && <span className="clash-mark">⚠ {clashes} overlap</span>}
              {!day.lunchFits && <span className="lunch-mark">🍽 no lunch</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
