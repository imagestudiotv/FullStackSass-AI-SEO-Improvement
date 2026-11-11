import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The bar above the public site's header (client, 2026-11-11): a short
 * holiday offer with a countdown, linking to the pricing page, written by an
 * administrator in Admin -> Site banner and stored in the site_banner row.
 *
 * Shared by the server (saving, reading) and the browser (the bar itself, the
 * admin form's preview), so nothing here touches the database.
 *
 * The rules:
 *  - English is required before the bar can be shown. Another language
 *    without its own message shows the English words, link included, so a
 *    visitor never reads half a sentence in each language.
 *  - Single-line words with limits (BANNER_LIMITS): the bar must stay one or
 *    two short lines on a phone.
 *  - The countdown is optional. When it reaches zero the bar hides itself; a
 *    save that would show an already finished countdown is refused, as is one
 *    more than a year away (the countdown shows days, hours, minutes, seconds).
 *  - The link always goes to the pricing page, in the visitor's language.
 */

/** One language's words. `label` is the bold lead ("BLACK FRIDAY"); `linkText` defaults to BANNER_WORDS' link. */
export type BannerCopy = { label: string; message: string; linkText: string };

export type BannerCopyByLocale = Partial<Record<Locale, BannerCopy>>;

/** A page's words, and the language they are in: English where the page's language has none of its own. */
export type ResolvedBannerCopy = BannerCopy & { lang: Locale };

/** The bar's colours, each with white text at 4.5:1 or better (promo-banner.module.css). */
export const BANNER_TONES = ["orange", "dark", "red", "green", "purple", "blue"] as const;

export type BannerTone = (typeof BANNER_TONES)[number];

export const BANNER_TONE_NAMES: Record<BannerTone, string> = {
  orange: "RepGet orange",
  dark: "Black",
  red: "Red",
  green: "Green",
  purple: "Purple",
  blue: "Blue",
};

export const BANNER_LIMITS = { label: 40, message: 160, linkText: 30 } as const;

/** The furthest a countdown may end from now. */
export const BANNER_MAX_DAYS = 366;

/** What an administrator saved (the site_banner row). */
export type SiteBanner = {
  enabled: boolean;
  copy: BannerCopyByLocale;
  endsAt: Date | null;
  tone: BannerTone;
  updatedBy: string | null;
  updatedAt: Date | null;
};

export const EMPTY_BANNER: SiteBanner = {
  enabled: false,
  copy: {},
  endsAt: null,
  tone: "orange",
  updatedBy: null,
  updatedAt: null,
};

/** What a visitor's page is given: every language already resolved, the end as an ISO string. */
export type LiveBanner = {
  tone: BannerTone;
  endsAt: string | null;
  copy: Record<Locale, ResolvedBannerCopy>;
};

/** The bar's own words in each language: the default link, and the countdown's unit letters. */
export const BANNER_WORDS: Record<Locale, { link: string; units: [string, string, string, string] }> = {
  en: { link: "See pricing", units: ["D", "H", "M", "S"] },
  es: { link: "Ver precios", units: ["D", "H", "M", "S"] },
  fr: { link: "Voir les tarifs", units: ["J", "H", "M", "S"] },
  it: { link: "Vedi i prezzi", units: ["G", "H", "M", "S"] },
  de: { link: "Preise ansehen", units: ["T", "Std", "Min", "Sek"] },
};

export function isBannerTone(value: unknown): value is BannerTone {
  return typeof value === "string" && (BANNER_TONES as readonly string[]).includes(value);
}

/** What the admin form sends. Untrusted: cleanBanner checks every field. */
export type BannerInput = {
  enabled: boolean;
  tone: string;
  /** ISO 8601, or null for no countdown. */
  endsAt: string | null;
  copy: Partial<Record<string, Partial<BannerCopy>>>;
};

const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export type CleanBanner =Pick<SiteBanner, "enabled" | "copy" | "endsAt" | "tone">;

/** One line, single spaces: the bar has no room for line breaks. */
function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Checks and tidies an administrator's save; the error is shown to them as it is. */
export function cleanBanner(
  input: BannerInput,
  now: Date = new Date(),
): { ok: true; value: CleanBanner } | { ok: false; error: string } {
  const enabled = input.enabled === true;
  if (!isBannerTone(input.tone)) return { ok: false, error: "Pick one of the colours." };

  let endsAt: Date | null = null;
  if (input.endsAt) {
    // A full timestamp with its time zone only: Date() also accepts fragments such as "2026-11-".
    endsAt = ISO_MOMENT.test(input.endsAt) ? new Date(input.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime())) return { ok: false, error: "The countdown end is not a valid date." };
    if (endsAt.getTime() - now.getTime() > BANNER_MAX_DAYS * 86_400_000) {
      return { ok: false, error: `The countdown can end at most ${BANNER_MAX_DAYS} days from now.` };
    }
    if (enabled && endsAt <= now) {
      return {
        ok: false,
        error: "The countdown end has already passed. Pick a later time, or clear it to show the banner without a countdown.",
      };
    }
  }

  const copy: BannerCopyByLocale = {};
  for (const locale of LOCALES) {
    const raw = input.copy?.[locale] ?? {};
    const words: BannerCopy = { label: oneLine(raw.label), message: oneLine(raw.message), linkText: oneLine(raw.linkText) };
    for (const field of ["label", "message", "linkText"] as const) {
      if (words[field].length > BANNER_LIMITS[field]) {
        const name = { label: "label", message: "message", linkText: "link text" }[field];
        return { ok: false, error: `${LOCALE_NAMES[locale]}: the ${name} is longer than ${BANNER_LIMITS[field]} characters.` };
      }
    }
    if (!words.message && (words.label || words.linkText)) {
      return {
        ok: false,
        error: `${LOCALE_NAMES[locale]}: add the message, or clear the other fields there to show the English words.`,
      };
    }
    if (words.message) copy[locale] = words;
  }

  if (enabled && !copy[DEFAULT_LOCALE]) return { ok: false, error: "Write the English message before turning the banner on." };

  return { ok: true, value: { enabled, tone: input.tone, endsAt, copy } };
}

/**
 * What the public pages show, or null for no bar: off, no English message,
 * or a countdown already over.
 */
export function liveBanner(banner: SiteBanner, now: Date = new Date()): LiveBanner | null {
  const english = banner.copy[DEFAULT_LOCALE];
  if (!banner.enabled || !english?.message) return null;
  if (banner.endsAt && banner.endsAt <= now) return null;
  return {
    tone: banner.tone,
    endsAt: banner.endsAt?.toISOString() ?? null,
    copy: resolveBannerCopy(banner.copy),
  };
}

/** Every language's words: its own when it has a message, otherwise the English ones - link and countdown units included. */
export function resolveBannerCopy(copy: BannerCopyByLocale): Record<Locale, ResolvedBannerCopy> {
  const english = copy[DEFAULT_LOCALE];
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const own = copy[locale]?.message ? copy[locale] : undefined;
      const words = own ?? english;
      const lang = own ? locale : DEFAULT_LOCALE;
      return [
        locale,
        {
          label: words?.label ?? "",
          message: words?.message ?? "",
          linkText: words?.linkText || BANNER_WORDS[lang].link,
          lang,
        },
      ];
    }),
  ) as Record<Locale, ResolvedBannerCopy>;
}

/** Whole days, hours, minutes and seconds left; zero once over. */
export function countdownParts(msLeft: number): [number, number, number, number] {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return [Math.floor(total / 86_400), Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60];
}
