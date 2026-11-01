import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface RuleFixture {
  rule: string;
  description: string;
  sources: { file: string; lines: string; origin?: string }[];
  cases: { name: string; input: unknown; expected: unknown; derivation: "executed" | "traced" }[];
  openQuestions: string[];
}

const FIXTURE_DIR = join(import.meta.dirname, "fixtures", "rules");
const RULE_DOC_DIR = join(import.meta.dirname, "..", "docs", "reference", "rules");

const files = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".json"));

describe("rule fixtures", () => {
  it("exist", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s is well-formed and documented", (file) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")) as RuleFixture;

    expect(fixture.rule).toBe(file.replace(/\.json$/, ""));
    expect(fixture.description).toEqual(expect.any(String));
    expect(fixture.sources.length).toBeGreaterThan(0);
    expect(fixture.cases.length).toBeGreaterThan(0);
    expect(Array.isArray(fixture.openQuestions)).toBe(true);

    const names = fixture.cases.map((testCase) => testCase.name);
    expect(new Set(names).size).toBe(names.length);
    for (const testCase of fixture.cases) {
      expect(["executed", "traced"]).toContain(testCase.derivation);
      expect(testCase).toHaveProperty("input");
      expect(testCase).toHaveProperty("expected");
    }

    expect(() => readFileSync(join(RULE_DOC_DIR, `${fixture.rule}.md`), "utf8")).not.toThrow();
  });
});
