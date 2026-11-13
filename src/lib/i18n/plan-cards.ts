import type { Locale } from "@/lib/i18n/config";

/**
 * The words Billing's plan cards and the onboarding plan step add to the
 * pricing page's own (lib/i18n/pricing-page.ts, whose feature lists, perks and
 * price captions they reuse): the videos line, and the trial and renewal
 * terms under the price. Formal address in every language.
 *
 * `{price}` is the price checkout charges (lib/billing/display-prices.ts),
 * `{days}` the free trial's length (lib/plans/features.ts TRIAL_DAYS; the
 * 3-day trial with the plan's normal service, 2026-11-13 - `{n}` is no longer
 * quoted, and passing it is harmless), `{ideas}` the daily video ideas
 * (lib/video/formats.ts IDEAS_PER_DAY). `**words**` are bold.
 */
export type PlanCardsCopy = {
  /** Every plan: videos and carousels from the daily ideas, each paid in credits. */
  videos: string;
  /** Checkout's free trial (card, or PayPal with its trial plan), for a workspace that has never subscribed. */
  trial: string;
  renewMonth: string;
  renewYear: string;
  /** No free trial (had one already, or a plan change): charged at once. */
  chargedMonth: string;
  chargedYear: string;
  /** Under the PayPal button when PayPal cannot give the free trial for this plan. */
  paypalNoTrial: string;
};

export const PLAN_CARDS_COPY: Record<Locale, PlanCardsCopy> = {
  en: {
    videos: "**Short videos and carousels** from {ideas} new ideas a day, each made for credits",
    trial: "{days} days free, with the full service of your plan: nothing is charged today, and your plan starts when the trial ends unless you cancel before.",
    renewMonth: "Then {price} a month, renewing until you cancel.",
    renewYear: "Then {price} a year, renewing until you cancel.",
    chargedMonth: "{price} charged today, then every month until you cancel.",
    chargedYear: "{price} charged today, then every year until you cancel.",
    paypalNoTrial: "PayPal starts this plan straight away, without the free trial.",
  },
  es: {
    videos: "**Vídeos cortos y carruseles** a partir de {ideas} ideas nuevas al día, cada uno por créditos",
    trial: "{days} días gratis, con el servicio completo de su plan: hoy no se cobra nada, y su plan empieza al terminar la prueba salvo que cancele antes.",
    renewMonth: "Después, {price} al mes, con renovación hasta que cancele.",
    renewYear: "Después, {price} al año, con renovación hasta que cancele.",
    chargedMonth: "Se cobran {price} hoy y después cada mes hasta que cancele.",
    chargedYear: "Se cobran {price} hoy y después cada año hasta que cancele.",
    paypalNoTrial: "PayPal inicia este plan de inmediato, sin la prueba gratuita.",
  },
  fr: {
    videos: "**Vidéos courtes et carrousels** à partir de {ideas} nouvelles idées par jour, chacun en crédits",
    trial: "{days} jours gratuits, avec le service complet de votre forfait : rien n’est facturé aujourd’hui, et votre forfait démarre à la fin de l’essai, sauf si vous résiliez avant.",
    renewMonth: "Ensuite {price} par mois, renouvelé jusqu’à votre résiliation.",
    renewYear: "Ensuite {price} par an, renouvelé jusqu’à votre résiliation.",
    chargedMonth: "{price} facturés aujourd’hui, puis chaque mois jusqu’à votre résiliation.",
    chargedYear: "{price} facturés aujourd’hui, puis chaque année jusqu’à votre résiliation.",
    paypalNoTrial: "PayPal démarre ce forfait immédiatement, sans l’essai gratuit.",
  },
  it: {
    videos: "**Video brevi e caroselli** da {ideas} nuove idee al giorno, ciascuno con i crediti",
    trial: "{days} giorni gratis, con il servizio completo del Suo piano: oggi non viene addebitato nulla, e il piano parte alla fine della prova, a meno che non disdica prima.",
    renewMonth: "Poi {price} al mese, con rinnovo fino alla disdetta.",
    renewYear: "Poi {price} all’anno, con rinnovo fino alla disdetta.",
    chargedMonth: "{price} addebitati oggi, poi ogni mese fino alla disdetta.",
    chargedYear: "{price} addebitati oggi, poi ogni anno fino alla disdetta.",
    paypalNoTrial: "PayPal avvia subito questo piano, senza la prova gratuita.",
  },
  de: {
    videos: "**Kurzvideos und Karussells** aus {ideas} neuen Ideen pro Tag, jeweils gegen Credits",
    trial: "{days} Tage kostenlos, mit dem vollen Service Ihres Tarifs: Heute wird nichts berechnet, und Ihr Tarif beginnt am Ende der Testphase, sofern Sie nicht vorher kündigen.",
    renewMonth: "Danach {price} pro Monat, verlängert sich bis zur Kündigung.",
    renewYear: "Danach {price} pro Jahr, verlängert sich bis zur Kündigung.",
    chargedMonth: "{price} werden heute berechnet, danach monatlich bis zur Kündigung.",
    chargedYear: "{price} werden heute berechnet, danach jährlich bis zur Kündigung.",
    paypalNoTrial: "PayPal startet diesen Tarif sofort, ohne die kostenlose Testphase.",
  },
};
