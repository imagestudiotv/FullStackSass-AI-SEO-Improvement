import type { Locale } from "@/lib/i18n/config";

/**
 * The words Billing's plan cards and the onboarding plan step add to the
 * pricing page's own (lib/i18n/pricing-page.ts, whose feature lists, perks and
 * price captions they reuse): the videos line, and the trial and renewal
 * terms under the price. Formal address in every language.
 *
 * `{price}` is the price checkout charges (lib/billing/display-prices.ts),
 * `{n}` and `{days}` the free articles and their longest wait
 * (lib/plans/features.ts FREE_ARTICLES, FREE_ARTICLES_DAYS), `{ideas}` the
 * daily video ideas (lib/video/formats.ts IDEAS_PER_DAY). `**words**` are bold.
 */
export type PlanCardsCopy = {
  /** Every plan: videos and carousels from the daily ideas, each paid in credits. */
  videos: string;
  /** Card checkout's free articles, for a workspace that has never subscribed. */
  trial: string;
  renewMonth: string;
  renewYear: string;
  /** No free articles (had them already, or a plan change): charged at once. */
  chargedMonth: string;
  chargedYear: string;
  /** Under the PayPal button when PayPal cannot give the free articles for this plan. */
  paypalNoTrial: string;
};

export const PLAN_CARDS_COPY: Record<Locale, PlanCardsCopy> = {
  en: {
    videos: "**Short videos and carousels** from {ideas} new ideas a day, each made for credits",
    trial: "Your first {n} articles are free: nothing is charged until they are written ({days} days at most).",
    renewMonth: "Then {price} a month, renewing until you cancel.",
    renewYear: "Then {price} a year, renewing until you cancel.",
    chargedMonth: "{price} charged today, then every month until you cancel.",
    chargedYear: "{price} charged today, then every year until you cancel.",
    paypalNoTrial: "PayPal starts this plan straight away, without the free articles.",
  },
  es: {
    videos: "**Vídeos cortos y carruseles** a partir de {ideas} ideas nuevas al día, cada uno por créditos",
    trial: "Sus primeros {n} artículos son gratis: no se cobra nada hasta que estén escritos ({days} días como máximo).",
    renewMonth: "Después, {price} al mes, con renovación hasta que cancele.",
    renewYear: "Después, {price} al año, con renovación hasta que cancele.",
    chargedMonth: "Se cobran {price} hoy y después cada mes hasta que cancele.",
    chargedYear: "Se cobran {price} hoy y después cada año hasta que cancele.",
    paypalNoTrial: "PayPal inicia este plan de inmediato, sin los artículos gratuitos.",
  },
  fr: {
    videos: "**Vidéos courtes et carrousels** à partir de {ideas} nouvelles idées par jour, chacun en crédits",
    trial: "Vos {n} premiers articles sont gratuits : rien n’est facturé avant qu’ils soient rédigés ({days} jours au maximum).",
    renewMonth: "Ensuite {price} par mois, renouvelé jusqu’à votre résiliation.",
    renewYear: "Ensuite {price} par an, renouvelé jusqu’à votre résiliation.",
    chargedMonth: "{price} facturés aujourd’hui, puis chaque mois jusqu’à votre résiliation.",
    chargedYear: "{price} facturés aujourd’hui, puis chaque année jusqu’à votre résiliation.",
    paypalNoTrial: "PayPal démarre ce forfait immédiatement, sans les articles gratuits.",
  },
  it: {
    videos: "**Video brevi e caroselli** da {ideas} nuove idee al giorno, ciascuno con i crediti",
    trial: "I Suoi primi {n} articoli sono gratuiti: non viene addebitato nulla finché non sono scritti ({days} giorni al massimo).",
    renewMonth: "Poi {price} al mese, con rinnovo fino alla disdetta.",
    renewYear: "Poi {price} all’anno, con rinnovo fino alla disdetta.",
    chargedMonth: "{price} addebitati oggi, poi ogni mese fino alla disdetta.",
    chargedYear: "{price} addebitati oggi, poi ogni anno fino alla disdetta.",
    paypalNoTrial: "PayPal avvia subito questo piano, senza gli articoli gratuiti.",
  },
  de: {
    videos: "**Kurzvideos und Karussells** aus {ideas} neuen Ideen pro Tag, jeweils gegen Credits",
    trial: "Ihre ersten {n} Artikel sind kostenlos: Berechnet wird erst, wenn sie geschrieben sind (spätestens nach {days} Tagen).",
    renewMonth: "Danach {price} pro Monat, verlängert sich bis zur Kündigung.",
    renewYear: "Danach {price} pro Jahr, verlängert sich bis zur Kündigung.",
    chargedMonth: "{price} werden heute berechnet, danach monatlich bis zur Kündigung.",
    chargedYear: "{price} werden heute berechnet, danach jährlich bis zur Kündigung.",
    paypalNoTrial: "PayPal startet diesen Tarif sofort, ohne die kostenlosen Artikel.",
  },
};
