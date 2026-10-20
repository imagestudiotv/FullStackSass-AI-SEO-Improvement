import { expect, it } from "vitest";
import { researchPassages } from "./research-passages";

it("creates bounded exact source passages without asking a model to reproduce quotations", () => {
  const excerpt = `A sentence with a factual qualifier. ${"A long sentence with several words ".repeat(80)}End.`;
  const source = { id: "S1", title: "Guide", url: "https://example.org", retrievedAt: "2026-10-20", excerpt };
  const passages = researchPassages([source, { ...source, id: "S2" }]);
  expect(passages.length).toBeGreaterThan(4);
  expect(new Set(passages.map(passage => passage.id)).size).toBe(passages.length);
  for (const passage of passages) {
    expect(passage.quote.length).toBeGreaterThanOrEqual(20);
    expect(passage.quote.length).toBeLessThanOrEqual(600);
    expect(excerpt).toContain(passage.quote);
  }
});

it("bounds pages containing long unbroken strings and ignores unusably short excerpts", () => {
  const base = { id: "S1", title: "", url: "https://example.org", retrievedAt: "" };
  expect(researchPassages([{ ...base, excerpt: "Short" }])).toEqual([]);
  const passages = researchPassages([{ ...base, excerpt: "x".repeat(1500) }]);
  expect(passages.every(passage => passage.quote.length <= 600)).toBe(true);
  expect(passages.map(passage => passage.quote).join("")).toHaveLength(1500);
});
