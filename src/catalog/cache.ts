import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session } from "../api/types.js";
import { rematchHome } from "../paths.js";

export interface CachedCatalog {
  eventId: string;
  fetchedAt: string;
  locale: string | null;
  sessions: Session[];
}

export function cacheDir(root = rematchHome()): string {
  return join(root, "cache");
}

function cachePath(eventId: string, root?: string): string {
  return join(cacheDir(root), `${eventId.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
}

export async function saveCatalog(catalog: CachedCatalog, root?: string): Promise<string> {
  await mkdir(cacheDir(root), { recursive: true });
  const path = cachePath(catalog.eventId, root);
  await writeFile(path, JSON.stringify(catalog, null, 2));
  return path;
}

export async function loadCatalog(eventId: string, root?: string): Promise<CachedCatalog | null> {
  try {
    return JSON.parse(await readFile(cachePath(eventId, root), "utf8")) as CachedCatalog;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
