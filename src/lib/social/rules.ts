import { PLATFORMS, type SocialPlatform } from "./platforms";

/**
 * What keeps the customer's accounts from being banned (client, 2026-10-27:
 * "study the best ways for make it working without bann the accounts").
 *
 * Every draft the model writes is checked here, in code, before it is shown
 * or published - a prompt is a request, not a guarantee:
 *  - THE WARM-UP: a new account's first WARMUP_DAYS days have no links and
 *    no product or brand names - a new account that promotes is the classic
 *    spam pattern;
 *  - AFTER IT: at most one link, only to the customer's own website, and
 *    only in some own posts (LINK_EVERY), never in every one;
 *  - the platform's length limit;
 *  - never the same text twice (isRepeat);
 *  - A REPLY THAT MENTIONS THE BUSINESS SAYS IT IS THE WRITER'S OWN
 *    (replyText). Quora asks writers to disclose an affiliation and Bluesky
 *    bans undisclosed commercial content (checked 2026-10-28).
 * The rest of the safeguards are in how posting happens: one own post a day
 * per account (OWN_POSTS_PER_ACCOUNT), at an uneven time (postingTime),
 * each article image pinned once (lib/social/suggest.ts), replies always
 * posted by the customer, and automatic posting paused after a refusal
 * (lib/social/publish.ts).
 */

/** Own posts RepGet suggests per account per day. */
export const OWN_POSTS_PER_ACCOUNT = 1;

/** After the warm-up, a link goes in one own post out of this many. */
export const LINK_EVERY = 3;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+|\bwww\.[^\s<>()]+/gi;
/** A bare domain such as "example.com" or "shop.example.co.uk". */
const DOMAIN_PATTERN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|ai|app|dev|shop|store|info|biz|eu|uk|de|fr|it|es|ie|nl|us|ca|au)\b/gi;

/** Every link or bare domain in a text. */
export function linksIn(text: string): string[] {
  return [...(text.match(URL_PATTERN) ?? []), ...(text.replace(URL_PATTERN, " ").match(DOMAIN_PATTERN) ?? [])];
}

function hostOf(link: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Whether a link points at the website itself (or one of its subdomains). */
export function isOwnLink(link: string, domain: string): boolean {
  const host = hostOf(link);
  const own = domain.toLowerCase().replace(/^www\./, "");
  return host !== null && (host === own || host.endsWith(`.${own}`));
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a text names the business: its brand name, or its domain's name
 * ("imagestudio" for imagestudio.io), as a whole word. Names shorter than 3
 * letters are not checked - they match ordinary words.
 */
export function namesBrand(text: string, brand: { brandName?: string | null; domain: string }): boolean {
  const names = [
    brand.brandName?.trim(),
    brand.domain.toLowerCase().replace(/^www\./, "").split(".")[0],
  ].filter((name): name is string => Boolean(name && name.length >= 3));
  return names.some((name) => {
    // Spaces in the name may be written as nothing, a hyphen or a space ("Image Studio", "ImageStudio").
    const flexible = escape(name).replace(/\\?\s+/g, "[\\s-]?");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${flexible}($|[^\\p{L}\\p{N}])`, "iu").test(text);
  });
}

export type DraftCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a draft may be suggested. `warmup` is the account's; `link` is the
 * one link a post may carry outside its text (a Pin's, a Bluesky card's).
 */
export function checkDraft(
  draft: { platform: SocialPlatform; title?: string | null; body: string; link?: string | null },
  context: { warmup: boolean; brandName?: string | null; domain: string },
): DraftCheck {
  const spec = PLATFORMS[draft.platform];
  const text = `${draft.title ?? ""}\n${draft.body}`;
  if (!draft.body.trim()) return { ok: false, reason: "empty" };
  if (draft.body.length > spec.maxLength) return { ok: false, reason: "too long" };
  if (draft.title && spec.titleMax && draft.title.length > spec.titleMax) return { ok: false, reason: "title too long" };

  // The website's own domain counts as a link however it is written - "shop.example" has no
  // TLD the pattern knows, but on the platform it is still the business's address.
  const own = context.domain.toLowerCase().replace(/^www\./, "");
  const found = linksIn(text);
  const bareOwn = own.length > 0 && text.toLowerCase().includes(own) && !found.some((link) => link.toLowerCase().includes(own));
  const links = [...found, ...(bareOwn ? [own] : []), ...(draft.link ? [draft.link] : [])];
  if (context.warmup) {
    if (links.length > 0) return { ok: false, reason: "link during the warm-up" };
    if (namesBrand(text, context)) return { ok: false, reason: "brand name during the warm-up" };
    return { ok: true };
  }
  if (links.length > 1) return { ok: false, reason: "more than one link" };
  if (links.some((link) => !isOwnLink(link, context.domain))) return { ok: false, reason: "link to another website" };
  return { ok: true };
}

/** The longest disclosure sentence a reply may end with. */
export const DISCLOSURE_MAX = 160;

/**
 * A reply's final text, or null when it must be dropped.
 *
 * The business's name may appear ONLY in `disclosure`: one short sentence the
 * model writes in the reply's own language ("Disclosure: I run Image
 * Studio."), which RepGet adds at the end. That makes the rule checkable in
 * code whatever the language: a body that names the business is dropped, and
 * a disclosure must name it, carry no link and stay short. Whether the body
 * still fits the platform is checkDraft's job, on the joined text.
 */
export function replyText(
  body: string,
  disclosure: string | null | undefined,
  brand: { brandName?: string | null; domain: string },
): string | null {
  if (namesBrand(body, brand)) return null;
  const note = disclosure?.trim();
  if (!note) return body;
  if (note.length > DISCLOSURE_MAX || !namesBrand(note, brand) || linksIn(note).length > 0) return null;
  return `${body}\n\n${note}`;
}

/** Text compared without case, spacing or punctuation. */
function normalised(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Whether a text repeats one already posted or suggested (exactly, or with only spacing and punctuation changed). */
export function isRepeat(text: string, earlier: string[]): boolean {
  const own = normalised(text);
  return earlier.some((other) => normalised(other) === own);
}

/** Whether this own post may carry a link: after the warm-up, in one post out of LINK_EVERY. */
export function mayLink(warmup: boolean, ownPostsSinceLastLink: number): boolean {
  return !warmup && ownPostsSinceLastLink >= LINK_EVERY - 1;
}

/**
 * When an own post is published: between 3 and 9 hours after it was written
 * (the daily run is at 07:00 UTC, so 10:00 to 16:00 UTC), at an uneven
 * minute - automation that posts at exactly the same time every day is easy
 * for a platform to spot. `random` is a number in [0, 1).
 */
export function postingTime(writtenAt: Date, random: number): Date {
  const minutes = 180 + Math.floor(random * 360);
  return new Date(writtenAt.getTime() + minutes * 60_000);
}
