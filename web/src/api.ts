import type {
  Answers,
  AwsEvent,
  CatalogReport,
  CatalogStatus,
  Decision,
  FavoritesImportPreview,
  FavoritesSyncResult,
  OnboardingOptions,
  PlanResponse,
  ReservationResult,
  Schedule,
  SessionInfo,
  SwipeLog,
  Vocabulary,
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
  report: (eventId: string) => call<CatalogReport>("GET", `/api/report/${enc(eventId)}`),
  onboarding: () => call<OnboardingOptions>("GET", "/api/onboarding"),
  vocabulary: (eventId: string) => call<Vocabulary>("GET", `/api/vocabulary/${enc(eventId)}`),
  answers: () => call<{ id: string; answers: Answers }[]>("GET", "/api/answers"),
  saveAnswers: (id: string, answers: Answers) =>
    call<{ id: string; answers: Answers }>("PUT", `/api/answers/${enc(id)}`, answers),
  plan: (eventId: string, answersId: string) =>
    call<PlanResponse>("GET", `/api/plan/${enc(eventId)}?answers=${enc(answersId)}`),
  swipe: (eventId: string, sessionId: string, decision: Decision | null) =>
    call<SwipeLog>("PUT", `/api/swipes/${enc(eventId)}/${enc(sessionId)}`, { decision }),
  schedule: (eventId: string) => call<Schedule>("GET", `/api/schedule/${enc(eventId)}`),
  syncFavorites: (eventId: string) => call<FavoritesSyncResult>("POST", `/api/favorites/${enc(eventId)}/sync`),
  favoritesImport: (eventId: string) => call<FavoritesImportPreview>("GET", `/api/favorites/${enc(eventId)}/import`),
  applyFavoritesImport: (eventId: string, like: string[], downgrade: string[]) =>
    call<SwipeLog>("POST", `/api/favorites/${enc(eventId)}/import`, { like, downgrade }),
  reserve: (eventId: string, sessionIds: string[]) =>
    call<ReservationResult>("POST", `/api/reservations/${enc(eventId)}`, { sessionIds }),
  cancelReservation: (eventId: string, sessionId: string) =>
    call<{ schedule: string[] }>("DELETE", `/api/reservations/${enc(eventId)}/${enc(sessionId)}`),
};
