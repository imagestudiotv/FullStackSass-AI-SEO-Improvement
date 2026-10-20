import { describe, expect, it } from "vitest";

import { LOCALES } from "./config";
import { INDEXING_COPY, indexingLine, type IndexingRow } from "./indexing-status";

/**
 * A published article's page says where its Google indexing stands (client,
 * 2026-10-20: the request had been sent, but nothing showed it), in each of
 * the five languages.
 */

const row = (status: string, overrides: Partial<IndexingRow> = {}): IndexingRow => ({
  status,
  submittedAt: new Date("2026-10-16T12:20:02Z"),
  indexedAt: null,
  createdAt: new Date("2026-10-16T12:20:01Z"),
  ...overrides,
});

describe("an article's Google indexing", () => {
  it("says it is waiting, sent on a day, indexed on a day, or stopped", () => {
    expect(indexingLine(row("queued"), "en")).toEqual({ tone: "waiting", text: "Waiting to be sent to Google. Published articles are sent within two hours." });
    expect(indexingLine(row("submitted"), "en")).toEqual({
      tone: "waiting",
      text: "Sent to Google on 16 October 2026. Google usually takes a few days; RepGet checks every two hours and tells you when it is indexed.",
    });
    expect(indexingLine(row("indexed", { indexedAt: new Date("2026-10-19T08:00:00Z") }), "en")).toEqual({
      tone: "done",
      text: "Indexed by Google on 19 October 2026. It can now appear in Google's results.",
    });
    expect(indexingLine(row("not_indexed"), "en")?.tone).toBe("stopped");
    expect(indexingLine(row("failed"), "en")).toEqual({ tone: "stopped", text: "It could not be sent to Google." });
    expect(indexingLine(row("something new"), "en")).toBeNull();
  });

  it("is said in the reader's language, with the date written their way", () => {
    expect(indexingLine(row("submitted"), "it")?.text).toMatch(/^Inviato a Google il 16 ottobre 2026\./);
    expect(indexingLine(row("submitted"), "de")?.text).toMatch(/^Am 16\. Oktober 2026 an Google gesendet\./);
    expect(indexingLine(row("indexed", { indexedAt: new Date("2026-10-19T08:00:00Z") }), "es")?.text).toMatch(/^Indexado por Google el 19 de octubre de 2026\./);
  });

  it.each(LOCALES)("has every line in %s, with the date where it belongs", (locale) => {
    const copy = INDEXING_COPY[locale];
    expect(Object.values(copy).every((text) => text.trim().length > 0)).toBe(true);
    expect(copy.submitted).toContain("{date}");
    expect(copy.indexed).toContain("{date}");
    for (const status of ["queued", "submitted", "indexed", "not_indexed", "failed"]) {
      expect(indexingLine(row(status, { indexedAt: new Date() }), locale)?.text).not.toContain("{date}");
    }
  });
});
