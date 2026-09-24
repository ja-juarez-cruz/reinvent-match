import type {
  AwsEvent,
  CatalogReport,
  CatalogStatus,
  Decision,
  FavoritesSyncResult,
  MatchResponse,
  Profile,
  ProfileTemplate,
  Schedule,
  SessionInfo,
  StoredProfile,
  SwipeLog,
  VocabEntry,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-Rematch"] = "1";
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? "unknown", err.message ?? res.statusText);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  session: () => call<SessionInfo>("GET", "/api/session"),
  login: () => call<{ authorizeUrl: string }>("POST", "/api/auth/login"),
  logout: () => call<SessionInfo>("POST", "/api/auth/logout"),
  events: () => call<AwsEvent[]>("GET", "/api/events"),
  catalog: (eventId: string) => call<CatalogStatus>("GET", `/api/catalog/${enc(eventId)}`),
  refreshCatalog: (eventId: string) => call<CatalogStatus>("POST", `/api/catalog/${enc(eventId)}/refresh`),
  vocab: (eventId: string) => call<VocabEntry[]>("GET", `/api/catalog/${enc(eventId)}/vocab`),
  report: (eventId: string) => call<CatalogReport>("GET", `/api/report/${enc(eventId)}`),
  templates: () => call<ProfileTemplate[]>("GET", "/api/templates"),
  profiles: () => call<StoredProfile[]>("GET", "/api/profiles"),
  saveProfile: (id: string, profile: Profile) => call<StoredProfile>("PUT", `/api/profiles/${enc(id)}`, profile),
  match: (eventId: string, profileId: string) =>
    call<MatchResponse>("GET", `/api/match/${enc(eventId)}?profile=${enc(profileId)}`),
  swipe: (eventId: string, sessionId: string, decision: Decision | null) =>
    call<SwipeLog>("PUT", `/api/swipes/${enc(eventId)}/${enc(sessionId)}`, { decision }),
  schedule: (eventId: string) => call<Schedule>("GET", `/api/schedule/${enc(eventId)}`),
  syncFavorites: (eventId: string) => call<FavoritesSyncResult>("POST", `/api/favorites/${enc(eventId)}/sync`),
};
