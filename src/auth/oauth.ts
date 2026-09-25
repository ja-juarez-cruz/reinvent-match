import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";

// Values from https://docs.aws.amazon.com/events/latest/devguide/auth-endpoints.html. The client ID is public
// and shared by every caller; PKCE protects the flow instead of a client secret.
export const OAUTH = {
  authorizeUrl: "https://oauth.awsevents.com/oauth2/authorize",
  tokenUrl: "https://oauth.awsevents.com/oauth2/token",
  revokeUrl: "https://oauth.awsevents.com/oauth2/revoke",
  logoutUrl: "https://oauth.awsevents.com/logout",
  builderIdLogoutUrl: "https://idp.awsevents.com/oidc/logout",
  clientId: "7vmom55m1qstvq8i71ph127bfq",
  scope: "openid email events/access",
  identityProvider: "AWSBuilderID",
  /** The only loopback ports registered for callbacks. */
  ports: [8484, 8485, 8486, 8487, 8488, 8489],
  host: "127.0.0.1",
} as const;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthorizeUrl(redirectUri: string, challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH.clientId,
    redirect_uri: redirectUri,
    scope: OAUTH.scope,
    identity_provider: OAUTH.identityProvider,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${OAUTH.authorizeUrl}?${params}`;
}

/** Sign-out URL that ends both the Builder ID session and the brokering session, then lands on /logout. */
export function buildBrowserSignOutUrl(port: number): string {
  const inner = `${OAUTH.logoutUrl}?${new URLSearchParams({
    client_id: OAUTH.clientId,
    logout_uri: `http://${OAUTH.host}:${port}/logout`,
  })}`;
  return `${OAUTH.builderIdLogoutUrl}?${new URLSearchParams({ redirect_uri: inner })}`;
}

async function postForm(url: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form),
  });
}

function toTokenSet(body: TokenResponse, previousRefreshToken?: string): TokenSet {
  const refreshToken = body.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new OAuthError("Token response did not include a refresh token.");
  return {
    accessToken: body.access_token,
    refreshToken,
    idToken: body.id_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

async function readTokenResponse(res: Response, action: string): Promise<TokenResponse> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OAuthError(`${action} failed with ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  const res = await postForm(
    OAUTH.tokenUrl,
    {
      grant_type: "authorization_code",
      client_id: OAUTH.clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    },
    fetchImpl,
  );
  return toTokenSet(await readTokenResponse(res, "Token exchange"));
}

export async function refreshTokens(tokens: TokenSet, fetchImpl: typeof fetch = fetch): Promise<TokenSet> {
  const res = await postForm(
    OAUTH.tokenUrl,
    { grant_type: "refresh_token", client_id: OAUTH.clientId, refresh_token: tokens.refreshToken },
    fetchImpl,
  );
  // The response may rotate the refresh token; keep the old one only when no new one is returned.
  return toTokenSet(await readTokenResponse(res, "Token refresh"), tokens.refreshToken);
}

export async function revokeRefreshToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await postForm(OAUTH.revokeUrl, { client_id: OAUTH.clientId, token: refreshToken }, fetchImpl);
  if (!res.ok) throw new OAuthError(`Token revocation failed with ${res.status}`, res.status);
}

/** Reads the email claim for display only. The token is not verified here; the API verifies it. */
export function emailFromIdToken(idToken: string | undefined): string | undefined {
  const payload = idToken?.split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return claims.email;
  } catch {
    return undefined;
  }
}

/** Listens on the first free reserved port and resolves with the request to `path`. */
export async function listenOnReservedPort(
  handler: (url: URL, respond: (status: number, html: string) => void) => void,
): Promise<{ server: Server; port: number }> {
  for (const port of OAUTH.ports) {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${OAUTH.host}:${port}`);
      handler(url, (status, html) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
    });
    const listening = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(port, OAUTH.host, () => resolve(true));
    });
    if (listening) return { server, port };
  }
  throw new OAuthError(`Ports ${OAUTH.ports[0]}-${OAUTH.ports.at(-1)} are all in use; free one and retry.`);
}

export interface PendingSignIn {
  state: string;
  verifier: string;
  redirectUri: string;
  /** Where to send the attendee's browser. */
  authorizeUrl: string;
}

/** First half of the flow: a fresh PKCE pair and state for one sign-in attempt. */
export function beginSignIn(redirectUri: string): PendingSignIn {
  const { verifier, challenge } = createPkcePair();
  const state = base64url(randomBytes(24));
  return { state, verifier, redirectUri, authorizeUrl: buildAuthorizeUrl(redirectUri, challenge, state) };
}

/** Second half: validates the callback against the pending attempt and exchanges the code. */
export async function completeSignIn(
  pending: PendingSignIn,
  callback: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  const error = callback.searchParams.get("error");
  if (error) {
    throw new OAuthError(`Sign-in failed: ${error} ${callback.searchParams.get("error_description") ?? ""}`.trim());
  }
  const code = callback.searchParams.get("code");
  if (callback.searchParams.get("state") !== pending.state || !code) {
    throw new OAuthError("Sign-in response had an unexpected state; aborting.");
  }
  return exchangeCode(code, pending.verifier, pending.redirectUri, fetchImpl);
}

export const signInPage = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
  `<h1>${title}</h1><p>${body}</p></body>`;

export interface SignInOptions {
  openBrowser: (url: string) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** OAuth 2.0 authorization code flow with PKCE against a loopback callback. */
export async function signIn({ openBrowser, timeoutMs = 5 * 60_000, fetchImpl = fetch }: SignInOptions): Promise<TokenSet> {
  let pending: PendingSignIn | undefined;
  let settle!: { resolve: (tokens: TokenSet) => void; reject: (error: Error) => void };
  const done = new Promise<TokenSet>((resolve, reject) => (settle = { resolve, reject }));

  const { server, port } = await listenOnReservedPort((url, respond) => {
    if (url.pathname !== "/callback" || !pending) return respond(404, signInPage("Not found", ""));
    completeSignIn(pending, url, fetchImpl).then(
      (tokens) => {
        respond(200, signInPage("Signed in to Reinvent:Match", "You can close this tab and return to the terminal."));
        settle.resolve(tokens);
      },
      (error: Error) => {
        respond(400, signInPage("Sign-in failed", "You can close this tab and try again."));
        settle.reject(error);
      },
    );
  });

  pending = beginSignIn(`http://${OAUTH.host}:${port}/callback`);
  const timer = setTimeout(() => settle.reject(new OAuthError("Timed out waiting for sign-in.")), timeoutMs);
  try {
    openBrowser(pending.authorizeUrl);
    return await done;
  } finally {
    clearTimeout(timer);
    server.close();
  }
}
