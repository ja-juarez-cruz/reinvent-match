import { homedir } from "node:os";
import { join } from "node:path";

/** Everything Re:Match stores lives here: tokens, catalogs, profiles and swipes. */
export function rematchHome(): string {
  return process.env.REMATCH_HOME ?? join(homedir(), ".rematch");
}
