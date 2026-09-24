import type { NormalizedSession } from "../catalog/normalize.js";
import { tagSession, type SessionTags } from "./tagger.js";
import {
  AI_SUBTOPICS,
  AUDIENCES,
  CONCEPTS,
  CONTENT_TYPES,
  DOMAINS,
  LEARNING_STYLES,
  LEVEL_BINS,
} from "./taxonomy.js";

export interface Bucket {
  id: string;
  label: string;
  count: number;
}

export interface CrossTab {
  rows: { id: string; label: string }[];
  cols: { id: string; label: string }[];
  /** cells[row][col] */
  cells: number[][];
}

export interface TaggedSession extends SessionTags {
  id: string;
  code: string;
  title: string;
  date: string | null;
  startTime: string | null;
  durationMin: number | null;
  venue: string | null;
  format: string;
  formatLabel: string | null;
  levelLabel: string | null;
}

export interface DomainDetail {
  id: string;
  label: string;
  primary: number;
  any: number;
  levels: Bucket[];
  styles: Bucket[];
  audiences: Bucket[];
  aiSubtopics: Bucket[];
  technologies: Bucket[];
  concepts: Bucket[];
}

export interface CatalogReport {
  eventId: string;
  fetchedAt: string;
  total: number;
  quality: { label: string; count: number }[];
  dimensions: Record<
    | "primaryDomain"
    | "domain"
    | "aiSubtopic"
    | "technology"
    | "audience"
    | "learningStyle"
    | "contentType"
    | "concept"
    | "level"
    | "track"
    | "day"
    | "venue",
    Bucket[]
  >;
  domains: DomainDetail[];
  crossTabs: { domainByLevel: CrossTab; domainByDay: CrossTab; domainByAudience: CrossTab };
  sessions: TaggedSession[];
}

const UNSPECIFIED_AUDIENCE = { id: "unspecified", label: "Not specified by the catalog" };
const OTHER_DOMAIN = { id: "other", label: "Other" };

const DOMAIN_LABELS = new Map([...DOMAINS.map((d) => [d.id, d.label] as const), [OTHER_DOMAIN.id, OTHER_DOMAIN.label]]);
const labelMaps = {
  aiSubtopic: new Map(AI_SUBTOPICS.map((t) => [t.id, t.label])),
  audience: new Map([...AUDIENCES.map((a) => [a.id, a.label] as const), [UNSPECIFIED_AUDIENCE.id, UNSPECIFIED_AUDIENCE.label]]),
  learningStyle: new Map(LEARNING_STYLES.map((l) => [l.id, l.label])),
  contentType: new Map(CONTENT_TYPES.map((c) => [c.id, c.label])),
  concept: new Map(CONCEPTS.map((c) => [c.id, c.label])),
  level: new Map<string, string>(LEVEL_BINS.map((l) => [l.id, l.label])),
};

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (date: string) => (date === "none" ? "Unscheduled" : DAY.format(new Date(`${date}T00:00:00Z`)));

function count(
  items: TaggedSession[],
  keys: (s: TaggedSession) => string[],
  label: (id: string) => string = (id) => id,
  order?: string[],
): Bucket[] {
  const counts = new Map<string, number>();
  for (const s of items) for (const k of new Set(keys(s))) counts.set(k, (counts.get(k) ?? 0) + 1);
  const buckets = [...counts].map(([id, n]) => ({ id, label: label(id), count: n }));
  return order
    ? order.filter((id) => counts.has(id)).map((id) => buckets.find((b) => b.id === id)!)
    : buckets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function crossTab(
  items: TaggedSession[],
  rows: { id: string; label: string }[],
  cols: { id: string; label: string }[],
  rowOf: (s: TaggedSession) => string,
  colsOf: (s: TaggedSession) => string[],
): CrossTab {
  const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
  const colIndex = new Map(cols.map((c, i) => [c.id, i]));
  const cells = rows.map(() => cols.map(() => 0));
  for (const s of items) {
    const r = rowIndex.get(rowOf(s));
    if (r === undefined) continue;
    for (const c of new Set(colsOf(s))) {
      const ci = colIndex.get(c);
      if (ci !== undefined) cells[r]![ci]! += 1;
    }
  }
  return { rows, cols, cells };
}

const audiencesOf = (s: TaggedSession) => (s.audiences.length > 0 ? s.audiences : [UNSPECIFIED_AUDIENCE.id]);
const levelOrder: string[] = LEVEL_BINS.map((l) => l.id);

export function buildReport(eventId: string, fetchedAt: string, sessions: NormalizedSession[]): CatalogReport {
  const tagged: TaggedSession[] = sessions.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    date: s.schedule.date,
    startTime: s.schedule.startTime,
    durationMin: s.schedule.durationMin,
    venue: s.schedule.venue,
    format: s.format,
    formatLabel: s.formatLabel,
    levelLabel: s.levelLabel,
    ...tagSession(s),
  }));

  const domainLabel = (id: string) => DOMAIN_LABELS.get(id) ?? id;
  const primary = count(tagged, (s) => [s.primaryDomain], domainLabel);
  const domainRows = primary.map(({ id, label }) => ({ id, label }));
  const days = [...new Set(tagged.map((s) => s.date ?? "none"))].sort();

  const domains: DomainDetail[] = count(tagged, (s) => s.domains, domainLabel).map(({ id, label, count: any }) => {
    const members = tagged.filter((s) => s.domains.includes(id));
    return {
      id,
      label,
      primary: primary.find((p) => p.id === id)?.count ?? 0,
      any,
      levels: count(members, (s) => [s.level], (l) => labelMaps.level.get(l) ?? l, levelOrder),
      styles: count(members, (s) => [s.learningStyle], (l) => labelMaps.learningStyle.get(l) ?? l),
      audiences: count(members, audiencesOf, (a) => labelMaps.audience.get(a) ?? a),
      aiSubtopics: count(members, (s) => s.aiSubtopics, (t) => labelMaps.aiSubtopic.get(t) ?? t),
      technologies: count(members, (s) => s.technologies).slice(0, 10),
      concepts: count(members, (s) => s.concepts, (c) => labelMaps.concept.get(c) ?? c).slice(0, 8),
    };
  });

  return {
    eventId,
    fetchedAt,
    total: tagged.length,
    quality: [
      { label: "No AWS services listed", count: sessions.filter((s) => s.services.length === 0).length },
      { label: "No target roles listed", count: sessions.filter((s) => s.roles.length === 0).length },
      { label: "No date or time yet", count: sessions.filter((s) => !s.schedule.date || !s.schedule.startTime).length },
      { label: "No venue", count: sessions.filter((s) => !s.schedule.venue).length },
      { label: "No level", count: sessions.filter((s) => s.level === null).length },
    ],
    dimensions: {
      primaryDomain: primary,
      domain: count(tagged, (s) => s.domains, domainLabel),
      aiSubtopic: count(tagged, (s) => s.aiSubtopics, (t) => labelMaps.aiSubtopic.get(t) ?? t),
      technology: count(tagged, (s) => s.technologies).slice(0, 40),
      audience: count(tagged, audiencesOf, (a) => labelMaps.audience.get(a) ?? a),
      learningStyle: count(tagged, (s) => [s.learningStyle], (l) => labelMaps.learningStyle.get(l) ?? l),
      contentType: count(tagged, (s) => s.contentTypes, (c) => labelMaps.contentType.get(c) ?? c),
      concept: count(tagged, (s) => s.concepts, (c) => labelMaps.concept.get(c) ?? c),
      level: count(tagged, (s) => [s.level], (l) => labelMaps.level.get(l) ?? l, levelOrder),
      track: count(tagged, (s) => [s.track ? `${s.track.code} · ${s.track.label}` : "No track"]),
      day: count(tagged, (s) => [s.date ?? "none"], dayLabel, days),
      venue: count(tagged, (s) => [s.venue ?? "Venue TBA"]),
    },
    domains,
    crossTabs: {
      domainByLevel: crossTab(
        tagged,
        domainRows,
        LEVEL_BINS.filter((l) => tagged.some((s) => s.level === (l.id as string))).map(({ id, label }) => ({ id, label })),
        (s) => s.primaryDomain,
        (s) => [s.level],
      ),
      domainByDay: crossTab(
        tagged,
        domainRows,
        days.map((d) => ({ id: d, label: dayLabel(d) })),
        (s) => s.primaryDomain,
        (s) => [s.date ?? "none"],
      ),
      domainByAudience: crossTab(
        tagged,
        domainRows,
        [...AUDIENCES.map(({ id, label }) => ({ id, label })), UNSPECIFIED_AUDIENCE],
        (s) => s.primaryDomain,
        audiencesOf,
      ),
    },
    sessions: tagged,
  };
}
