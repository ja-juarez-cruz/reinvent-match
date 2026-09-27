import type {
  AwsEvent,
  BulkResult,
  ListEventsResponse,
  ListSessionsResponse,
  PersonalTimeInput,
  Schedule,
  Session,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://api.awsevents.com";

export class EventsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "EventsApiError";
  }
}

export interface EventsClientOptions {
  baseUrl?: string;
  /**
   * Returns a bearer token for the signed-in attendee, or undefined for anonymous calls. Called with
   * `forceRefresh` after a 401, as the API asks: refresh once, retry once.
   */
  getAccessToken?: (opts?: { forceRefresh?: boolean }) => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Injected for tests so retries do not wait in real time. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class EventsClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: EventsClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 4;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async listEvents(): Promise<AwsEvent[]> {
    const res = await this.get<ListEventsResponse>("/v1/events");
    return res.items;
  }

  async getEvent(eventId: string): Promise<AwsEvent> {
    const res = await this.get<{ event: AwsEvent }>(`/v1/events/${encodeURIComponent(eventId)}`);
    return res.event;
  }

  /** One session, fresh: for reservable sessions it carries seatAvailability (available … unavailable). */
  async getSession(eventId: string, sessionId: string): Promise<Session> {
    const res = await this.get<{ session: Session }>(
      `/v1/events/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`,
    );
    return res.session;
  }

  async getSchedule(eventId: string): Promise<Schedule> {
    const res = await this.get<{ schedule: Schedule }>(`/v1/events/${encodeURIComponent(eventId)}/schedule`);
    return res.schedule;
  }

  /** Marks 1-10 distinct sessions as favorites. Check `failed`: results are per session. */
  async associateFavorites(eventId: string, sessionIds: string[]): Promise<BulkResult> {
    const res = await this.request<{ result: BulkResult }>(
      "POST",
      `/v1/events/${encodeURIComponent(eventId)}/favorites`,
      { sessionIds },
    );
    return res.result;
  }

  async disassociateFavorite(eventId: string, sessionId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/v1/events/${encodeURIComponent(eventId)}/favorites/${encodeURIComponent(sessionId)}`,
    );
  }

  /**
   * Reserves seats in 1-10 distinct sessions. Check `failed`: results are per session, and an already reserved
   * session is reported there, so re-sending is not a safe retry.
   */
  async reserveSessions(eventId: string, sessionIds: string[]): Promise<BulkResult> {
    const res = await this.request<{ result: BulkResult }>(
      "POST",
      `/v1/events/${encodeURIComponent(eventId)}/reservations`,
      { sessionIds },
    );
    return res.result;
  }

  /** Cancels one reservation. A session that is not reserved is a 404, so this is not a safe blind retry. */
  async cancelReservation(eventId: string, sessionId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/v1/events/${encodeURIComponent(eventId)}/reservations/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Adds a personal time entry: times in UTC, `YYYY-MM-DDTHH:MM:00`, lasting a multiple of 5 minutes. */
  async createPersonalTime(eventId: string, input: PersonalTimeInput): Promise<void> {
    await this.request<unknown>("POST", `/v1/events/${encodeURIComponent(eventId)}/personal-time`, input);
  }

  /** Replaces a personal time entry: every field is required, and an optional one left out is cleared. */
  async updatePersonalTime(eventId: string, personalTimeId: string, input: PersonalTimeInput): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/v1/events/${encodeURIComponent(eventId)}/personal-time/${encodeURIComponent(personalTimeId)}`,
      input,
    );
  }

  /** Removes a personal time entry. Removing one that is already gone succeeds, so a retry is safe. */
  async deletePersonalTime(eventId: string, personalTimeId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/v1/events/${encodeURIComponent(eventId)}/personal-time/${encodeURIComponent(personalTimeId)}`,
    );
  }

  /** Walks every page of an event's catalog. The API returns at most 250 sessions per page. */
  async listAllSessions(
    eventId: string,
    opts: { locale?: string; onPage?: (fetched: number, total: number) => void } = {},
  ): Promise<Session[]> {
    const sessions: Session[] = [];
    let nextToken: string | undefined;
    do {
      const query = new URLSearchParams();
      if (opts.locale) query.set("locale", opts.locale);
      if (nextToken) query.set("nextToken", nextToken);
      const qs = query.toString();
      const page = await this.get<ListSessionsResponse>(
        `/v1/events/${encodeURIComponent(eventId)}/sessions${qs ? `?${qs}` : ""}`,
      );
      sessions.push(...page.items);
      opts.onPage?.(sessions.length, page.totalCount);
      nextToken = page.nextToken;
    } while (nextToken);
    return sessions;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
    let token = await this.options.getAccessToken?.();
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) {
        const text = await res.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }

      if (res.status === 401 && token && !refreshed) {
        refreshed = true;
        token = await this.options.getAccessToken?.({ forceRefresh: true });
        continue;
      }

      const errorBody: unknown = await res.json().catch(() => undefined);
      // A 429 was not processed, so it is always safe to retry. A 5xx on a write may have been applied.
      const retryable = res.status === 429 || (res.status >= 500 && method === "GET");
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        await this.sleep(delayMs);
        continue;
      }
      const message = (errorBody as { message?: string } | undefined)?.message ?? res.statusText;
      throw new EventsApiError(`${method} ${path} failed with ${res.status}: ${message}`, res.status, errorBody);
    }
  }
}
