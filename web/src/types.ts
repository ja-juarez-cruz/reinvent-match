// Shapes returned by the local Re:Match server (src/server/app.ts).

export type Bucket = "know" | "grow" | "explore" | "ignore";
export type Category = "deep-dive" | "growth" | "foundation" | "discovery" | "skip";
export type Decision = "like" | "pass" | "save";
export type Goal = "deepen-known" | "learn-new" | "architecture-role" | "hands-on" | "networking";

export interface Interest {
  name: string;
  bucket: Bucket;
  proficiency?: number;
  keywords?: string[];
}

export interface Profile {
  name?: string;
  goals: Goal[];
  interests: Interest[];
  formatPreferences: Record<string, number>;
  weights: Record<string, number>;
}

export interface StoredProfile {
  id: string;
  profile: Profile;
}

export interface ProfileTemplate {
  id: string;
  title: string;
  description: string;
  profile: Profile;
}

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

export interface VocabEntry {
  label: string;
  kind: "topic" | "service" | "area";
  count: number;
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

export interface MatchResult {
  category: Category;
  score: number;
  reasons: Reason[];
  session: Session;
}

export type SwipeLog = Record<string, { decision: Decision; at: string }>;

export interface MatchResponse {
  fetchedAt: string;
  results: MatchResult[];
  swipes: SwipeLog;
}

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
