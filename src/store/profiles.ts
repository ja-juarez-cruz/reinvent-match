import { basename, join } from "node:path";
import { rematchHome } from "../paths.js";
import { profileSchema, type Profile } from "../profile/profile.js";
import { listJson, readJson, safeFileName, writeJson } from "./jsonFile.js";

export interface StoredProfile {
  id: string;
  profile: Profile;
}

function profilesDir(): string {
  return join(rematchHome(), "profiles");
}

export async function listProfiles(): Promise<StoredProfile[]> {
  const files = await listJson(profilesDir());
  const stored = await Promise.all(
    files.map(async (file) => {
      const parsed = profileSchema.safeParse(await readJson(file));
      return parsed.success ? { id: basename(file, ".json"), profile: parsed.data } : null;
    }),
  );
  return stored.filter((p): p is StoredProfile => p !== null).sort((a, b) => a.id.localeCompare(b.id));
}

export async function getProfile(id: string): Promise<Profile | null> {
  const raw = await readJson(join(profilesDir(), `${safeFileName(id)}.json`));
  return raw === null ? null : profileSchema.parse(raw);
}

export async function saveProfile(id: string, input: unknown): Promise<Profile> {
  const profile = profileSchema.parse(input);
  await writeJson(join(profilesDir(), `${safeFileName(id)}.json`), profile);
  return profile;
}
