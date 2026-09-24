import type { SeatAvailability, Session } from "../api/types.js";
import { normalizeText } from "../match/labels.js";

/** Proficiency scale shared by sessions and profiles: 0 none, 1 basic, 2 practical, 3 advanced. */
export type Level = 0 | 1 | 2 | 3;

export type Format =
  | "workshop"
  | "builders-session"
  | "chalk-talk"
  | "code-talk"
  | "dev-chat"
  | "gamified"
  | "lab"
  | "breakout"
  | "lightning-talk"
  | "panel"
  | "keynote"
  | "exam-prep"
  | "break"
  | "other";

export interface NormalizedSession {
  id: string;
  code: string;
  title: string;
  abstract: string;
  level: Level | null;
  levelLabel: string | null;
  format: Format;
  formatLabel: string | null;
  handsOn: boolean;
  discussion: boolean;
  isCustomerStory: boolean;
  isSponsored: boolean;
  /** 0-3: how much the session is about design decisions rather than implementation. */
  archDepth: Level;
  /** Catalog labels the session is tagged with: topics, areas of interest and services. */
  tags: string[];
  topics: string[];
  services: string[];
  restrictedTo: string[];
  schedule: {
    date: string | null;
    startTime: string | null;
    durationMin: number | null;
    timezone: string | null;
    venue: string | null;
    room: string | null;
    allDay: boolean;
  };
  isReservable: boolean;
  seatAvailability: SeatAvailability | null;
  speakers: string[];
}

export function parseLevel(label: string | undefined): Level | null {
  const match = label?.match(/\b([1-5])00\b/);
  if (!match) return null;
  const hundreds = Number(match[1]);
  return Math.min(hundreds - 1, 3) as Level;
}

// Order matters: the first pattern that matches wins. Catalogs mix English and localized labels.
const FORMAT_PATTERNS: [Format, RegExp][] = [
  ["break", /^breaks?$/],
  ["builders-session", /builder/],
  ["chalk-talk", /chalk|charlas? explicativas?/],
  ["code-talk", /code talk|charlas? de codigo/],
  ["workshop", /workshop|taller/],
  ["lab", /\blabs?\b|laboratorio/],
  ["dev-chat", /dev chat/],
  ["gamified", /gamified|jam|gameday/],
  ["lightning-talk", /lightning|relampago/],
  ["keynote", /keynote|plenary|leadership session/],
  ["panel", /panel/],
  ["exam-prep", /exam prep|certification/],
  ["breakout", /breakout|sesion grupal|startup talk|innovation talk/],
];

export function parseFormat(type: string | undefined): Format {
  if (!type) return "other";
  const text = normalizeText(type);
  return FORMAT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

const ARCH_SIGNALS = [
  /trade-?offs?/,
  /resilien/,
  /fault[- ]toleran/,
  /failure|failover/,
  /at scale|scalab/,
  /multi-?region|cross-region/,
  /distributed/,
  /disaster recovery|high availability/,
  /well-architected/,
  /design (patterns?|decisions?|principles?)|anti-?patterns?|architectural patterns?/,
  /lessons learned/,
  /consistency|idempoten/,
];

export function estimateArchDepth(text: string, topics: string[]): Level {
  const signals = ARCH_SIGNALS.filter((pattern) => pattern.test(text)).length;
  let depth = signals === 0 ? 0 : signals === 1 ? 1 : signals <= 3 ? 2 : 3;
  if (topics.some((t) => /architect|arquitectura/.test(normalizeText(t)))) depth += 1;
  return Math.min(depth, 3) as Level;
}

export function normalizeSession(session: Session): NormalizedSession {
  const title = session.title.trim();
  const abstract = (session.abstract ?? "").trim();
  const text = normalizeText(`${title}\n${abstract}`);
  const topics = session.topics ?? [];
  const features = (session.features ?? []).map(normalizeText);
  const services = session.services ?? [];
  const duration = Number(session.sessionTime?.length);
  const format = parseFormat(session.type);

  return {
    id: session.sessionId,
    code: session.abbreviation ?? session.sessionId,
    title,
    abstract,
    level: parseLevel(session.level),
    levelLabel: session.level ?? null,
    format,
    formatLabel: session.type ?? null,
    handsOn: features.includes("hands-on") || ["workshop", "lab", "builders-session", "gamified"].includes(format),
    discussion: features.includes("discussion") || ["chalk-talk", "builders-session", "dev-chat"].includes(format),
    isCustomerStory:
      features.includes("customer story") || /^how [a-z0-9]|lessons learned|journey to|'s journey/.test(normalizeText(title)),
    isSponsored: /-S$/.test(session.abbreviation ?? "") || /\(sponsored by /i.test(title),
    archDepth: estimateArchDepth(text, topics),
    tags: unique([...topics, ...(session.areasOfInterest ?? []), ...services]),
    topics,
    services,
    restrictedTo: session.experiences ?? [],
    schedule: {
      date: session.sessionTime?.date ?? null,
      startTime: session.sessionTime?.time ?? null,
      durationMin: Number.isFinite(duration) && duration > 0 ? duration : null,
      timezone: session.sessionTime?.timezone ?? null,
      venue: session.venue ?? null,
      room: session.room ?? null,
      allDay: session.isAllDaySession ?? false,
    },
    isReservable: session.isReservable ?? false,
    seatAvailability: session.seatAvailability ?? null,
    speakers: (session.speakers ?? []).map((s) => s.name ?? "").filter(Boolean),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
