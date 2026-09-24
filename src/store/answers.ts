import { basename, join } from "node:path";
import { rematchHome } from "../paths.js";
import { answersSchema, type Answers } from "../plan/answers.js";
import { listJson, readJson, safeFileName, writeJson } from "./jsonFile.js";

export interface StoredAnswers {
  id: string;
  answers: Answers;
}

function answersDir(): string {
  return join(rematchHome(), "answers");
}

export async function listAnswers(): Promise<StoredAnswers[]> {
  const stored = await Promise.all(
    (await listJson(answersDir())).map(async (file) => {
      const parsed = answersSchema.safeParse(await readJson(file));
      return parsed.success ? { id: basename(file, ".json"), answers: parsed.data } : null;
    }),
  );
  return stored.filter((a): a is StoredAnswers => a !== null).sort((a, b) => a.id.localeCompare(b.id));
}

export async function getAnswers(id: string): Promise<Answers | null> {
  const raw = await readJson(join(answersDir(), `${safeFileName(id)}.json`));
  return raw === null ? null : answersSchema.parse(raw);
}

export async function saveAnswers(id: string, input: unknown): Promise<Answers> {
  const answers = answersSchema.parse(input);
  await writeJson(join(answersDir(), `${safeFileName(id)}.json`), answers);
  return answers;
}
