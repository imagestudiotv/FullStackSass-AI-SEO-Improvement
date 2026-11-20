import type { Locale } from "@/lib/i18n/config";

/**
 * The words around a success story from Admin -> Success stories (client,
 * 2026-11-19): its page, /success-stories/<slug>, and its card on
 * /success-stories. The story itself is in the language the administrator
 * wrote it in; only these are translated. Formal register, as the rest of
 * the site.
 */
export type SuccessStoryCopy = {
  /** Over the cards after Image Studio's on /success-stories. */
  moreTitle: string;
  /** A card's link. */
  readStory: string;
  /** The key figures' row, for screen readers. */
  figuresLabel: string;
  /** "{name}" is the business. */
  visitWebsite: string;
  /** "{name}" is the business. */
  discoverProfile: string;
  /** "{date}". */
  published: string;
};

export const SUCCESS_STORY_COPY: Record<Locale, SuccessStoryCopy> = {
  en: {
    moreTitle: "More customer stories",
    readStory: "Read the story",
    figuresLabel: "Key figures",
    visitWebsite: "Visit {name}'s website",
    discoverProfile: "See {name} on Discover",
    published: "Published {date}",
  },
  es: {
    moreTitle: "Más casos de clientes",
    readStory: "Leer el caso",
    figuresLabel: "Cifras clave",
    visitWebsite: "Visitar el sitio web de {name}",
    discoverProfile: "Ver {name} en Discover",
    published: "Publicado el {date}",
  },
  fr: {
    moreTitle: "Plus d’histoires de clients",
    readStory: "Lire l’histoire",
    figuresLabel: "Chiffres clés",
    visitWebsite: "Visiter le site de {name}",
    discoverProfile: "Voir {name} sur Discover",
    published: "Publié le {date}",
  },
  it: {
    moreTitle: "Altre storie dei clienti",
    readStory: "Legga la storia",
    figuresLabel: "Dati principali",
    visitWebsite: "Visiti il sito di {name}",
    discoverProfile: "Veda {name} su Discover",
    published: "Pubblicato il {date}",
  },
  de: {
    moreTitle: "Weitere Kundengeschichten",
    readStory: "Geschichte lesen",
    figuresLabel: "Wichtige Kennzahlen",
    visitWebsite: "Website von {name} besuchen",
    discoverProfile: "{name} auf Discover ansehen",
    published: "Veröffentlicht am {date}",
  },
};
