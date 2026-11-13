import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's title and description in every language - what Google shows
 * for the site's most important page, and (through Next's fallback) its
 * og:title, og:description, twitter:title and twitter:description too.
 *
 * Client, 2026-11-13: "a stronger title and description ... once we have now
 * also social content growth and copilot". So both now name what RepGet does
 * today - SEO articles, social posts and videos, automatic publishing,
 * backlinks and Growth Copilot - in the words the site already uses for them
 * (lib/i18n/home/features.ts, hero.ts), with "AI SEO" kept first: it is what
 * the homepage has targeted since launch.
 *
 * Titles are complete, " | RepGet" included, and used as `absolute` titles:
 * at most 60 characters (lib/audit/rules.ts LIMITS.titleMax). Descriptions
 * stay within 140-158 characters: Ahrefs reports "Meta description too long"
 * above that, and the free audit flags over 158.
 *
 * Never "analysis" in the English pair: a Google removal of the old
 * vercel.app result relies on the word being gone (meta-lengths.test.ts).
 */
export const HOME_META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "AI SEO Platform: Articles, Social Posts & Videos | RepGet",
    description:
      "RepGet writes SEO articles, creates social posts and videos, publishes them automatically and earns backlinks. Growth Copilot plans your next steps.",
  },
  es: {
    title: "Plataforma SEO con IA: artículos, posts y vídeos | RepGet",
    description:
      "RepGet escribe artículos SEO, crea posts y vídeos para redes, los publica automáticamente y consigue backlinks. Growth Copilot marca los próximos pasos.",
  },
  fr: {
    title: "Plateforme SEO IA : articles, posts et vidéos | RepGet",
    description:
      "RepGet rédige vos articles SEO, crée vos posts et vidéos sociales, les publie automatiquement et obtient des backlinks. Growth Copilot planifie la suite.",
  },
  it: {
    title: "Piattaforma SEO con IA: articoli, post e video | RepGet",
    description:
      "RepGet scrive articoli SEO, crea post e video per i social, li pubblica in automatico e ottiene backlink. Growth Copilot pianifica i Suoi prossimi passi.",
  },
  de: {
    title: "KI-SEO-Plattform: Artikel, Social Posts und Videos | RepGet",
    description:
      "RepGet schreibt SEO-Artikel, erstellt Social Posts und Videos, veröffentlicht sie automatisch und gewinnt Backlinks. Growth Copilot plant Ihr Wachstum.",
  },
};
