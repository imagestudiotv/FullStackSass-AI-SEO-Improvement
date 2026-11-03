import type { Locale } from "@/lib/i18n/config";
import type { HomeRedesignCopy } from "@/lib/i18n/home-redesign";
import type { Messages } from "@/lib/i18n/messages";

/**
 * What every section of the redesigned homepage receives.
 *
 * Sections are server components: they read the copy here and pass only
 * plain strings down to the few client components (hero form, feature
 * selector, video, reviews), so messages.ts never reaches the browser bundle.
 */
export type SectionProps = {
  /** The redesign's own words (lib/i18n/home-redesign.ts). */
  c: HomeRedesignCopy;
  /** The site's dictionary: `m.home` and `m.faq` for words the old homepage already had. */
  m: Messages;
  locale: Locale;
  /** Builds locale-aware paths: unchanged on English, prefixed elsewhere. */
  href: (path: string) => string;
};
