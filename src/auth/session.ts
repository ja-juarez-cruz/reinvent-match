import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { rematchHome } from "../paths.js";
import { OAuthError, refreshTokens, type TokenSet } from "./oauth.js";

/** Refresh this long before expiry so a request never starts with a token about to lapse. */
const EXPIRY_MARGIN_MS = 60_000;

export class NotSignedInError extends Error {
  constructor(message = "Not signed in. Run `reinvent-match login` first.") {
    super(message);
    this.name = "NotSignedInError";
  }
}

export function credentialsPath(): string {
  return join(rematchHome(), "credentials.json");
}

/** Tokens live in a file only the current user can read (0600 in a 0700 directory). */
export class FileTokenStore {
  constructor(private readonly path = credentialsPath()) {}

  async load(): Promise<TokenSet | null> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as TokenSet;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async save(tokens: TokenSet): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await writeFile(this.path, JSON.stringify(tokens), { mode: 0o600 });
    await chmod(this.path, 0o600);
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true });
  }
}

export interface TokenStore {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

/** Hands out valid access tokens, refreshing them as needed. */
export class AuthSession {
  private refreshing: Promise<TokenSet> | null = null;

  constructor(
    private readonly store: TokenStore = new FileTokenStore(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async isSignedIn(): Promise<boolean> {
    return (await this.store.load()) !== null;
  }

  /** Returns undefined when nobody is signed in, so public catalogs still work anonymously. */
  async getAccessToken({ forceRefresh = false } = {}): Promise<string | undefined> {
    const tokens = await this.store.load();
    if (!tokens) return undefined;
    if (!forceRefresh && tokens.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return tokens.accessToken;
    return (await this.refresh(tokens)).accessToken;
  }

  private refresh(tokens: TokenSet): Promise<TokenSet> {
    this.refreshing ??= refreshTokens(tokens, this.fetchImpl)
      .then(async (next) => {
        await this.store.save(next);
        return next;
      })
      .catch((error: unknown) => {
        if (error instanceof OAuthError && error.status !== undefined && error.status < 500) {
          throw new NotSignedInError("Your session expired. Run `reinvent-match login` again.");
        }
        throw error;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }
}
