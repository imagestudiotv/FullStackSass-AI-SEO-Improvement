/**
 * A YouTube Short's tags (Daniel, 2026-11-24: "one more field for tags, comma
 * separated"). Kept with the idea in video_ideas.overrides.youtubeTags (no
 * migration), as the comma-separated text YouTube Studio takes.
 *
 * YouTube's limit (Data API, videos resource, snippet.tags[], read
 * 2026-11-24): 500 characters in all; the commas between tags count, and a
 * tag with a space counts as if in quotation marks, the marks included
 * ("Foo Baz" is nine characters).
 *
 * Manual publishing only: bundle.social's YouTube data has no tags field
 * (its platform parameters page, read 2026-11-24).
 *
 * No server imports: the publishing window uses it too.
 */

export const YOUTUBE_TAGS_MAX = 500;
export const YOUTUBE_TAGS_KEY = "youtubeTags";

/** Comma (or line) separated text to its tags: trimmed, no # or quotes, no repeats (letters' case aside). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;\n\r]+/)) {
    const tag = part
      .replace(/[<>"]/g, "")
      .replace(/^[\s#]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** How many of YouTube's 500 characters the tags take. */
export function tagsLength(tags: readonly string[]): number {
  return tags.reduce((sum, tag) => sum + [...tag].length + (/\s/.test(tag) ? 2 : 0), 0) + Math.max(0, tags.length - 1);
}

/** The tags cleaned and kept, whole and in order, while they fit YouTube's limit. */
export function cleanTags(text: string): string {
  const kept: string[] = [];
  for (const tag of parseTags(text)) {
    if (tagsLength([...kept, tag]) > YOUTUBE_TAGS_MAX) continue;
    kept.push(tag);
  }
  return kept.join(", ");
}

/** What a Short's suggested tags are made from: all known where the publishing window opens, no AI call. */
export type TagSource = {
  /** The post text: its hashtags first, its other words as keywords. */
  caption: string;
  /** The idea's title (a short one is a tag itself) and its words. */
  title?: string | null;
  /** The video's opening words, and its scenes' titles. */
  hook?: string | null;
  points?: readonly string[] | null;
  /** The website's brand or business name. */
  brand?: string | null;
  /** The customer's own topics (Social Content settings, priority topics), comma or line separated. */
  topics?: string | null;
};

/** A suggested tag's length (Daniel, 2026-11-26): long enough to mean something, short enough to be searched for. */
export const TAG_MIN = 2;
export const TAG_MAX = 30;
/** About as many as a Short's tags are useful (Daniel, 2026-11-26: "insert some more tags"). */
export const SUGGESTED_MAX = 15;
/** The general ones, always offered last. */
export const GENERIC_TAGS = ["shorts", "youtube shorts"] as const;

/**
 * Words that say nothing on their own, in the five languages a post is
 * written in (a post may be in another language than the page): never a
 * keyword, and a tag of only these is left out.
 */
const STOP_WORDS = new Set(
  [
    // English
    "a an and are as at be been but by can could did do does doing done for from get gets got had has have he her here hers him his how i if in into is it its just like make makes me more most my no not now of off on one only or our out over really she so some stop than that the their them then there these they this those to too try up us very want was we were what when where which who why will with without would you your yours",
    "about after again all also any back because before being best better big both each even ever every few first good great know last let lot lots many much must need never new next other own same see should since still such take tell thing things think through time today top under until way ways well while yet",
    // Español
    "al cada como con cual cuando de del desde donde el ella ellos en es esa ese eso esta este esto estos fue ha hay la las le les lo los mas más me mi muy no nos o para pero por porque que qué se ser si sí sin sobre su sus te tu tú un una uno unos y ya",
    // Français
    "au aux avec ce ces cette comme dans de des du elle en est et être il ils je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou où par pas plus pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous",
    // Italiano
    "ai al alla alle che chi ci come con da dal dalla dei del della delle di e è gli ha ho i il in la le lei lo loro ma mi nei nel nella non per perché più se si sono su sua sue suo suoi ti tu tua tuo un una uno voi",
    // Deutsch
    "aber als am an auch auf aus bei bin bis das dass dein deine dem den der des die du durch ein eine einem einen einer es für hat ich ihr im ist ja kann mit nach nicht noch nur oder sein sich sie sind über um und uns unser von vor war was wie wir wird zu zum zur",
  ]
    .join(" ")
    .split(/\s+/),
);

const words = (text: string) => text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
// An acronym as written (AI, SEO) is never one of them, even where a small word is spelt the same (Italian "ai").
const isStop = (word: string) => !/^\p{Lu}{2,}$/u.test(word) && STOP_WORDS.has(word.toLocaleLowerCase());

/** Spaces evened out; a hashtag's "SmallBusiness" and "small_business" read "Small Business" (a name, RepGet, stays whole). */
function tidy(tag: string, hashtag = false): string {
  const text = hashtag ? tag.replace(/_/g, " ").replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2") : tag;
  return text
    .replace(/[<>"#,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A tag worth suggesting: 2 to 30 characters, with a letter, and not only words that say nothing. */
export function sensibleTag(tag: string): boolean {
  const length = [...tag].length;
  if (length < TAG_MIN || length > TAG_MAX || !/\p{L}/u.test(tag)) return false;
  return words(tag).some((word) => !isStop(bare(word) ?? ""));
}

/** A word without its apostrophe part: "SEO's" is SEO, "l'automne" automne, "don't" nothing. */
function bare(word: string): string | null {
  const trimmed = word.replace(/['’-]+$/, "");
  const english = trimmed.match(/^(\p{L}+)['’](s|t|re|ll|ve|m|d)$/iu);
  if (english) return english[2].toLowerCase() === "t" ? null : english[1];
  return trimmed.split(/['’]/).pop() ?? null;
}

/** A word as a keyword: an acronym, a name (RepGet), or a capitalised word inside a sentence (Google) as written; any other word in small letters. */
function keyword(word: string, inSentence = false): string | null {
  const base = bare(word);
  if (!base || isStop(base) || !/\p{L}/u.test(base)) return null;
  const acronym = /^[\p{Lu}\p{N}]+$/u.test(base);
  if ([...base].length < (acronym ? 2 : 3)) return null;
  const name = acronym || /^.+\p{Lu}/u.test(base) || (inSentence && /^\p{Lu}/u.test(base));
  return name ? base : base.toLocaleLowerCase();
}

/**
 * The Short's tags to start from (Daniel, 2026-11-26: "some more tags for
 * YouTube posting auto fill"), without an AI call: the post's hashtags, the
 * brand, the customer's topics, the title when it is short, the words the
 * title, hook, scenes and post use most, then "shorts" - each 2 to 30
 * characters, never twice (letters' case aside), at most 15 and within
 * YouTube's 500 characters. The words are the post's own, so in its
 * language. A text alone is read as the caption.
 */
export function suggestedTags(source: string | TagSource): string {
  const from: TagSource = typeof source === "string" ? { caption: source } : source;
  const caption = from.caption ?? "";
  const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tidy(tag.slice(1), true));
  const topics = (from.topics ?? "")
    .split(/[,;\n\r]+/)
    .map((topic) => tidy(topic))
    .slice(0, 5);
  const title = tidy(from.title ?? "").replace(/[.!?…:]+$/u, "");

  // The words, the title's counting most, then the hook's; among equals the first seen first.
  const score = new Map<string, { tag: string; score: number; at: number }>();
  const count = (text: string | null | undefined, weight: number, prose = false) => {
    const plain = (text ?? "").replace(/#[\p{L}\p{N}_]+/gu, " ");
    for (const match of plain.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
      // In the post's sentences a capital that does not start one is a name; titles and on-screen lines are often capitalised throughout.
      const inSentence = prose && !/(^|[.!?¡¿…:\n]\s*)$/u.test(plain.slice(0, match.index));
      const tag = keyword(match[0], inSentence);
      if (!tag) continue;
      const key = tag.toLocaleLowerCase();
      const seen = score.get(key);
      if (!seen) score.set(key, { tag, score: weight, at: score.size });
      else {
        seen.score += weight;
        if (tag !== key) seen.tag = tag;
      }
    }
  };
  count(from.title, 3);
  count(from.hook, 2);
  for (const point of from.points ?? []) count(point, 1);
  count(caption, 1, true);
  // With a title, a single word only when it is in the title or said more than once: one passing word of the hook ("noon") is not a topic.
  const keywords = [...score.values()]
    .filter((entry) => !from.title || entry.score >= 3)
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .map((entry) => entry.tag);
  // The scenes' titles are the video's subjects: a short one is a tag as it is ("Slow fermentation").
  const scenes = (from.points ?? []).map((point) => tidy(point).replace(/[.!?…:]+$/u, "")).filter((point) => words(point).length <= 4);

  const phrases = [...hashtags, tidy(from.brand ?? ""), ...topics, title, ...scenes].filter(sensibleTag);
  // A word already inside a phrase above adds nothing ("small" beside "Small Business").
  const inPhrase = new Set(phrases.filter((tag) => tag !== title && words(tag).length > 1).flatMap((tag) => words(tag).map((word) => word.toLocaleLowerCase())));
  const own = [...phrases, ...keywords.filter((word) => !inPhrase.has(word.toLocaleLowerCase()))].filter(sensibleTag);
  const generic = GENERIC_TAGS.filter((tag) => !own.some((entry) => entry.toLocaleLowerCase() === tag));
  const kept = parseTags(own.join(",")).slice(0, SUGGESTED_MAX - generic.length);
  return cleanTags([...kept, ...generic].join(","));
}

/** The tags kept with an idea: null when none were saved (then the suggestion is offered). */
export function readTags(overrides: unknown): string | null {
  const value = (overrides as Record<string, unknown> | null)?.[YOUTUBE_TAGS_KEY];
  return typeof value === "string" ? value : null;
}
