import { createHash } from "node:crypto";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EventsClient } from "../src/api/client.js";
import {
  OAUTH,
  base64url,
  buildAuthorizeUrl,
  buildBrowserSignOutUrl,
  createPkcePair,
  emailFromIdToken,
  signIn,
  type TokenSet,
} from "../src/auth/oauth.js";
import { AuthSession, FileTokenStore, NotSignedInError, type TokenStore } from "../src/auth/session.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

class MemoryStore implements TokenStore {
  constructor(public tokens: TokenSet | null) {}
  async load() {
    return this.tokens;
  }
  async save(tokens: TokenSet) {
    this.tokens = tokens;
  }
  async clear() {
    this.tokens = null;
  }
}

const expired = (): TokenSet => ({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() - 1000 });

describe("PKCE and URLs", () => {
  it("derives the challenge as base64url(sha256(verifier))", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toBe(base64url(createHash("sha256").update(verifier).digest()));
  });

  it("builds the authorize URL with Builder ID and S256", () => {
    const url = new URL(buildAuthorizeUrl("http://127.0.0.1:8484/callback", "chal", "st"));
    expect(url.origin + url.pathname).toBe(OAUTH.authorizeUrl);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: OAUTH.clientId,
      identity_provider: "AWSBuilderID",
      code_challenge_method: "S256",
      scope: "openid email events/access",
      redirect_uri: "http://127.0.0.1:8484/callback",
    });
  });

  it("nests the broker logout inside the Builder ID logout", () => {
    const outer = new URL(buildBrowserSignOutUrl(8485));
    expect(outer.origin + outer.pathname).toBe(OAUTH.builderIdLogoutUrl);
    const inner = new URL(outer.searchParams.get("redirect_uri")!);
    expect(inner.searchParams.get("logout_uri")).toBe("http://127.0.0.1:8485/logout");
  });

  it("reads the email claim from an ID token", () => {
    const payload = Buffer.from(JSON.stringify({ email: "a@b.c" })).toString("base64url");
    expect(emailFromIdToken(`h.${payload}.s`)).toBe("a@b.c");
    expect(emailFromIdToken(undefined)).toBeUndefined();
  });
});

describe("signIn", () => {
  it("completes the loopback flow and exchanges the code with the verifier", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ access_token: "a", refresh_token: "r", id_token: "i", expires_in: 3600 }));

    const tokens = await signIn({
      fetchImpl,
      openBrowser: (authorizeUrl) => {
        const params = new URL(authorizeUrl).searchParams;
        const callback = new URL(params.get("redirect_uri")!);
        callback.searchParams.set("code", "the-code");
        callback.searchParams.set("state", params.get("state")!);
        void fetch(callback);
      },
    });

    expect(tokens).toMatchObject({ accessToken: "a", refreshToken: "r", idToken: "i" });
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it("rejects a callback whose state does not match", async () => {
    await expect(
      signIn({
        fetchImpl: vi.fn<typeof fetch>(),
        openBrowser: (authorizeUrl) => {
          const callback = new URL(new URL(authorizeUrl).searchParams.get("redirect_uri")!);
          callback.searchParams.set("code", "c");
          callback.searchParams.set("state", "forged");
          void fetch(callback);
        },
      }),
    ).rejects.toThrow(/unexpected state/);
  });
});

describe("AuthSession", () => {
  it("returns undefined when nobody is signed in", async () => {
    expect(await new AuthSession(new MemoryStore(null)).getAccessToken()).toBeUndefined();
  });

  it("refreshes an expired token and stores a rotated refresh token", async () => {
    const store = new MemoryStore(expired());
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ access_token: "new", refresh_token: "r2", expires_in: 3600 }));
    expect(await new AuthSession(store, fetchImpl).getAccessToken()).toBe("new");
    expect(store.tokens?.refreshToken).toBe("r2");
  });

  it("keeps the old refresh token when none is returned", async () => {
    const store = new MemoryStore(expired());
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ access_token: "new", expires_in: 3600 }));
    await new AuthSession(store, fetchImpl).getAccessToken();
    expect(store.tokens?.refreshToken).toBe("r1");
  });

  it("asks for a new sign-in when the refresh token is rejected", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, 400));
    await expect(new AuthSession(new MemoryStore(expired()), fetchImpl).getAccessToken()).rejects.toBeInstanceOf(
      NotSignedInError,
    );
  });

  it("shares one refresh between concurrent callers", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ access_token: "new", refresh_token: "r2", expires_in: 3600 }));
    const session = new AuthSession(new MemoryStore(expired()), fetchImpl);
    await Promise.all([session.getAccessToken(), session.getAccessToken(), session.getAccessToken()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("FileTokenStore", () => {
  it("writes credentials readable only by the owner", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rematch-"));
    const store = new FileTokenStore(join(dir, "nested", "credentials.json"));
    await store.save({ accessToken: "a", refreshToken: "r", expiresAt: 1 });
    expect((await stat(join(dir, "nested", "credentials.json"))).mode & 0o777).toBe(0o600);
    expect(await store.load()).toMatchObject({ accessToken: "a" });
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("EventsClient with auth", () => {
  it("refreshes once on 401 and retries with the new token", async () => {
    const getAccessToken = vi.fn(async (opts?: { forceRefresh?: boolean }) => (opts?.forceRefresh ? "fresh" : "stale"));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ reserved: [], favorites: [], personalTime: [] }));

    await new EventsClient({ fetchImpl, getAccessToken }).getSchedule("reinvent2026");

    const auth = (i: number) => (fetchImpl.mock.calls[i]?.[1]?.headers as Record<string, string>).Authorization;
    expect(auth(0)).toBe("Bearer stale");
    expect(auth(1)).toBe("Bearer fresh");
  });

  it("does not loop when the retry is also unauthorized", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ message: "no" }, 401));
    await expect(
      new EventsClient({ fetchImpl, getAccessToken: async () => "t" }).getSchedule("reinvent2026"),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
