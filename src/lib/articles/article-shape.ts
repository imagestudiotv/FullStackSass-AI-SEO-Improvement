import { createHash } from "node:crypto";

/**
 * The parts of an article's shape decided in code rather than by the writer
 * (client, 2026-10-13: "random comparison table, some time one some time 2,
 * 3 maximum", "3 more images for the article").
 */

/**
 * How many comparison tables this article gets, 1 to 3, when the website has
 * comparison tables on.
 *
 * Chosen here, not left to the model: asked for "one to three", a model writes
 * the same number every time. Seeded by the article, so a retried step gets
 * the same answer and the outline and body agree. Mostly one or two, three
 * now and then - three tables in every article would read like a spec sheet -
 * and fewer for a short article, where three would crowd out the writing.
 */
export function tableCount(seed: string, targetWordCount: number | null): 1 | 2 | 3 {
  const roll = createHash("sha256").update(`tables:${seed}`).digest().readUInt16BE(0) / 0x10000;
  const wanted: 1 | 2 | 3 = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3;
  if (targetWordCount !== null && targetWordCount < 1000) return 1;
  if (targetWordCount !== null && targetWordCount < 1600) return Math.min(wanted, 2) as 1 | 2;
  return wanted;
}

/** Pictures inside the article, from the website setting: 0-3, whatever is stored. */
export function bodyImageCount(setting: number | null | undefined): number {
  if (typeof setting !== "number" || !Number.isFinite(setting)) return 3;
  return Math.max(0, Math.min(3, Math.trunc(setting)));
}
