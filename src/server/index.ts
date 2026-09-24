import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EventsClient } from "../api/client.js";
import { OAUTH } from "../auth/oauth.js";
import type { AuthSession, TokenStore } from "../auth/session.js";
import { createApp } from "./app.js";

/** The built UI sits in dist/web both when running from source (tsx) and from the compiled package. */
export function findWebRoot(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join(here, "..", "web"), join(here, "..", "..", "dist", "web")].find((dir) =>
    existsSync(join(dir, "index.html")),
  );
}

/** Binds to loopback only, on the first free port the sign-in callback accepts. */
export async function startServer(deps: {
  client: EventsClient;
  auth: AuthSession;
  store: TokenStore;
}): Promise<{ server: Server; url: string; webRoot: string | undefined }> {
  const webRoot = findWebRoot();
  for (const port of OAUTH.ports) {
    const server = createServer(createApp({ ...deps, port, webRoot }));
    const listening = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(port, OAUTH.host, () => resolve(true));
    });
    if (listening) return { server, url: `http://${OAUTH.host}:${port}`, webRoot };
  }
  throw new Error(`Ports ${OAUTH.ports[0]}-${OAUTH.ports.at(-1)} are all in use; free one and retry.`);
}
