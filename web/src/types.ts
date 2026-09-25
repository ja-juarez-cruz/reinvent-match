// Shapes returned by the local Re:Match server (src/server/app.ts).

export type Decision = "like" | "pass" | "save";

export interface AwsEvent {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  authenticationRequired: boolean;
  address?: { city?: string };
}

export interface CatalogStatus {
  downloaded: boolean;
  fetchedAt?: string;
  count?: number;
}

export interface Reason {
  kind: "pro" | "con" | "info";
  text: string;
}

export interface Session {
  id: string;
  code: string;
  title: string;
  abstract: string;
  levelLabel: string | null;
  format: string;
  formatLabel: string | null;
  isSponsored: boolean;
  mayRepeat: boolean;
  speakers: string[];
  schedule: {
    date: string | null;
    startTime: string | null;
    durationMin: number | null;
    venue: string | null;
    room: string | null;
  };
}

export type SwipeLog = Record<string, { decision: Decision; at: string }>;

export interface SessionInfo {
  signedIn: boolean;
  email: string | null;
}

export interface Schedule {
  reserved: string[];
  favorites: string[];
}

export interface FavoritesSyncResult {
  toAdd: string[];
  toRemove: string[];
  added: string[];
  removed: string[];
  failed: { sessionId: string; code: string; action: "add" | "remove" }[];
  favorites: string[];
}

export interface CountBucket {
  id: string;
  label: string;
  count: number;
}

export interface TaggedSession {
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
  track: { code: string; label: string } | null;
  primaryDomain: string;
  domains: string[];
  aiSubtopics: string[];
  technologies: string[];
  audiences: string[];
  learningStyle: string;
  contentTypes: string[];
  concepts: string[];
  level: string;
}

export type DimensionKey =
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
  | "venue";

export interface CatalogReport {
  eventId: string;
  fetchedAt: string;
  total: number;
  quality: { label: string; count: number }[];
  dimensions: Record<DimensionKey, CountBucket[]>;
  sessions: TaggedSession[];
}

export type SelfLevel = "basic" | "intermediate" | "advanced";
export type Intent = "reinforce" | "broaden" | "learn";

export interface Answers {
  name?: string;
  known: string[];
  learn: string[];
  level: SelfLevel;
  /** Vendor platforms that are not relevant: sessions built around them are hidden. */
  ignore: string[];
  /** AI prerequisite id → 0 not yet, 1 some, 2 comfortable. */
  ai: Record<string, number>;
  formats: string[];
}

export interface OnboardingOptions {
  maxKnown: number;
  maxLearn: number;
  levels: SelfLevel[];
  formats: { id: string; label: string }[];
  aiPrerequisites: { id: string; label: string; hint: string }[];
  aiFamiliarity: string[];
  platforms: { id: string; label: string }[];
}

export interface VocabularyEntry {
  key: string;
  label: string;
  count: number;
  domain?: string;
  /** For topics: technology and concept keys that come with it. */
  related?: string[];
}

export interface Vocabulary {
  domains: VocabularyEntry[];
  technologies: VocabularyEntry[];
  concepts: VocabularyEntry[];
}

export interface PlanItem {
  intent: Intent;
  goalHits: number;
  /** Needs a reserved seat; listed first within its intent. */
  reservable: boolean;
  score: number;
  reasons: Reason[];
  session: Session & { format: string };
  keys: string[];
  learningStyle: string;
}

export interface PlanContext {
  known: string[];
  learn: string[];
  knownDomains: string[];
  neighborDomains: string[];
  techDomain: Record<string, string>;
  labels: Record<string, string>;
}

export interface PlanResponse {
  fetchedAt: string;
  answers: Answers;
  results: PlanItem[];
  hidden: { format: number; tooBasic: number; aiNotReady: number; ignored: number; other: number };
  context: PlanContext;
  swipes: SwipeLog;
}
