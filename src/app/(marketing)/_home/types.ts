import type { Locale } from "@/lib/i18n/config";

/**
 * What every section of the homepage receives.
 *
 * Sections are server components: they read their copy from lib/i18n/home/
 * and pass only plain strings down to the few client components (hero form,
 * feature tabs, video, reviews), so the dictionaries never reach the browser
 * bundle.
 */
export type SectionProps = {
  locale: Locale;
  /** Builds locale-aware paths: unchanged on English, prefixed elsewhere. */
  href: (path: string) => string;
};
