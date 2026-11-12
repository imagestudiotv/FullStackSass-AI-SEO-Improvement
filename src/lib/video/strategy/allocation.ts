import {
  DAILY_BATCH_SIZE,
  DURATION_SECONDS,
  EXTRA_BATCH_SIZE,
  NON_VIRAL_SPLIT,
  type BatchKind,
  type ContentGoal,
  type DurationRange,
  type IdeaCategory,
  type VideoFormat,
} from "../formats";

/**
 * How a batch of ideas is split (client, 2026-11-12): the viral share of the
 * settings' mix, the rest by the goal's NON_VIRAL_SPLIT, in whole ideas that
 * always add up to the batch, then spread so the deck alternates. Pure: the
 * idea writer, the settings preview and the tests share it.
 */

/** Ties in rounding go to the earlier category here, so the same settings always give the same split. */
export const CATEGORY_ORDER: readonly IdeaCategory[] = ["viral", "educational", "authority", "promotional"];
const NON_VIRAL: readonly Exclude<IdeaCategory, "viral">[] = ["educational", "authority", "promotional"];

export type CategoryCounts = Record<IdeaCategory, number>;

const zero = (): CategoryCounts => ({ viral: 0, educational: 0, authority: 0, promotional: 0 });

/**
 * `total` split in proportion to `weights`, in whole numbers that add up to
 * exactly `total`: each gets its floor, the rest go one by one to the largest
 * remainders, ties to the earlier key in `order`.
 */
export function largestRemainder<K extends string>(total: number, weights: Record<K, number>, order: readonly K[]): Record<K, number> {
  const out = Object.fromEntries(order.map((key) => [key, 0])) as Record<K, number>;
  const n = Math.max(0, Math.floor(total));
  const sum = order.reduce((acc, key) => acc + Math.max(0, weights[key] ?? 0), 0);
  if (n === 0 || order.length === 0) return out;
  if (sum <= 0) {
    out[order[0]] = n;
    return out;
  }
  const exact = order.map((key) => (Math.max(0, weights[key] ?? 0) * n) / sum);
  let given = 0;
  exact.forEach((value, index) => {
    out[order[index]] = Math.floor(value);
    given += Math.floor(value);
  });
  const byRemainder = order
    .map((key, index) => ({ key, index, rest: exact[index] - Math.floor(exact[index]) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; given < n; i = (i + 1) % byRemainder.length) {
    out[byRemainder[i].key] += 1;
    given += 1;
  }
  return out;
}

/** A viral mix held to 0-100 in steps of 10 (as settings.normalMix, without its server import). */
const mixOf = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value / 10) * 10)) : 40);

/** The categories of a batch of `size`: viral = round(size x mix), the rest by the goal. */
export function categoryCounts(size: number, viralMix: number, goal: ContentGoal): CategoryCounts {
  const viral = Math.min(size, Math.round((size * mixOf(viralMix)) / 100));
  const rest = largestRemainder(size - viral, NON_VIRAL_SPLIT[goal] ?? NON_VIRAL_SPLIT.balanced, NON_VIRAL);
  return { viral, ...rest };
}

/**
 * The categories still owed to the day's batch once some ideas exist: what
 * the full split wants minus what is there, held to `wanted` ideas.
 */
export function topUpCounts(target: CategoryCounts, existing: Partial<CategoryCounts>, wanted: number): CategoryCounts {
  const deficit = zero();
  for (const category of CATEGORY_ORDER) deficit[category] = Math.max(0, target[category] - (existing[category] ?? 0));
  const owed = CATEGORY_ORDER.reduce((acc, category) => acc + deficit[category], 0);
  if (wanted <= 0) return zero();
  if (owed <= wanted) {
    // Ideas skipped or rewritten into another category: the gap goes to the split again.
    const extra = largestRemainder(wanted - owed, target, CATEGORY_ORDER);
    for (const category of CATEGORY_ORDER) deficit[category] += extra[category];
    return deficit;
  }
  return largestRemainder(wanted, deficit, CATEGORY_ORDER);
}

/** Spreads items evenly: each kind's items at (j + 0.5) / count of the way, ties in `order`. */
function spread<K extends string>(counts: Record<K, number>, order: readonly K[]): K[] {
  const placed: { key: K; at: number; index: number }[] = [];
  order.forEach((key, index) => {
    const count = counts[key] ?? 0;
    for (let j = 0; j < count; j++) placed.push({ key, at: (j + 0.5) / count, index });
  });
  return placed.sort((a, b) => a.at - b.at || a.index - b.index).map((item) => item.key);
}

/**
 * The deck order: the non-viral ideas spread among themselves, then the viral
 * ones put into the gaps between them, one per gap while there are gaps - so
 * viral ideas never come in a run unless they are more than half the batch.
 * A viral idea opens the deck when there is one.
 */
export function interleave(counts: Partial<CategoryCounts>): IdeaCategory[] {
  const full = { ...zero(), ...counts };
  const others = spread(full, NON_VIRAL);
  const viral = full.viral;
  if (viral === 0) return others;
  const gaps = others.length + 1;
  const perGap = new Array<number>(gaps).fill(0);
  if (viral <= gaps) {
    for (let j = 0; j < viral; j++) perGap[Math.floor((j * gaps) / viral)] += 1;
  } else {
    for (let j = 0; j < viral; j++) perGap[j % gaps] += 1;
  }
  const out: IdeaCategory[] = [];
  for (let gap = 0; gap < gaps; gap++) {
    for (let k = 0; k < perGap[gap]; k++) out.push("viral");
    if (gap < others.length) out.push(others[gap]);
  }
  return out;
}

export type BatchPlanInput = {
  kind: BatchKind;
  viralMix: number;
  goal: ContentGoal;
  /** Services/products the profile states (only verified ones are used). */
  services: number;
  /** Daily: the categories of the day's ideas written already. */
  existing?: Partial<CategoryCounts>;
  /** Daily: how many are still owed (DAILY_BATCH_SIZE minus those written). */
  wanted?: number;
};

/** The size of a batch of this kind. */
export const batchSize = (kind: BatchKind) => (kind === "daily" ? DAILY_BATCH_SIZE : EXTRA_BATCH_SIZE);

/**
 * The categories of a batch, in deck order.
 *  - daily: the day's 20 by the mix (a top-up keeps the day's split);
 *  - mixed: 10 by the mix;
 *  - viral: 10 viral;
 *  - website: 10 about the business's own services and pages - promotional,
 *    with authority (how it works, what it looks for) when the profile names
 *    few services, so nothing is invented to fill the batch.
 */
export function batchCategories(input: BatchPlanInput): IdeaCategory[] {
  const size = batchSize(input.kind);
  if (input.kind === "daily") {
    const wanted = Math.min(size, Math.max(0, input.wanted ?? size));
    const target = categoryCounts(size, input.viralMix, input.goal);
    return interleave(input.existing ? topUpCounts(target, input.existing, wanted) : categoryCounts(wanted, input.viralMix, input.goal));
  }
  if (input.kind === "mixed") return interleave(categoryCounts(size, input.viralMix, input.goal));
  if (input.kind === "viral") return interleave({ viral: size });
  const promotional = input.services >= 3 ? size : input.services >= 1 ? Math.round(size * 0.6) : Math.round(size * 0.3);
  return interleave({ promotional, authority: size - promotional });
}

/**
 * The format of the idea at `index` of the day (all batches count on): about
 * one in four a carousel and one in ten a Story where allowed, the rest reels.
 * Without reels, the rest are Stories, or carousels.
 */
export function formatAt(index: number, allowed: readonly VideoFormat[]): VideoFormat {
  const can = (format: VideoFormat) => allowed.includes(format);
  const rest: VideoFormat = can("reel") ? "reel" : can("story") ? "story" : "carousel";
  if (can("carousel") && index % 4 === 1) return "carousel";
  if (can("story") && index % 10 === 8) return "story";
  return rest;
}

/** A Story is at most 60 seconds: a longer target becomes 45-60 for it. */
export function durationFor(format: VideoFormat, duration: DurationRange): DurationRange {
  if (format === "story" && DURATION_SECONDS[duration].max > 60) return "45-60";
  return duration;
}
