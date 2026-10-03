import type { SaveBarState } from "@/components/workspace/save-bar";
import type { ArticleSettingsInput } from "@/lib/websites/article-settings";

/**
 * The Article Settings form, as data: what the fields hold, how they are
 * validated, what the server will store, and how a save is reconciled with
 * edits made while it was in flight.
 *
 * Pure (no React, no database) so every rule here is tested directly - see
 * settings-model.test.ts. The validation MIRRORS the server's clamps and
 * normalisation in lib/websites/article-settings.ts and lib/brand/actions.ts;
 * it does not add rules of its own, it only says before Save what the server
 * would otherwise silently clamp, truncate or drop.
 */

/** What the page reads from the database, as the server stores it. */
export type StoredArticleSettings = {
  articleStyle: string;
  internalLinkTarget: number;
  /** Null means Adaptive: the length is chosen per article. */
  targetWordCount: number | null;
  sitemapUrl: string;
  blogUrl: string;
  exampleArticleUrl: string;
  brandColor: string;
  imageStyle: string;
  featuredImageStyle: string;
  imageBrief: string;
  imageInstructions: string;
  tableOfContents: boolean;
  youtubeVideo: boolean;
  authorPerspective: boolean;
  mentionSimilarProducts: boolean;
  comparisonTable: boolean;
  poweredByLink: boolean;
  authorName: string;
  authorBio: string;
  tone: string;
  vocabulary: string;
  avoid: string;
  /** One per line. */
  usps: string;
  facts: string;
  articleInstructions: string;
};

/**
 * What the form holds. The two numbers are kept as typed (strings) so a
 * half-typed or cleared box is not snapped to a number under the cursor; they
 * are checked and converted on Save. Every value is a primitive, so a shallow
 * comparison is a complete dirty check.
 */
export type ArticleSettingsValues = Omit<StoredArticleSettings, "internalLinkTarget" | "targetWordCount"> & {
  internalLinkTarget: string;
  targetWordCount: string | null;
};

export type FieldKey = keyof ArticleSettingsValues;

/** The server's limits (article-settings.ts, brand/actions.ts). */
export const LIMITS = {
  links: { min: 0, max: 20 },
  words: { min: 300, max: 5000, fallback: 1200 },
  text: { tone: 500, vocabulary: 500, avoid: 500, articleInstructions: 2000 },
  lists: { usps: { lines: 8, chars: 200 }, facts: { lines: 12, chars: 200 } },
} as const;

/** Section anchors, in page order. Shared by the sections and the section navigation. */
export const SECTION_IDS = {
  writing: "writing-seo",
  sources: "content-sources",
  images: "images-branding",
  enhancements: "enhancements",
  voice: "brand-voice",
  author: "author",
  publishing: "writing-publishing",
} as const;

/** The input id of each field, so a failed Save can move focus to the first problem. */
export const FIELD_IDS: Partial<Record<FieldKey, string>> = {
  internalLinkTarget: "internal-links",
  targetWordCount: "word-count",
  sitemapUrl: "sitemap-url",
  blogUrl: "blog-url",
  exampleArticleUrl: "example-url",
  brandColor: "brand-colour",
  tone: "tone",
  articleInstructions: "instructions",
  facts: "facts",
  usps: "usps",
  vocabulary: "vocabulary",
  avoid: "avoid",
};

/** Page order of the fields that can be invalid. */
const VALIDATED: FieldKey[] = [
  "internalLinkTarget",
  "targetWordCount",
  "sitemapUrl",
  "blogUrl",
  "exampleArticleUrl",
  "brandColor",
  "tone",
  "articleInstructions",
  "facts",
  "usps",
  "vocabulary",
  "avoid",
];

export function toFormValues(stored: StoredArticleSettings): ArticleSettingsValues {
  return {
    ...stored,
    internalLinkTarget: String(stored.internalLinkTarget),
    targetWordCount: stored.targetWordCount === null ? null : String(stored.targetWordCount),
  };
}

export type FieldError =
  | { code: "links" }
  | { code: "words" }
  | { code: "url" }
  | { code: "colour" }
  | { code: "tooLong"; max: number }
  | { code: "tooManyLines"; max: number; over: number }
  | { code: "lineTooLong"; line: number; max: number };

export type FieldErrors = Partial<Record<FieldKey, FieldError>>;

const HEX = /^#[0-9a-f]{6}$/i;
const WHOLE = /^\d+$/;

/** The brand colour as the swatch should show it: one value for input, swatch and preview. */
export function colourState(value: string): { kind: "none" } | { kind: "valid"; hex: string } | { kind: "invalid" } {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "none" };
  return HEX.test(trimmed) ? { kind: "valid", hex: trimmed.toLowerCase() } : { kind: "invalid" };
}

function isWebAddress(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function inRange(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (!WHOLE.test(trimmed)) return false;
  const n = Number(trimmed);
  return n >= min && n <= max;
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listError(value: string, limit: { lines: number; chars: number }): FieldError | undefined {
  const items = lines(value);
  if (items.length > limit.lines) return { code: "tooManyLines", max: limit.lines, over: items.length - limit.lines };
  const long = items.findIndex((item) => item.length > limit.chars);
  return long >= 0 ? { code: "lineTooLong", line: long + 1, max: limit.chars } : undefined;
}

/**
 * Everything the server would refuse, clamp, truncate or silently drop.
 *
 *  - links 0-20 and words 300-5000, whole numbers (the server clamps).
 *  - the three addresses: http(s) and parseable (the server refuses).
 *  - brand colour: #rrggbb or empty (the server silently KEEPS the old value
 *    for anything else, which used to be reported as saved).
 *  - tone, vocabulary, avoid 500 and rules 2000 characters, lists 8/12 lines
 *    of 200 (the server truncates).
 */
export function validate(values: ArticleSettingsValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!inRange(values.internalLinkTarget, LIMITS.links.min, LIMITS.links.max)) errors.internalLinkTarget = { code: "links" };
  if (values.targetWordCount !== null && !inRange(values.targetWordCount, LIMITS.words.min, LIMITS.words.max)) {
    errors.targetWordCount = { code: "words" };
  }
  for (const key of ["sitemapUrl", "blogUrl", "exampleArticleUrl"] as const) {
    const trimmed = values[key].trim();
    if (trimmed !== "" && !isWebAddress(trimmed)) errors[key] = { code: "url" };
  }
  if (colourState(values.brandColor).kind === "invalid") errors.brandColor = { code: "colour" };
  for (const key of ["tone", "vocabulary", "avoid", "articleInstructions"] as const) {
    const max = LIMITS.text[key];
    if (values[key].length > max) errors[key] = { code: "tooLong", max };
  }
  const facts = listError(values.facts, LIMITS.lists.facts);
  if (facts) errors.facts = facts;
  const usps = listError(values.usps, LIMITS.lists.usps);
  if (usps) errors.usps = usps;
  return errors;
}

/** The first invalid field in page order, for focus after a refused Save. */
export function firstInvalid(errors: FieldErrors): FieldKey | null {
  return VALIDATED.find((key) => errors[key] !== undefined) ?? null;
}

/**
 * What the server will store for valid values - trimmed text, normalised
 * addresses, lower-case colour, whole numbers, lists without blank lines -
 * so that after a save the form shows what a reload would show.
 */
export function normalise(values: ArticleSettingsValues): ArticleSettingsValues {
  const url = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    try {
      return new URL(trimmed).toString();
    } catch {
      return trimmed;
    }
  };
  const colour = colourState(values.brandColor);
  return {
    ...values,
    internalLinkTarget: String(Number(values.internalLinkTarget.trim())),
    targetWordCount: values.targetWordCount === null ? null : String(Number(values.targetWordCount.trim())),
    sitemapUrl: url(values.sitemapUrl),
    blogUrl: url(values.blogUrl),
    exampleArticleUrl: url(values.exampleArticleUrl),
    brandColor: colour.kind === "valid" ? colour.hex : values.brandColor.trim(),
    imageBrief: values.imageBrief.trim(),
    imageInstructions: values.imageInstructions.trim(),
    authorName: values.authorName.trim(),
    authorBio: values.authorBio.trim(),
    tone: values.tone.trim(),
    vocabulary: values.vocabulary.trim(),
    avoid: values.avoid.trim(),
    articleInstructions: values.articleInstructions.trim(),
    usps: lines(values.usps).join("\n"),
    facts: lines(values.facts).join("\n"),
  };
}

/** The action's input for (normalised, valid) values. Empty strings clear a column. */
export function toInput(values: ArticleSettingsValues): ArticleSettingsInput {
  return {
    ...values,
    internalLinkTarget: Number(values.internalLinkTarget),
    targetWordCount: values.targetWordCount === null ? null : Number(values.targetWordCount),
  };
}

/** How many fields differ - the save bar's "n unsaved changes". */
export function countChanges(a: ArticleSettingsValues, b: ArticleSettingsValues): number {
  return (Object.keys(a) as FieldKey[]).filter((key) => a[key] !== b[key]).length;
}

/**
 * The form after a save of `sent` came back stored as `stored`.
 *
 * A field still holding what was sent takes the stored (normalised) value. A
 * field edited WHILE THE SAVE WAS IN FLIGHT keeps the newer edit - it was not
 * part of this save, so it stays pending rather than being overwritten or
 * marked saved.
 */
export function mergeAfterSave(
  current: ArticleSettingsValues,
  sent: ArticleSettingsValues,
  stored: ArticleSettingsValues,
): ArticleSettingsValues {
  const merged = { ...current };
  for (const key of Object.keys(current) as FieldKey[]) {
    if (current[key] === sent[key]) (merged as Record<FieldKey, unknown>)[key] = stored[key];
  }
  return merged;
}

/** Which fixed bar the page shows at the bottom. */
export function bottomBar(input: {
  canEdit: boolean;
  /** articleSettingsReviewedAt is set, or a save succeeded on this visit. */
  reviewed: boolean;
  changes: number;
}): "none" | "confirm" | "save" {
  if (!input.canEdit) return "none";
  // Keeping every default is a decision too, and needs a button: it records
  // the review that closes the launch checklist step. Never at the same time
  // as the save bar, which needs a change.
  if (!input.reviewed && input.changes === 0) return "confirm";
  return "save";
}

/** The save bar's state. */
export function saveBarState(input: {
  changes: number;
  saving: boolean;
  failure: string | null;
  savedThisVisit: boolean;
}): SaveBarState {
  if (input.saving) return { kind: "saving", count: input.changes };
  if (input.failure) return { kind: "failed", error: input.failure, count: input.changes };
  if (input.changes > 0) return { kind: "dirty", count: input.changes };
  return input.savedThisVisit ? { kind: "saved" } : { kind: "clean" };
}

/** 0 = Sunday, as Date.getUTCDay() and the scheduler count. Shown Monday first. */
export const WEEK = [
  { value: 1, key: "mon" },
  { value: 2, key: "tue" },
  { value: 3, key: "wed" },
  { value: 4, key: "thu" },
  { value: 5, key: "fri" },
  { value: 6, key: "sat" },
  { value: 0, key: "sun" },
] as const;

/**
 * The writing days after one day is turned on or off.
 *
 * An empty list means "every day", and the buttons show it as all on - so
 * the first click expands it to all seven before removing one (otherwise
 * switching Saturday OFF would produce Saturday-only). Turning the last day
 * off clears the restriction instead of stopping generation silently.
 */
export function nextDays(selected: number[], day: number): number[] {
  const current = selected.length === 0 ? WEEK.map((d) => d.value) : selected;
  const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
  return next.length === 0 ? [] : [...next].sort((a, b) => a - b);
}
