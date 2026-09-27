import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EventsClient } from "../api/client.js";
import { OAUTH } from "../auth/oauth.js";
import type { AuthSession, TokenStore } from "../auth/session.js";
import { rematchHome } from "../paths.js";
import { createApp } from "./app.js";

interface SeaModule {
  isSea(): boolean;
  getAsset(key: string, encoding?: string): ArrayBuffer | string;
}

/**
 * In the standalone executable (Node single executable application), the UI travels as embedded assets listed in
 * "web-manifest.json" (see scripts/build-sea.mjs). They are written once per build to ~/.rematch/web-<build> and
 * served from there like the npm package's dist/web.
 */
function seaWebRoot(): string | undefined {
  const getBuiltin = (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  const sea = getBuiltin?.("node:sea") as SeaModule | undefined;
  if (!sea?.isSea()) return undefined;
  const manifest = JSON.parse(sea.getAsset("web-manifest.json", "utf8") as string) as { build: string; files: string[] };
  const root = join(rematchHome(), `web-${manifest.build}`);
  if (!existsSync(join(root, "index.html"))) {
    for (const file of manifest.files) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(sea.getAsset(`web/${file}`) as ArrayBuffer));
    }
  }
  return root;
}

/** The built UI sits in dist/web both when running from source (tsx) and from the compiled package. */
export function findWebRoot(): string | undefined {
  const embedded = seaWebRoot();
  if (embedded) return embedded;
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
