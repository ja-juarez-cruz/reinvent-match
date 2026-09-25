import { LUNCH_MINUTES, type WeekDay } from "../week";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const DAY_NUMBER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function capacityLabel(day: WeekDay): { text: string; tone: "ok" | "low" | "full" } {
  if (day.remaining <= 0) return { text: "Full", tone: "full" };
  return { text: `${day.remaining} left`, tone: day.remaining <= 1 ? "low" : "ok" };
}

function describe(day: WeekDay): string {
  const lines = [
    `Up to ${day.capacity} sessions fit this day with a ${LUNCH_MINUTES}-minute lunch and travel between venues.`,
    day.liked.length === 0 ? "Nothing picked yet." : `${day.remaining} more fit around your picks:`,
    ...day.liked.map((i) => `  ${i.session.schedule.startTime ?? "TBA"} ${i.session.code} ${i.session.title}`),
  ];
  if (!day.lunchFits) lines.push(`Your picks leave no ${LUNCH_MINUTES}-minute lunch break between 11:00 and 14:00.`);
  return lines.join("\n");
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
              {day.liked.length} ❤️ <span className="muted">of {day.capacity} max</span>
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
