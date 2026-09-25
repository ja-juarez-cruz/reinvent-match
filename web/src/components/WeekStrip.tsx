import { DAILY_LIMIT, type WeekDay } from "../week";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const DAY_NUMBER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function capacityLabel(remaining: number): { text: string; tone: "ok" | "low" | "full" } {
  if (remaining < 0) return { text: `+${-remaining} over`, tone: "full" };
  if (remaining === 0) return { text: "Full", tone: "full" };
  return { text: `${remaining} left`, tone: remaining <= 2 ? "low" : "ok" };
}

export function WeekStrip({ week, currentDate }: { week: WeekDay[]; currentDate: string | null }) {
  return (
    <div className="week" aria-label="Your week">
      {week.map((day) => {
        const date = new Date(`${day.date}T00:00:00Z`);
        const capacity = capacityLabel(day.remaining);
        const clashes = day.overlapping.length;
        return (
          <div
            key={day.date}
            className={`week-day ${day.date === currentDate ? "current" : ""}`}
            title={
              day.liked.length === 0
                ? `Nothing picked yet; up to ${DAILY_LIMIT} sessions fit this day.`
                : day.liked
                    .map((i) => `${i.session.schedule.startTime ?? "TBA"} ${i.session.code} ${i.session.title}`)
                    .join("\n")
            }
          >
            <span className={`capacity capacity-${capacity.tone}`}>{capacity.text}</span>
            {clashes > 0 && (
              <span className="clash-mark" title={`${clashes} of your sessions overlap on this day`}>
                ⚠ {clashes}
              </span>
            )}
            <span className="week-name">{WEEKDAY.format(date)}</span>
            <span className="muted small">{DAY_NUMBER.format(date)}</span>
            <span className="week-slots" aria-hidden="true">
              {Array.from({ length: Math.max(DAILY_LIMIT, day.liked.length) }, (_, i) => {
                const picked = day.liked[i];
                const cls = !picked ? "slot-empty" : day.overlapping.includes(picked) ? "slot-clash" : "slot-taken";
                return <span key={i} className={`week-slot ${cls} ${i >= DAILY_LIMIT ? "slot-over" : ""}`} />;
              })}
            </span>
            <span className="small">
              {day.liked.length} ❤️
            </span>
          </div>
        );
      })}
    </div>
  );
}
