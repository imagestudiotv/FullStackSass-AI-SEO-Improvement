import { describe, expect, it } from "vitest";

import { areVariants, derivedPair, mergeVariants, normalizeTerm, sameWord, variantOf } from "./variants";

describe("areVariants", () => {
  it.each([
    // The review's case: one letter of inflection.
    ["привітання для мужчині", "привітання для мужчини"],
    ["dentist dublin", "dublin dentist"],
    ["running shoe", "running shoes"],
    ["interior designer", "interior designers"],
    ["marketing agency", "marketing agencies"],
    ["wedding photographer rome", "wedding photograher rome"],
    ["weding venue", "wedding venue"],
    ["для мужчині", "для мужчини"],
    ["привітання зятю", "привітаня зятю"],
    ["Привітання — зятю!", "привітання зятю"],
    ["з днем народження, мамо", "з днем народження мамо"],
  ])("%s = %s", (a, b) => {
    expect(areVariants(a, b)).toBe(true);
  });

  it.each([
    ["hotels rome", "motels rome"],
    ["car rental", "cat rental"],
    ["trends 2025", "trends 2026"],
    ["plans for garden", "plant for garden"],
    ["wedding dress", "wedding dress cost"],
    ["birthday wishes", "anniversary wishes"],
    ["what is seo", "what is sem"],
    // Derivational endings make another word, not another form (outside review of 2026-11-28).
    ["interior design", "interior designer"],
    ["massage chair", "massager chair"],
    ["wedding videographer tuscany", "wedding videography tuscany"],
    ["construct kit", "constructor kit"],
    ["painted wall", "painter wall"],
    ["dentist dublin", "dentistry dublin"],
    ["guitar", "guitarist"],
    ["design", "designing"],
    ["decorate home", "decoration home"],
  ])("%s != %s", (a, b) => {
    expect(areVariants(a, b)).toBe(false);
  });

  it("needs one word in common when there are several", () => {
    expect(sameWord("мужчині", "мужчини")).toBe(true);
    expect(areVariants("мужчині красиві", "мужчини красива")).toBe(false);
  });

  it("tells a derivational suffix from an inflection, in Latin script only", () => {
    expect(derivedPair("design", "designer")).toBe(true);
    expect(derivedPair("massage", "massager")).toBe(true);
    expect(derivedPair("designer", "designers")).toBe(false);
    expect(derivedPair("photographer", "photograher")).toBe(false);
    expect(derivedPair("мужчині", "мужчини")).toBe(false);
    expect(sameWord("design", "designer")).toBe(false);
    expect(sameWord("massages", "massagers")).toBe(false);
    expect(sameWord("agency", "agencies")).toBe(true);
  });

  it("normalises apostrophes, punctuation and case", () => {
    expect(normalizeTerm("  Пам’ять  —  Сім'ї ")).toBe("пам'ять сім'ї");
  });
});

describe("mergeVariants", () => {
  it("keeps the most searched form of each search", () => {
    const { kept, mergedInto } = mergeVariants([
      { term: "привітання для мужчині", volume: 40 },
      { term: "привітання для мужчини", volume: 900 },
      { term: "привітання для мами", volume: 300 },
    ]);
    expect(kept.map((row) => row.term)).toEqual(["привітання для мужчини", "привітання для мами"]);
    expect(mergedInto.get("привітання для мужчині")).toBe("привітання для мужчини");
  });

  it("lets the customer's own wording win, then a targeted row", () => {
    expect(mergeVariants([
      { term: "dublin dentist", volume: 1000 },
      { term: "dentist dublin", volume: null, source: "manual" },
    ]).kept.map((row) => row.term)).toEqual(["dentist dublin"]);
    expect(mergeVariants([
      { term: "dublin dentist", volume: 1000 },
      { term: "dentist dublin", volume: 10, pinned: true },
    ]).kept.map((row) => row.term)).toEqual(["dentist dublin"]);
  });

  it("does not depend on the order of the input", () => {
    const rows = [
      { term: "a dentist dublin", volume: null },
      { term: "dentist dublin a", volume: null },
    ];
    expect(mergeVariants(rows).kept[0].term).toBe(mergeVariants([...rows].reverse()).kept[0].term);
  });

  it("handles a large set quickly", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ term: `keyword number ${i} topic${i % 50}`, volume: i }));
    const started = Date.now();
    expect(mergeVariants(rows).kept).toHaveLength(1500);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("variantOf", () => {
  it("names the existing keyword a new one repeats", () => {
    expect(variantOf("для мужчині", ["для жінки", "для мужчини"])).toBe("для мужчини");
    expect(variantOf("для мужчини", ["для мужчини"])).toBeNull();
    expect(variantOf("для дітей", ["для мужчини"])).toBeNull();
    expect(variantOf("interior designer", ["interior design"])).toBeNull();
    expect(variantOf("massager", ["massage"])).toBeNull();
  });
});
