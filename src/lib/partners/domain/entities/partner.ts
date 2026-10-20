import type { TransitionTable } from "./state-machine";

/**
 * A partner: an approved affiliate profile owned by exactly one RepGet user.
 *
 * Not an organization, not a role in one, and not an administrator. Partner
 * access needs no paid plan, website or customer workspace, and grants
 * nothing outside the partner portal.
 */

export type PartnerStatus = "active" | "suspended";

export const PARTNER_TRANSITIONS: TransitionTable<PartnerStatus> = {
  active: ["suspended"],
  suspended: ["active"],
};

export type PartnerProfile = {
  id: string;
  userId: string | null;
  referralCode: string;
  status: PartnerStatus;
  /** Set by an administrator: no automatic payouts while present. */
  payoutHoldReason: string | null;
};

/** May this partner be paid automatically right now? */
export function canReceiveAutomaticPayout(partner: Pick<PartnerProfile, "status" | "payoutHoldReason">): boolean {
  return partner.status === "active" && partner.payoutHoldReason === null;
}

/*
  Link names (referral codes): what follows ?ref= in a partner's link, as in
  repget.com/?ref=dami. Readable: an administrator picks one at approval
  (suggested from the partner's name) and can change it later. A partner's
  earlier names keep working for that partner (partner_referral_codes) and
  are never given to anyone else.

  3-30 characters: lower-case letters and digits, with single hyphens
  between them. Case is ignored in links. The first codes were 10 random
  characters; those are valid names too.
*/
export const REFERRAL_CODE_MAX = 30;
const REFERRAL_CODE_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/;

/*
  Names no partner may have. RepGet's own words, so a link never looks like
  it comes from RepGet. And sources that other sites write into ?ref= by
  themselves (Product Hunt adds ?ref=producthunt to the links it sends): a
  partner with that name would be credited with visits they did not send.
*/
const RESERVED_REFERRAL_CODES = new Set([
  "admin", "administrator", "api", "app", "billing", "blog", "dashboard", "free", "go", "help", "home", "info",
  "mail", "news", "null", "official", "partner", "partners", "pricing", "root", "security", "settings",
  "staff", "support", "team", "test", "undefined", "www",
  "producthunt", "product-hunt", "hackernews", "hacker-news", "hn", "indiehackers", "reddit", "twitter", "x",
  "facebook", "fb", "instagram", "linkedin", "youtube", "tiktok", "pinterest", "medium", "substack",
  "newsletter", "email", "google", "bing", "yahoo", "duckduckgo", "chatgpt", "openai", "perplexity", "claude",
  "github", "betalist", "saashub", "alternativeto", "g2", "capterra", "trustpilot", "appsumo",
]);

export type ReferralCodeProblem = "format" | "reserved";

/** Checks a link name an administrator typed; returns it in its stored (lower-case) form. */
export function checkReferralCode(raw: string): { ok: true; code: string } | { ok: false; problem: ReferralCodeProblem } {
  const code = raw.trim().toLowerCase();
  if (!REFERRAL_CODE_RE.test(code)) return { ok: false, problem: "format" };
  if (RESERVED_REFERRAL_CODES.has(code) || code.includes("repget")) return { ok: false, problem: "reserved" };
  return { ok: true, code };
}

/**
 * Link names to offer for a partner's name, best first: the first name
 * ("Dami Olu" gives dami), then the whole name (dami-olu), then the first
 * one numbered (dami2 to dami99). Accents are dropped (José gives jose). A
 * name without usable Latin letters or digits gives none; the caller then
 * falls back to a random code.
 */
export function referralCodeSuggestions(name: string): string[] {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const clip = (value: string) => value.slice(0, 24).replace(/-+$/, "");
  const usable = (value: string) => checkReferralCode(value).ok;
  const bases = [...new Set([clip(words[0]), clip(words.join("-"))])].filter(usable);
  if (bases.length === 0) return [];
  const numbered = Array.from({ length: 98 }, (_, index) => `${bases[0]}${index + 2}`);
  return [...new Set([...bases, ...numbered])].filter(usable);
}

/** The path of a partner's link: repget.com/?ref=<code> (next.config.ts sends it through /go/<code>). */
export function referralLinkPath(code: string): string {
  return `/?ref=${encodeURIComponent(code)}`;
}

/** Characters for random codes, the fallback name: no 0/O or 1/I/L, so a code survives being read aloud. */
export const REFERRAL_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REFERRAL_CODE_LENGTH = 10;

/**
 * Builds a random referral code from random integers (one per character,
 * each in [0, alphabet length)). The randomness itself comes from the
 * caller - a cryptographic source in infrastructure - so this stays pure.
 */
export function referralCodeFrom(randomIndexes: number[]): string {
  if (randomIndexes.length !== REFERRAL_CODE_LENGTH) throw new Error("Wrong number of random indexes");
  return randomIndexes
    .map((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= REFERRAL_CODE_ALPHABET.length) {
        throw new Error("Random index out of range");
      }
      return REFERRAL_CODE_ALPHABET[index];
    })
    .join("");
}

/** Normalises a code from a URL; null when it cannot be one of ours. */
export function normaliseReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  return REFERRAL_CODE_RE.test(cleaned) ? cleaned : null;
}
