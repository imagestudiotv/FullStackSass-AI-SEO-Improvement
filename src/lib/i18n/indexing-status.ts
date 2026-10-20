import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";

/**
 * What a published article's page says about its Google indexing (client,
 * 2026-10-20: "I don't seen any indexed article" - the request was sent and
 * waiting, but nothing on the page said so). One line per state of
 * article_indexing (lib/indexing/run.ts), in the five languages, in the
 * formal address the site uses. Server-only use: the article page renders it.
 */

export type IndexingRow = { status: string; submittedAt: Date | null; indexedAt: Date | null; createdAt: Date };

type Copy = {
  heading: string;
  queued: string;
  /** "{date}": the day it was sent. */
  submitted: string;
  /** "{date}": the day Google had it. */
  indexed: string;
  notIndexed: string;
  failed: string;
};

export const INDEXING_COPY: Record<Locale, Copy> = {
  en: {
    heading: "Google indexing",
    queued: "Waiting to be sent to Google. Published articles are sent within two hours.",
    submitted: "Sent to Google on {date}. Google usually takes a few days; RepGet checks every two hours and tells you when it is indexed.",
    indexed: "Indexed by Google on {date}. It can now appear in Google's results.",
    notIndexed: "Google had not indexed it ten days after the request. That is Google's decision: the article stays live, and Google can still add it later.",
    failed: "It could not be sent to Google.",
  },
  es: {
    heading: "Indexación en Google",
    queued: "Pendiente de envío a Google. Los artículos publicados se envían en un plazo de dos horas.",
    submitted: "Enviado a Google el {date}. Google suele tardar unos días; RepGet lo comprueba cada dos horas y le avisará cuando esté indexado.",
    indexed: "Indexado por Google el {date}. Ya puede aparecer en los resultados de Google.",
    notIndexed: "Google no lo había indexado diez días después de la solicitud. Es una decisión de Google: el artículo sigue publicado y Google aún puede añadirlo más adelante.",
    failed: "No se pudo enviar a Google.",
  },
  fr: {
    heading: "Indexation Google",
    queued: "En attente d’envoi à Google. Les articles publiés sont envoyés dans les deux heures.",
    submitted: "Envoyé à Google le {date}. Google met en général quelques jours ; RepGet vérifie toutes les deux heures et vous prévient dès qu’il est indexé.",
    indexed: "Indexé par Google le {date}. Il peut désormais apparaître dans les résultats de Google.",
    notIndexed: "Google ne l’avait pas indexé dix jours après la demande. C’est une décision de Google : l’article reste en ligne, et Google peut encore l’ajouter plus tard.",
    failed: "Il n’a pas pu être envoyé à Google.",
  },
  it: {
    heading: "Indicizzazione su Google",
    queued: "In attesa di invio a Google. Gli articoli pubblicati vengono inviati entro due ore.",
    submitted: "Inviato a Google il {date}. Di solito Google impiega qualche giorno; RepGet controlla ogni due ore e la avvisa quando viene indicizzato.",
    indexed: "Indicizzato da Google il {date}. Ora può comparire nei risultati di Google.",
    notIndexed: "Google non lo aveva indicizzato dieci giorni dopo la richiesta. È una decisione di Google: l’articolo resta online e Google può ancora aggiungerlo in seguito.",
    failed: "Non è stato possibile inviarlo a Google.",
  },
  de: {
    heading: "Google-Indexierung",
    queued: "Wartet auf die Übermittlung an Google. Veröffentlichte Artikel werden innerhalb von zwei Stunden gesendet.",
    submitted: "Am {date} an Google gesendet. Google braucht meist einige Tage; RepGet prüft alle zwei Stunden und benachrichtigt Sie, sobald er indexiert ist.",
    indexed: "Am {date} von Google indexiert. Er kann jetzt in den Google-Ergebnissen erscheinen.",
    notIndexed: "Google hatte ihn zehn Tage nach der Anfrage nicht indexiert. Das entscheidet Google: Der Artikel bleibt online, und Google kann ihn später noch aufnehmen.",
    failed: "Er konnte nicht an Google gesendet werden.",
  },
};

/** The article's indexing in a line, and whether it is done, still waiting, or stopped. Null for a state it does not know. */
export function indexingLine(row: IndexingRow, locale: Locale): { tone: "done" | "waiting" | "stopped"; text: string } | null {
  const copy = INDEXING_COPY[locale];
  const day = (date: Date | null) => formatDate(date ?? row.createdAt, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  switch (row.status) {
    case "queued":
      return { tone: "waiting", text: copy.queued };
    case "submitted":
      return { tone: "waiting", text: copy.submitted.replace("{date}", day(row.submittedAt)) };
    case "indexed":
      return { tone: "done", text: copy.indexed.replace("{date}", day(row.indexedAt)) };
    case "not_indexed":
      return { tone: "stopped", text: copy.notIndexed };
    case "failed":
      return { tone: "stopped", text: copy.failed };
    default:
      return null;
  }
}
