import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { answersSchema } from "../src/plan/answers.js";

const dir = join(import.meta.dirname, "personas");

describe("personas", () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    it(`${file} is a complete, valid set of answers`, () => {
      const persona = JSON.parse(readFileSync(join(dir, file), "utf8"));
      expect(persona.name).toBeTruthy();
      expect(persona.expectations.length).toBeGreaterThan(0);
      expect(answersSchema.safeParse(persona.answers).success).toBe(true);
    });
  }
});
