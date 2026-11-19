import type { Locale } from "@/lib/i18n/config";

/**
 * The article page's "Download" button (ticket 2026-11-19, item 4: "the
 * client is having the article ready to publish or download";
 * lib/articles/download.ts). Its own file so the five languages travel
 * together.
 */
export type ArticleDownloadCopy = {
  download: string;
  /** The button's tooltip: what the file is. */
  hint: string;
};

export const ARTICLE_DOWNLOAD_COPY: Record<Locale, ArticleDownloadCopy> = {
  en: { download: "Download", hint: "Download the article as an HTML file, ready to paste into any website or open in Word or Google Docs." },
  es: { download: "Descargar", hint: "Descargue el artículo como archivo HTML, listo para pegarlo en cualquier sitio web o abrirlo en Word o Google Docs." },
  fr: { download: "Télécharger", hint: "Téléchargez l'article en fichier HTML, prêt à coller dans n'importe quel site ou à ouvrir dans Word ou Google Docs." },
  it: { download: "Scarica", hint: "Scarichi l'articolo come file HTML, pronto da incollare in qualsiasi sito o da aprire in Word o Google Docs." },
  de: { download: "Herunterladen", hint: "Laden Sie den Artikel als HTML-Datei herunter, bereit zum Einfügen in jede Website oder zum Öffnen in Word oder Google Docs." },
};
