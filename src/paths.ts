import { homedir } from "node:os";
import { join } from "node:path";

/** Everything Reinvent:Match stores lives here: tokens, catalogs, profiles and swipes. */
export function rematchHome(): string {
  return process.env.REMATCH_HOME ?? join(homedir(), ".rematch");
}
