import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatDay } from "../format";
import type { AwsEvent, CatalogReport, CountBucket as Bucket, DimensionKey, TaggedSession } from "../types";

interface Props {
  event: AwsEvent | null;
  eventId: string | null;
}

type Filters = Partial<Record<DimensionKey, string[]>>;

const DIMENSION_TITLES: Record<DimensionKey, string> = {
  primaryDomain: "Main topic",
  domain: "Topic",
  aiSubtopic: "AI subtopic",
  technology: "Technology",
  audience: "Audience",
  learningStyle: "Learning style",
  contentType: "Content type",
  concept: "Concept",
  level: "Level",
  track: "AWS track",
  day: "Day",
  venue: "Venue",
};

function valuesOf(dim: DimensionKey, s: TaggedSession): string[] {
  switch (dim) {
    case "primaryDomain":
      return [s.primaryDomain];
    case "domain":
      return s.domains;
    case "aiSubtopic":
      return s.aiSubtopics;
    case "technology":
      return s.technologies;
    case "audience":
      return s.audiences.length > 0 ? s.audiences : ["unspecified"];
    case "learningStyle":
      return [s.learningStyle];
    case "contentType":
      return s.contentTypes;
    case "concept":
      return s.concepts;
    case "level":
      return [s.level];
    case "track":
      return [s.track ? `${s.track.code} · ${s.track.label}` : "No track"];
    case "day":
      return [s.date ?? "none"];
    case "venue":
      return [s.venue ?? "Venue TBA"];
  }
}

const ORDERED: DimensionKey[] = ["level", "day"];

// Sequential blue ramp (dataviz reference palette), light → dark. Dark mode walks it the other way.
const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

function useDarkMode(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

function heatColor(value: number, max: number, dark: boolean): { background: string; color: string } | undefined {
  if (value === 0 || max === 0) return undefined;
  const t = Math.sqrt(value / max);
  const index = Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)));
  const background = dark ? RAMP[RAMP.length - 1 - index]! : RAMP[index]!;
  const strong = dark ? index < RAMP.length / 2 : index >= RAMP.length / 2;
  return { background, color: strong ? "#ffffff" : "#0b0b0b" };
}

export function InsightsPage({ event, eventId }: Props) {
  const [report, setReport] = useState<CatalogReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [crossBy, setCrossBy] = useState<"level" | "day" | "audience" | "learningStyle">("level");
  const [rowsShown, setRowsShown] = useState(60);
  const dark = useDarkMode();

  useEffect(() => {
    setReport(null);
    setError(null);
    if (eventId) api.report(eventId).then(setReport, (e: Error) => setError(e.message));
  }, [eventId]);

  const labels = useMemo(() => {
    const map = new Map<DimensionKey, Map<string, string>>();
    if (!report) return map;
    for (const [dim, buckets] of Object.entries(report.dimensions) as [DimensionKey, Bucket[]][]) {
      map.set(dim, new Map(buckets.map((b) => [b.id, b.label])));
    }
    map.set("primaryDomain", map.get("domain") ?? new Map());
    return map;
  }, [report]);
  const labelOf = (dim: DimensionKey, id: string) =>
    dim === "day" ? (id === "none" ? "Unscheduled" : formatDay(id)) : (labels.get(dim)?.get(id) ?? id);

  const filtered = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    return report.sessions.filter((s) => {
      for (const [dim, ids] of Object.entries(filters) as [DimensionKey, string[]][]) {
        if (ids.length > 0 && !valuesOf(dim, s).some((v) => ids.includes(v))) return false;
      }
      if (!q) return true;
      return `${s.code} ${s.title} ${s.technologies.join(" ")}`.toLowerCase().includes(q);
    });
  }, [report, filters, search]);

  function counts(dim: DimensionKey, items = filtered): Bucket[] {
    const map = new Map<string, number>();
    for (const s of items) for (const v of new Set(valuesOf(dim, s))) map.set(v, (map.get(v) ?? 0) + 1);
    const buckets = [...map].map(([id, count]) => ({ id, label: labelOf(dim, id), count }));
    if (ORDERED.includes(dim)) {
      const order = (report?.dimensions[dim] ?? []).map((b) => b.id);
      return buckets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return buckets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function toggle(dim: DimensionKey, id: string) {
    setRowsShown(60);
    setFilters((f) => {
      const current = f[dim] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...f, [dim]: next };
    });
  }

  function setOnly(entries: [DimensionKey, string][]) {
    setRowsShown(60);
    setFilters((f) => {
      const next = { ...f };
      for (const [dim, id] of entries) next[dim] = [id];
      return next;
    });
  }

  if (!eventId) return <section className="page">Choose an event first.</section>;
  if (error) return <section className="page error">{error}</section>;
  if (!report) return <section className="page muted">Tagging {event?.name ?? "sessions"}…</section>;

  const n = filtered.length;
  const pct = (x: number) => (n === 0 ? "0%" : `${Math.round((100 * x) / n)}%`);
  const handsOn = filtered.filter((s) => s.learningStyle === "hands-on").length;
  const interactive = filtered.filter((s) => ["hands-on", "discussion", "live-coding"].includes(s.learningStyle)).length;
  const advanced = filtered.filter((s) => s.level === "300" || s.level === "400+").length;
  const active = (Object.entries(filters) as [DimensionKey, string[]][]).flatMap(([dim, ids]) =>
    ids.map((id) => ({ dim, id })),
  );

  const domainAny = counts("domain");
  const domainPrimary = new Map(counts("primaryDomain").map((b) => [b.id, b.count]));

  const crossDim: DimensionKey = crossBy;
  const rows = counts("primaryDomain");
  const cols = counts(crossDim);
  const cell = (row: string, col: string) =>
    filtered.filter((s) => s.primaryDomain === row && valuesOf(crossDim, s).includes(col)).length;
  const cellValues = rows.map((r) => cols.map((c) => cell(r.id, c.id)));
  const cellMax = Math.max(0, ...cellValues.flat());

  const sortedSessions = [...filtered].sort(
    (a, b) => (a.date ?? "9").localeCompare(b.date ?? "9") || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );

  return (
    <section className="page insights">
      <div>
        <h1>Catalog insights</h1>
        <p className="lead">
          Every session in {event?.name ?? eventId} tagged on nine dimensions. Click any bar or cell to filter; every
          chart and the session list below follow the filters.
        </p>
      </div>

      <div className="filter-bar">
        <input
          className="search"
          placeholder="Search code, title or technology…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {active.map(({ dim, id }) => (
          <button key={`${dim}:${id}`} className="chip on small" onClick={() => toggle(dim, id)}>
            {DIMENSION_TITLES[dim]}: {labelOf(dim, id)} ×
          </button>
        ))}
        {(active.length > 0 || search) && (
          <button
            className="link small"
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-value">{n.toLocaleString()}</span>
          <span className="muted small">sessions {n === report.total ? "in the catalog" : `of ${report.total.toLocaleString()}`}</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{pct(advanced)}</span>
          <span className="muted small">level 300 or above</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{pct(handsOn)}</span>
          <span className="muted small">hands-on (workshops, labs, builders')</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{pct(interactive)}</span>
          <span className="muted small">interactive, rarely recorded</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Topics</h3>
          <div className="legend small">
            <span className="swatch swatch-primary" /> main topic of the session
            <span className="swatch swatch-any" /> also covers it
          </div>
        </div>
        <p className="muted small">
          Each session has one main topic (from its AWS track) and can cover several; AI shows up in most of them.
        </p>
        <div className="bars">
          {domainAny.map((b) => {
            const primary = domainPrimary.get(b.id) ?? 0;
            const max = domainAny[0]?.count ?? 1;
            const selected = (filters.domain ?? []).includes(b.id);
            return (
              <button
                key={b.id}
                className={`bar-row ${selected ? "selected" : ""}`}
                onClick={() => toggle("domain", b.id)}
                title={`${b.label}: main topic of ${primary}, covered by ${b.count} (${pct(b.count)} of sessions in view)`}
              >
                <span className="bar-label">{b.label}</span>
                <span className="bar-track">
                  <span className="bar bar-any" style={{ width: `${(100 * b.count) / max}%` }} />
                  {primary > 0 && <span className="bar bar-primary" style={{ width: `${(100 * primary) / max}%` }} />}
                </span>
                <span className="bar-value">
                  {primary} / {b.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Main topic by</h3>
          <div className="tabs">
            {(
              [
                ["level", "Level"],
                ["learningStyle", "Learning style"],
                ["audience", "Audience"],
                ["day", "Day"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={`tab ${crossBy === id ? "active" : ""}`} onClick={() => setCrossBy(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c.id} className="small">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.id}>
                  <th className="small">{r.label}</th>
                  {cols.map((c, ci) => {
                    const v = cellValues[ri]![ci]!;
                    return (
                      <td key={c.id}>
                        <button
                          className="cell"
                          style={heatColor(v, cellMax, dark)}
                          disabled={v === 0}
                          title={`${r.label} · ${c.label}: ${v} sessions`}
                          onClick={() => setOnly([["primaryDomain", r.id], [crossDim, c.id]])}
                        >
                          {v || ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dimension-grid">
        <BarList title="AI subtopics" dim="aiSubtopic" buckets={counts("aiSubtopic")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="Technologies" dim="technology" buckets={counts("technology")} n={n} filters={filters} onToggle={toggle} limit={15} />
        <BarList title="Audience (catalog roles)" dim="audience" buckets={counts("audience")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="Architecture & engineering concepts" dim="concept" buckets={counts("concept")} n={n} filters={filters} onToggle={toggle} limit={12} />
        <BarList title="Content type" dim="contentType" buckets={counts("contentType")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="Learning style" dim="learningStyle" buckets={counts("learningStyle")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="Level" dim="level" buckets={counts("level")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="Day" dim="day" buckets={counts("day")} n={n} filters={filters} onToggle={toggle} />
        <BarList title="AWS track (code prefix)" dim="track" buckets={counts("track")} n={n} filters={filters} onToggle={toggle} limit={12} />
        <BarList title="Venue" dim="venue" buckets={counts("venue")} n={n} filters={filters} onToggle={toggle} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Sessions ({n.toLocaleString()})</h3>
          <span className="muted small">Sorted by day and time</span>
        </div>
        <div className="table-wrap">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>When</th>
                <th>Format · level</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {sortedSessions.slice(0, rowsShown).map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="muted small">{s.code}</span>
                    <div>{s.title}</div>
                  </td>
                  <td className="small nowrap">
                    {s.date ? formatDay(s.date) : "TBA"}
                    <div className="muted">{s.startTime ?? ""}</div>
                  </td>
                  <td className="small">
                    {s.formatLabel}
                    <div className="muted">{s.levelLabel}</div>
                  </td>
                  <td>
                    <div className="tag-list">
                      {s.domains.map((d) => (
                        <button
                          key={d}
                          className={`tag ${d === s.primaryDomain ? "tag-primary" : ""}`}
                          onClick={() => toggle("domain", d)}
                        >
                          {labelOf("domain", d)}
                        </button>
                      ))}
                      {s.technologies.slice(0, 4).map((t) => (
                        <button key={t} className="tag tag-tech" onClick={() => toggle("technology", t)}>
                          {t}
                        </button>
                      ))}
                      {s.concepts.slice(0, 3).map((c) => (
                        <button key={c} className="tag tag-concept" onClick={() => toggle("concept", c)}>
                          {labelOf("concept", c)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rowsShown < n && (
          <button className="ghost" onClick={() => setRowsShown((r) => r + 200)}>
            Show more ({(n - rowsShown).toLocaleString()} left)
          </button>
        )}
      </div>

      <div className="panel">
        <h3>About the data</h3>
        <ul className="small muted">
          {report.quality.map((q) => (
            <li key={q.label}>
              {q.count.toLocaleString()} sessions: {q.label.toLowerCase()}
            </li>
          ))}
          <li>
            Tags come from the catalog's own labels, the AWS track in the session code and keywords in titles; a session
            without catalog tags is only as well tagged as its title.
          </li>
          <li>Catalog downloaded {new Date(report.fetchedAt).toLocaleString()}.</li>
        </ul>
      </div>
    </section>
  );
}

function BarList({
  title,
  dim,
  buckets,
  n,
  filters,
  onToggle,
  limit = 10,
}: {
  title: string;
  dim: DimensionKey;
  buckets: Bucket[];
  n: number;
  filters: Filters;
  onToggle: (dim: DimensionKey, id: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? buckets : buckets.slice(0, limit);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const selected = filters[dim] ?? [];
  return (
    <div className="panel">
      <h3>{title}</h3>
      {buckets.length === 0 ? (
        <p className="muted small">No sessions in view carry this tag.</p>
      ) : (
        <div className="bars">
          {shown.map((b) => (
            <button
              key={b.id}
              className={`bar-row ${selected.includes(b.id) ? "selected" : ""}`}
              onClick={() => onToggle(dim, b.id)}
              title={`${b.label}: ${b.count} sessions (${n ? Math.round((100 * b.count) / n) : 0}% of sessions in view)`}
            >
              <span className="bar-label">{b.label}</span>
              <span className="bar-track">
                <span className="bar bar-primary" style={{ width: `${(100 * b.count) / max}%` }} />
              </span>
              <span className="bar-value">{b.count}</span>
            </button>
          ))}
        </div>
      )}
      {buckets.length > limit && (
        <button className="link small" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Show fewer" : `Show all ${buckets.length}`}
        </button>
      )}
    </div>
  );
}
