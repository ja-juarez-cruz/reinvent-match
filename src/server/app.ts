import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { z, ZodError } from "zod";
import { EventsApiError, type EventsClient } from "../api/client.js";
import {
  beginSignIn,
  completeSignIn,
  emailFromIdToken,
  revokeRefreshToken,
  signInPage,
  type PendingSignIn,
} from "../auth/oauth.js";
import { NotSignedInError, type AuthSession, type TokenStore } from "../auth/session.js";
import { loadCatalog, saveCatalog } from "../catalog/cache.js";
import { normalizeSession, type NormalizedSession } from "../catalog/normalize.js";
import { matchSessions } from "../match/engine.js";
import { AI_FAMILIARITY, AI_PREREQUISITES, FORMAT_CHOICES, FORMAT_GROUPS, MAX_TOPICS, TOPIC_LEVELS } from "../plan/answers.js";
import { inferAnswers } from "../plan/infer.js";
import { buildPlan, buildVocabulary } from "../plan/plan.js";
import { TEMPLATES } from "../profile/templates.js";
import { getAnswers, listAnswers, saveAnswers } from "../store/answers.js";
import { buildReport } from "../taxonomy/report.js";
import { PLATFORMS } from "../taxonomy/taxonomy.js";
import { getProfile, listProfiles, saveProfile } from "../store/profiles.js";
import { DECISIONS, loadSwipes, recordSwipe, type Decision } from "../store/swipes.js";
import { planImport, syncFavorites } from "../sync/favorites.js";
import { cancelAndReload, reserveInOrder } from "../sync/reservations.js";

/** Mutating requests must carry this header. Browsers cannot send it cross-origin without a CORS preflight,
 * which this server never approves, so other websites cannot drive the local API. */
export const CSRF_HEADER = "x-rematch";

export interface AppContext {
  client: EventsClient;
  auth: AuthSession;
  store: TokenStore;
  port: number;
  /** Directory with the built web UI; undefined serves the API only. */
  webRoot?: string;
  fetchImpl?: typeof fetch;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

type Handler = (req: IncomingMessage, url: URL, params: string[]) => Promise<unknown>;

export function createApp(ctx: AppContext) {
  const pendingSignIns = new Map<string, PendingSignIn>();
  const normalized = new Map<string, { fetchedAt: string; sessions: NormalizedSession[] }>();
  const allowedHosts = new Set([`127.0.0.1:${ctx.port}`, `localhost:${ctx.port}`]);

  async function sessionsFor(eventId: string): Promise<{ fetchedAt: string; sessions: NormalizedSession[] }> {
    const catalog = await loadCatalog(eventId);
    if (!catalog) throw new HttpError(404, "catalog-missing", `No catalog downloaded for ${eventId} yet.`);
    const cached = normalized.get(eventId);
    if (cached?.fetchedAt === catalog.fetchedAt) return cached;
    const entry = { fetchedAt: catalog.fetchedAt, sessions: catalog.sessions.map(normalizeSession) };
    normalized.set(eventId, entry);
    return entry;
  }

  async function requireProfile(id: string | null) {
    if (!id) throw new HttpError(400, "profile-required", "Choose a profile first.");
    const profile = await getProfile(id);
    if (!profile) throw new HttpError(404, "profile-missing", `Profile ${id} not found.`);
    return profile;
  }

  const routes: [string, RegExp, Handler][] = [
    [
      "GET",
      /^\/api\/session$/,
      async () => {
        const tokens = await ctx.store.load();
        return { signedIn: tokens !== null, email: emailFromIdToken(tokens?.idToken) ?? null };
      },
    ],
    [
      "POST",
      /^\/api\/auth\/login$/,
      async () => {
        const pending = beginSignIn(`http://127.0.0.1:${ctx.port}/callback`);
        pendingSignIns.set(pending.state, pending);
        setTimeout(() => pendingSignIns.delete(pending.state), 10 * 60_000).unref();
        return { authorizeUrl: pending.authorizeUrl };
      },
    ],
    [
      "POST",
      /^\/api\/auth\/logout$/,
      async () => {
        const tokens = await ctx.store.load();
        if (tokens) await revokeRefreshToken(tokens.refreshToken, ctx.fetchImpl).catch(() => undefined);
        await ctx.store.clear();
        return { signedIn: false };
      },
    ],
    ["GET", /^\/api\/events$/, async () => ctx.client.listEvents()],
    [
      "GET",
      /^\/api\/catalog\/([^/]+)$/,
      async (_req, _url, [eventId]) => {
        const catalog = await loadCatalog(eventId!);
        return catalog
          ? { downloaded: true, fetchedAt: catalog.fetchedAt, count: catalog.sessions.length }
          : { downloaded: false };
      },
    ],
    [
      "POST",
      /^\/api\/catalog\/([^/]+)\/refresh$/,
      async (_req, _url, [eventId]) => {
        const sessions = await ctx.client.listAllSessions(eventId!, { locale: "en-US" });
        const fetchedAt = new Date().toISOString();
        await saveCatalog({ eventId: eventId!, fetchedAt, locale: "en-US", sessions });
        return { downloaded: true, fetchedAt, count: sessions.length };
      },
    ],
    [
      "GET",
      /^\/api\/catalog\/([^/]+)\/vocab$/,
      async (_req, _url, [eventId]) => {
        const { sessions } = await sessionsFor(eventId!);
        const counts = new Map<string, { label: string; kind: string; count: number }>();
        for (const s of sessions) {
          const kinds: [string, string[]][] = [
            ["topic", s.topics],
            ["service", s.services],
            ["area", s.tags.filter((t) => !s.topics.includes(t) && !s.services.includes(t))],
          ];
          for (const [kind, labels] of kinds) {
            for (const label of labels) {
              const entry = counts.get(label) ?? { label, kind, count: 0 };
              entry.count += 1;
              counts.set(label, entry);
            }
          }
        }
        return [...counts.values()].sort((a, b) => b.count - a.count);
      },
    ],
    [
      "GET",
      /^\/api\/report\/([^/]+)$/,
      async (_req, _url, [eventId]) => {
        const { sessions, fetchedAt } = await sessionsFor(eventId!);
        return buildReport(eventId!, fetchedAt, sessions);
      },
    ],
    [
      "GET",
      /^\/api\/onboarding$/,
      async () => ({
        maxTopics: MAX_TOPICS,
        topicLevels: TOPIC_LEVELS,
        formats: FORMAT_CHOICES.map(({ id, label }) => ({ id, label })),
        formatGroups: FORMAT_GROUPS,
        aiPrerequisites: AI_PREREQUISITES.map(({ id, label, hint }) => ({ id, label, hint })),
        aiFamiliarity: AI_FAMILIARITY,
        platforms: PLATFORMS.map(({ id, label }) => ({ id, label })),
      }),
    ],
    [
      "GET",
      /^\/api\/vocabulary\/([^/]+)$/,
      async (_req, _url, [eventId]) => buildVocabulary((await sessionsFor(eventId!)).sessions),
    ],
    ["GET", /^\/api\/answers$/, async () => listAnswers()],
    [
      "PUT",
      /^\/api\/answers\/([^/]+)$/,
      async (req, _url, [id]) => ({ id, answers: await saveAnswers(id!, await readBody(req)) }),
    ],
    [
      "GET",
      /^\/api\/plan\/([^/]+)$/,
      async (_req, url, [eventId]) => {
        const id = url.searchParams.get("answers");
        if (!id) throw new HttpError(400, "answers-required", "Tell Reinvent:Match about yourself first.");
        const answers = await getAnswers(id);
        if (!answers) throw new HttpError(404, "answers-missing", `No answers saved as ${id}.`);
        const [{ sessions, fetchedAt }, swipes] = await Promise.all([sessionsFor(eventId!), loadSwipes(eventId!)]);
        const picked = new Set(Object.keys(swipes).filter((id) => swipes[id]?.decision !== "pass"));
        const liked = new Set(Object.keys(swipes).filter((id) => swipes[id]?.decision === "like"));
        return { fetchedAt, answers, ...buildPlan(sessions, answers, picked, liked), swipes };
      },
    ],
    ["GET", /^\/api\/templates$/, async () => TEMPLATES],
    ["GET", /^\/api\/profiles$/, async () => listProfiles()],
    [
      "GET",
      /^\/api\/profiles\/([^/]+)$/,
      async (_req, _url, [id]) => ({ id, profile: await requireProfile(id!) }),
    ],
    [
      "PUT",
      /^\/api\/profiles\/([^/]+)$/,
      async (req, _url, [id]) => ({ id, profile: await saveProfile(id!, await readBody(req)) }),
    ],
    [
      "GET",
      /^\/api\/match\/([^/]+)$/,
      async (_req, url, [eventId]) => {
        const profile = await requireProfile(url.searchParams.get("profile"));
        const [{ sessions, fetchedAt }, swipes] = await Promise.all([sessionsFor(eventId!), loadSwipes(eventId!)]);
        const results = matchSessions(sessions, profile)
          .filter((r) => !r.unrelated)
          .map((r) => ({
            category: r.category,
            score: r.score,
            reasons: r.reasons,
            session: r.session,
          }));
        return { fetchedAt, results, swipes };
      },
    ],
    [
      "PUT",
      /^\/api\/swipes\/([^/]+)\/([^/]+)$/,
      async (req, _url, [eventId, sessionId]) => {
        const { decision } = (await readBody(req)) as { decision: Decision | null };
        if (decision !== null && !DECISIONS.includes(decision)) {
          throw new HttpError(400, "bad-decision", `decision must be one of ${DECISIONS.join(", ")} or null.`);
        }
        return recordSwipe(eventId!, sessionId!, decision);
      },
    ],
    ["GET", /^\/api\/schedule\/([^/]+)$/, async (_req, _url, [eventId]) => ctx.client.getSchedule(eventId!)],
    [
      "POST",
      /^\/api\/favorites\/([^/]+)\/sync$/,
      async (_req, _url, [eventId]) => syncFavorites(ctx.client, eventId!, await loadSwipes(eventId!)),
    ],
    [
      "GET",
      /^\/api\/onboarding\/([^/]+)\/from-favorites$/,
      async (_req, _url, [eventId]) => {
        const [schedule, { sessions }] = await Promise.all([ctx.client.getSchedule(eventId!), sessionsFor(eventId!)]);
        const ids = new Set(schedule.favorites);
        const favorites = sessions.filter((s) => ids.has(s.id));
        const draft = inferAnswers(favorites);
        return { favorites: favorites.map((s) => s.id), ...(draft ?? { answers: null, basis: [] }) };
      },
    ],
    [
      "GET",
      /^\/api\/favorites\/([^/]+)\/import$/,
      async (_req, _url, [eventId]) => {
        const [schedule, swipes, { sessions }] = await Promise.all([
          ctx.client.getSchedule(eventId!),
          loadSwipes(eventId!),
          sessionsFor(eventId!),
        ]);
        const plan = planImport(swipes, schedule.favorites);
        const byId = new Map(sessions.map((s) => [s.id, s]));
        const brief = (id: string) => {
          const s = byId.get(id);
          return {
            id,
            code: s?.code ?? id,
            title: s?.title ?? "Session not in the downloaded catalog",
            date: s?.schedule.date ?? null,
            startTime: s?.schedule.startTime ?? null,
            decision: swipes[id]?.decision ?? null,
          };
        };
        return { toLike: plan.toLike.map(brief), notInPortal: plan.notInPortal.map(brief) };
      },
    ],
    [
      "POST",
      /^\/api\/favorites\/([^/]+)\/import$/,
      async (req, _url, [eventId]) => {
        const { like, downgrade } = importBody.parse(await readBody(req));
        for (const id of like) await recordSwipe(eventId!, id, "like");
        for (const id of downgrade) await recordSwipe(eventId!, id, "save");
        return loadSwipes(eventId!);
      },
    ],
    [
      "POST",
      /^\/api\/reservations\/([^/]+)$/,
      async (req, _url, [eventId]) => {
        const { sessionIds } = reserveBody.parse(await readBody(req));
        return withReservationErrors(() => reserveInOrder(ctx.client, eventId!, sessionIds));
      },
    ],
    [
      "DELETE",
      /^\/api\/reservations\/([^/]+)\/([^/]+)$/,
      async (_req, _url, [eventId, sessionId]) =>
        withReservationErrors(async () => ({ schedule: await cancelAndReload(ctx.client, eventId!, sessionId!) })),
    ],
  ];

  async function handleCallback(url: URL, res: ServerResponse) {
    const pending = pendingSignIns.get(url.searchParams.get("state") ?? "");
    if (!pending) {
      return sendHtml(res, 400, signInPage("Sign-in expired", "Start the sign-in again from Reinvent:Match."));
    }
    pendingSignIns.delete(pending.state);
    try {
      await ctx.store.save(await completeSignIn(pending, url, ctx.fetchImpl));
      res.writeHead(302, { Location: "/#/signed-in" }).end();
    } catch (error) {
      sendHtml(res, 400, signInPage("Sign-in failed", error instanceof Error ? error.message : "Unknown error."));
    }
  }

  async function serveStatic(pathname: string, res: ServerResponse) {
    if (!ctx.webRoot) return sendJson(res, 404, { error: "not-found" });
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const file = join(ctx.webRoot, safe === "/" ? "index.html" : safe);
    try {
      const body = await readFile(file.startsWith(ctx.webRoot) ? file : join(ctx.webRoot, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      const index = await readFile(join(ctx.webRoot, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"] }).end(index);
    }
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${ctx.port}`);
    try {
      if (!allowedHosts.has(req.headers.host ?? "")) throw new HttpError(403, "bad-host", "Unexpected Host header.");
      if (url.pathname === "/callback") return await handleCallback(url, res);
      if (!url.pathname.startsWith("/api/")) return await serveStatic(url.pathname, res);

      const method = req.method ?? "GET";
      if (method !== "GET" && req.headers[CSRF_HEADER] !== "1") {
        throw new HttpError(403, "csrf", "Missing X-Rematch header.");
      }
      for (const [routeMethod, pattern, handler] of routes) {
        const match = routeMethod === method ? pattern.exec(url.pathname) : null;
        if (match) {
          const params = match.slice(1).map((p) => decodeURIComponent(p));
          return sendJson(res, 200, (await handler(req, url, params)) ?? null);
        }
      }
      throw new HttpError(404, "not-found", `No route for ${method} ${url.pathname}.`);
    } catch (error) {
      const { status, body } = toErrorResponse(error);
      sendJson(res, status, body);
    }
  };
}

/** Portal favorites to make ❤️, and ❤️ picks no longer favorites to move to 🔖. */
const importBody = z.object({
  like: z.array(z.string().min(1).max(128)).max(200),
  downgrade: z.array(z.string().min(1).max(128)).max(200),
});

/** Session IDs to reserve, in booking order. */
const reserveBody = z.object({ sessionIds: z.array(z.string().min(1).max(128)).min(1).max(60) });

/**
 * A refused reservation call (reserved seating not open yet, a closed window) is not an unregistered Builder ID:
 * pass the API's own words on instead of the generic 403 message.
 */
async function withReservationErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof EventsApiError && [400, 403, 409].includes(error.status)) {
      throw new HttpError(
        error.status,
        "reservations-refused",
        `The event refused the reservation request (${error.status}): ${error.message}. Reserving through the API opens October 8; until then, book in the re:Invent portal.`,
      );
    }
    throw error;
  }
}

function toErrorResponse(error: unknown): { status: number; body: { error: string; message: string } } {
  if (error instanceof HttpError) return { status: error.status, body: { error: error.code, message: error.message } };
  if (error instanceof NotSignedInError) return { status: 401, body: { error: "signin", message: error.message } };
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { status: 400, body: { error: "invalid", message } };
  }
  if (error instanceof EventsApiError) {
    if (error.status === 401) return { status: 401, body: { error: "signin", message: "Sign in with your Builder ID." } };
    if (error.status === 403) {
      return { status: 403, body: { error: "not-registered", message: "Your Builder ID is not registered for this event." } };
    }
    return { status: 502, body: { error: "upstream", message: error.message } };
  }
  console.error(error);
  return { status: 500, body: { error: "internal", message: error instanceof Error ? error.message : "Unknown error" } };
}

const MAX_BODY_BYTES = 1_000_000;

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "too-large", "Request body too large.");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "bad-json", "Request body is not valid JSON.");
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" }).end(html);
}
