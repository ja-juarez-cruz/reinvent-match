import type { LearningPlan, PlanEntry } from "../learningPlan";

const GROUPS: { id: "reinforce" | "broaden" | "learn" | "skills"; title: string; hint: string }[] = [
  { id: "reinforce", title: "💪 Reinforce", hint: "What you know, taken deeper" },
  { id: "broaden", title: "🧭 Broaden", hint: "New ground next to what you know" },
  { id: "learn", title: "🌱 Learn", hint: "New topics and technologies" },
  { id: "skills", title: "🛠 Skills to develop", hint: "Architecture and engineering practices" },
];

export function LearningPlanPanel({ plan, compact = false }: { plan: LearningPlan; compact?: boolean }) {
  return (
    <aside className="panel plan-panel">
      <h3>Your learning plan</h3>
      {plan.sessions === 0 ? (
        <p className="muted small">
          Mark sessions with ❤️ and this fills in with what you will reinforce, broaden, learn and practice.
        </p>
      ) : (
        <>
          <div className="plan-stats">
            <div>
              <strong>{plan.sessions}</strong>
              <span className="muted small">sessions</span>
            </div>
            <div>
              <strong>{plan.hours}h</strong>
              <span className="muted small">of content</span>
            </div>
            <div>
              <strong>{plan.handsOn}</strong>
              <span className="muted small">hands-on</span>
            </div>
            <div className={plan.conflicts > 0 ? "warn" : ""}>
              <strong>{plan.conflicts}</strong>
              <span className="muted small">overlaps</span>
            </div>
          </div>
          <p className="muted small plan-mix">
            {plan.byIntent.reinforce} to reinforce · {plan.byIntent.broaden} to broaden · {plan.byIntent.learn} to learn
          </p>
          {GROUPS.map((g) => (
            <PlanGroup key={g.id} title={g.title} hint={g.hint} entries={plan[g.id]} limit={compact ? 4 : 8} />
          ))}
        </>
      )}
    </aside>
  );
}

function PlanGroup({ title, hint, entries, limit }: { title: string; hint: string; entries: PlanEntry[]; limit: number }) {
  if (entries.length === 0) return null;
  const max = entries[0]?.count ?? 1;
  return (
    <div className="plan-group">
      <div className="plan-group-head">
        <strong className="small">{title}</strong>
        <span className="muted small">{hint}</span>
      </div>
      {entries.slice(0, limit).map((e) => (
        <div key={e.key} className="plan-row" title={`${e.label}: ${e.count} of your sessions`}>
          <span className="plan-label small">{e.label}</span>
          <span className="plan-bar-track">
            <span className="plan-bar" style={{ width: `${(100 * e.count) / max}%` }} />
          </span>
          <span className="muted small plan-count">{e.count}</span>
        </div>
      ))}
      {entries.length > limit && <span className="muted small">+{entries.length - limit} more</span>}
    </div>
  );
}
