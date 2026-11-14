import type { Locale } from "@/lib/i18n/config";

/**
 * The two closing sections of the free audit's report (client's design,
 * 2026-11-05, RepGet_Audit_End_Only.html), in every language.
 *
 * The design offers a "3-day free trial", and since 2026-11-13 that is the
 * offer again (lib/plans/features.ts TRIAL_DAYS): the plan's full, normal
 * service for the trial's days, then the plan starts unless cancelled.
 *
 * Plurals are [one, other]. {count} is TRIAL_DAYS; {pages} and {freePages}
 * are the two crawls' page limits (lib/audit/limits.ts). Text between ** is
 * set in bold.
 */

export type AuditEndingCopy = {
  label: string;
  overline: string;
  title: string;
  body: [string, string];
  cta: string;
  noteOffer: [string, string];
  noteTerms: string;
  unlockTitle: string;
  unlockTag: string;
  deeperAudit: { title: string; body: string };
  trial: { title: [string, string]; body: string };
  withPlan: { title: string; body: string };
  finalEyebrow: string;
  finalTitle: [string, string];
  finalBody: string;
  finalCta: [string, string];
};

const COPY: Record<Locale, AuditEndingCopy> = {
  en: {
    label: "Unlock your full RepGet audit",
    overline: "Your free audit is a preview",
    title: "You've seen the snapshot. Now see the full picture.",
    body: [
      "This quick check covers a **limited set of pages and signals**, not your entire online presence. Create an account and **your first day is free, with your plan's full service**, and you can check up to {pages} pages of your website.",
      "This quick check covers a **limited set of pages and signals**, not your entire online presence. Create an account and **your first {count} days are free, with your plan's full service**, and you can check up to {pages} pages of your website.",
    ],
    cta: "Unlock my full audit",
    noteOffer: ["{count}-day free trial", "{count}-day free trial"],
    noteTerms: "Registration and a card or PayPal required. Nothing is charged today; your plan starts when the trial ends unless you cancel before.",
    unlockTitle: "Go deeper with RepGet",
    unlockTag: "With your account",
    deeperAudit: {
      title: "More pages. Deeper website audit.",
      body: "Check up to {pages} pages of your site, not just the {freePages} in this free sample.",
    },
    trial: {
      title: ["Your first day, free.", "Your first {count} days, free."],
      body: "Your plan's full service: articles researched, written with images and published to your own site.",
    },
    withPlan: {
      title: "Deeper SEO, AI and social.",
      body: "Track your AI visibility, earn backlinks and publish to social: all included in your plan.",
    },
    finalEyebrow: "The next move is yours",
    finalTitle: ["Your audit is the starting point.", "Growth is what comes next."],
    finalBody: "Put your findings to work with one connected system for search, AI discovery, content and social.",
    finalCta: ["Start your free trial", "Start your {count}-day free trial"],
  },
  es: {
    label: "Desbloquee su auditoría completa de RepGet",
    overline: "Su auditoría gratuita es una vista previa",
    title: "Ya ha visto la instantánea. Ahora vea el panorama completo.",
    body: [
      "Esta revisión rápida cubre un **conjunto limitado de páginas y señales**, no toda su presencia online. Cree una cuenta y **su primer día será gratis, con el servicio completo de su plan**, además de poder revisar hasta {pages} páginas de su web.",
      "Esta revisión rápida cubre un **conjunto limitado de páginas y señales**, no toda su presencia online. Cree una cuenta y **sus primeros {count} días serán gratis, con el servicio completo de su plan**, además de poder revisar hasta {pages} páginas de su web.",
    ],
    cta: "Desbloquear mi auditoría completa",
    noteOffer: ["Prueba gratuita de {count} día", "Prueba gratuita de {count} días"],
    noteTerms: "Requiere registro y una tarjeta o PayPal. Hoy no se cobra nada; su plan empieza al terminar la prueba salvo que cancele antes.",
    unlockTitle: "Vaya más allá con RepGet",
    unlockTag: "Con su cuenta",
    deeperAudit: {
      title: "Más páginas. Una auditoría más profunda.",
      body: "Revise hasta {pages} páginas de su web, no solo las {freePages} de esta muestra gratuita.",
    },
    trial: {
      title: ["Su primer día, gratis.", "Sus primeros {count} días, gratis."],
      body: "El servicio completo de su plan: artículos investigados, redactados con imágenes y publicados en su propia web.",
    },
    withPlan: {
      title: "Más SEO, IA y redes sociales.",
      body: "Siga su visibilidad en IA, gane backlinks y publique en redes sociales: todo incluido en su plan.",
    },
    finalEyebrow: "El siguiente paso es suyo",
    finalTitle: ["Su auditoría es el punto de partida.", "Lo que viene después es crecer."],
    finalBody: "Ponga sus resultados a trabajar con un único sistema conectado para búsqueda, descubrimiento con IA, contenido y redes sociales.",
    finalCta: ["Empiece su prueba gratuita", "Empiece su prueba gratuita de {count} días"],
  },
  fr: {
    label: "Débloquez votre audit RepGet complet",
    overline: "Votre audit gratuit est un aperçu",
    title: "Vous avez vu l’instantané. Découvrez maintenant la vue d’ensemble.",
    body: [
      "Cette vérification rapide couvre un **nombre limité de pages et de signaux**, pas toute votre présence en ligne. Créez un compte : **votre premier jour est gratuit, avec le service complet de votre formule**, et vous pouvez vérifier jusqu’à {pages} pages de votre site.",
      "Cette vérification rapide couvre un **nombre limité de pages et de signaux**, pas toute votre présence en ligne. Créez un compte : **vos {count} premiers jours sont gratuits, avec le service complet de votre formule**, et vous pouvez vérifier jusqu’à {pages} pages de votre site.",
    ],
    cta: "Débloquer mon audit complet",
    noteOffer: ["Essai gratuit de {count} jour", "Essai gratuit de {count} jours"],
    noteTerms: "Inscription et carte ou PayPal requises. Rien n’est débité aujourd’hui ; votre formule démarre à la fin de l’essai, sauf si vous résiliez avant.",
    unlockTitle: "Allez plus loin avec RepGet",
    unlockTag: "Avec votre compte",
    deeperAudit: {
      title: "Plus de pages. Un audit plus approfondi.",
      body: "Vérifiez jusqu’à {pages} pages de votre site, pas seulement les {freePages} de cet échantillon gratuit.",
    },
    trial: {
      title: ["Votre premier jour, gratuit.", "Vos {count} premiers jours, gratuits."],
      body: "Le service complet de votre formule : des articles recherchés, rédigés avec images et publiés sur votre propre site.",
    },
    withPlan: {
      title: "Plus de SEO, d’IA et de social.",
      body: "Suivez votre visibilité IA, gagnez des backlinks et publiez sur les réseaux sociaux : tout est inclus dans votre formule.",
    },
    finalEyebrow: "La prochaine étape vous appartient",
    finalTitle: ["Votre audit est le point de départ.", "La croissance vient ensuite."],
    finalBody: "Mettez vos résultats au travail avec un seul système connecté pour la recherche, la découverte par IA, le contenu et les réseaux sociaux.",
    finalCta: ["Commencez votre essai gratuit", "Commencez votre essai gratuit de {count} jours"],
  },
  it: {
    label: "Sblocchi il suo audit completo di RepGet",
    overline: "Il suo audit gratuito è un’anteprima",
    title: "Ha visto l’istantanea. Ora veda il quadro completo.",
    body: [
      "Questo controllo rapido copre un **numero limitato di pagine e segnali**, non tutta la sua presenza online. Crei un account: **il suo primo giorno è gratis, con il servizio completo del suo piano** e può controllare fino a {pages} pagine del suo sito.",
      "Questo controllo rapido copre un **numero limitato di pagine e segnali**, non tutta la sua presenza online. Crei un account: **i suoi primi {count} giorni sono gratis, con il servizio completo del suo piano** e può controllare fino a {pages} pagine del suo sito.",
    ],
    cta: "Sblocca il mio audit completo",
    noteOffer: ["Prova gratuita di {count} giorno", "Prova gratuita di {count} giorni"],
    noteTerms: "Registrazione e carta o PayPal richieste. Oggi non viene addebitato nulla; il piano parte alla fine della prova, a meno che non disdica prima.",
    unlockTitle: "Vada più a fondo con RepGet",
    unlockTag: "Con il suo account",
    deeperAudit: {
      title: "Più pagine. Un audit più approfondito.",
      body: "Controlli fino a {pages} pagine del suo sito, non solo le {freePages} di questo campione gratuito.",
    },
    trial: {
      title: ["Il suo primo giorno, gratis.", "I suoi primi {count} giorni, gratis."],
      body: "Il servizio completo del suo piano: articoli ricercati, scritti con immagini e pubblicati sul suo sito.",
    },
    withPlan: {
      title: "Più SEO, AI e social.",
      body: "Segua la sua visibilità AI, ottenga backlink e pubblichi sui social: tutto incluso nel suo piano.",
    },
    finalEyebrow: "La prossima mossa è sua",
    finalTitle: ["Il suo audit è il punto di partenza.", "Poi viene la crescita."],
    finalBody: "Metta a frutto i risultati con un unico sistema connesso per ricerca, scoperta con l’AI, contenuti e social.",
    finalCta: ["Inizi la sua prova gratuita", "Inizi la sua prova gratuita di {count} giorni"],
  },
  de: {
    label: "Ihr vollständiges RepGet-Audit freischalten",
    overline: "Ihr kostenloses Audit ist eine Vorschau",
    title: "Sie haben die Momentaufnahme gesehen. Jetzt das ganze Bild.",
    body: [
      "Diese schnelle Prüfung deckt eine **begrenzte Zahl von Seiten und Signalen** ab, nicht Ihre gesamte Online-Präsenz. Erstellen Sie ein Konto: **Ihr erster Tag ist kostenlos, mit dem vollen Service Ihres Tarifs**, und Sie können bis zu {pages} Seiten Ihrer Website prüfen.",
      "Diese schnelle Prüfung deckt eine **begrenzte Zahl von Seiten und Signalen** ab, nicht Ihre gesamte Online-Präsenz. Erstellen Sie ein Konto: **Ihre ersten {count} Tage sind kostenlos, mit dem vollen Service Ihres Tarifs**, und Sie können bis zu {pages} Seiten Ihrer Website prüfen.",
    ],
    cta: "Mein vollständiges Audit freischalten",
    noteOffer: ["{count}-tägige kostenlose Testphase", "{count}-tägige kostenlose Testphase"],
    noteTerms: "Registrierung und Karte oder PayPal erforderlich. Heute wird nichts berechnet; Ihr Tarif beginnt am Ende der Testphase, sofern Sie nicht vorher kündigen.",
    unlockTitle: "Mehr erreichen mit RepGet",
    unlockTag: "Mit Ihrem Konto",
    deeperAudit: {
      title: "Mehr Seiten. Ein gründlicheres Audit.",
      body: "Prüfen Sie bis zu {pages} Seiten Ihrer Website, nicht nur die {freePages} dieser kostenlosen Stichprobe.",
    },
    trial: {
      title: ["Ihr erster Tag, kostenlos.", "Ihre ersten {count} Tage, kostenlos."],
      body: "Der volle Service Ihres Tarifs: Artikel recherchiert, mit Bildern geschrieben und auf Ihrer eigenen Website veröffentlicht.",
    },
    withPlan: {
      title: "Mehr SEO, KI und Social.",
      body: "Verfolgen Sie Ihre KI-Sichtbarkeit, verdienen Sie Backlinks und veröffentlichen Sie in sozialen Netzwerken: alles in Ihrem Tarif enthalten.",
    },
    finalEyebrow: "Der nächste Schritt liegt bei Ihnen",
    finalTitle: ["Ihr Audit ist der Ausgangspunkt.", "Danach kommt das Wachstum."],
    finalBody: "Setzen Sie Ihre Ergebnisse um, mit einem vernetzten System für Suche, KI-Auffindbarkeit, Inhalte und soziale Netzwerke.",
    finalCta: ["Kostenlose Testphase starten", "{count} Tage kostenlos testen"],
  },
};

export function auditEndingCopy(locale: Locale): AuditEndingCopy {
  return COPY[locale];
}
