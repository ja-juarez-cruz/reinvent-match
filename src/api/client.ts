import type { AwsEvent, ListEventsResponse, ListSessionsResponse, Schedule, Session } from "./types.js";

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

  async getSchedule(eventId: string): Promise<Schedule> {
    const res = await this.get<{ schedule: Schedule }>(`/v1/events/${encodeURIComponent(eventId)}/schedule`);
    return res.schedule;
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

  private async get<T>(path: string): Promise<T> {
    let token = await this.options.getAccessToken?.();
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, { headers });
      if (res.ok) return (await res.json()) as T;

      if (res.status === 401 && token && !refreshed) {
        refreshed = true;
        token = await this.options.getAccessToken?.({ forceRefresh: true });
        continue;
      }

      const body = await res.json().catch(() => undefined);
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        await this.sleep(delayMs);
        continue;
      }
      const message = (body as { message?: string } | undefined)?.message ?? res.statusText;
      throw new EventsApiError(`GET ${path} failed with ${res.status}: ${message}`, res.status, body);
    }
  }
}
