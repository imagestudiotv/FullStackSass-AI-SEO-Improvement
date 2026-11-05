import type { Locale } from "@/lib/i18n/config";

/**
 * The two closing sections of the free audit's report (client's design,
 * 2026-11-05, RepGet_Audit_End_Only.html), in every language.
 *
 * The design offers a "3-day free trial". The offer ended on 2026-10-09: a new
 * account gets its first articles free (lib/plans/features.ts), and AI
 * visibility, backlinks and all but one social network wait for the plan to
 * start. So this says that, with the design's layout and tone.
 *
 * Plurals are [one, other]. {count} is FREE_ARTICLES; {pages} and {freePages}
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
  freeArticles: { title: [string, string]; body: string };
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
      "This quick check covers a **limited set of pages and signals**, not your entire online presence. Create an account and **your first article is free**, and you can check up to {pages} pages of your website.",
      "This quick check covers a **limited set of pages and signals**, not your entire online presence. Create an account and **your first {count} articles are free**, and you can check up to {pages} pages of your website.",
    ],
    cta: "Unlock my full audit",
    noteOffer: ["{count} free article", "{count} free articles"],
    noteTerms: "Registration and a payment method required. Nothing is charged until your plan starts.",
    unlockTitle: "Go deeper with RepGet",
    unlockTag: "With your account",
    deeperAudit: {
      title: "More pages. Deeper website audit.",
      body: "Check up to {pages} pages of your site, not just the {freePages} in this free sample.",
    },
    freeArticles: {
      title: ["Your first article, free.", "Your first {count} articles, free."],
      body: "Researched, written with images and published to your own site.",
    },
    withPlan: {
      title: "Deeper SEO, AI and social.",
      body: "Track your AI visibility, earn backlinks and publish to social once your plan starts.",
    },
    finalEyebrow: "The next move is yours",
    finalTitle: ["Your audit is the starting point.", "Growth is what comes next."],
    finalBody: "Put your findings to work with one connected system for search, AI discovery, content and social.",
    finalCta: ["Create your free article", "Create {count} Articles for Free"],
  },
  es: {
    label: "Desbloquee su auditoría completa de RepGet",
    overline: "Su auditoría gratuita es una vista previa",
    title: "Ya ha visto la instantánea. Ahora vea el panorama completo.",
    body: [
      "Esta revisión rápida cubre un **conjunto limitado de páginas y señales**, no toda su presencia online. Cree una cuenta y **su primer artículo será gratis**, además de poder revisar hasta {pages} páginas de su web.",
      "Esta revisión rápida cubre un **conjunto limitado de páginas y señales**, no toda su presencia online. Cree una cuenta y **sus primeros {count} artículos serán gratis**, además de poder revisar hasta {pages} páginas de su web.",
    ],
    cta: "Desbloquear mi auditoría completa",
    noteOffer: ["{count} artículo gratis", "{count} artículos gratis"],
    noteTerms: "Requiere registro y un método de pago. No se cobra nada hasta que empiece su plan.",
    unlockTitle: "Vaya más allá con RepGet",
    unlockTag: "Con su cuenta",
    deeperAudit: {
      title: "Más páginas. Una auditoría más profunda.",
      body: "Revise hasta {pages} páginas de su web, no solo las {freePages} de esta muestra gratuita.",
    },
    freeArticles: {
      title: ["Su primer artículo, gratis.", "Sus primeros {count} artículos, gratis."],
      body: "Investigados, redactados con imágenes y publicados en su propia web.",
    },
    withPlan: {
      title: "Más SEO, IA y redes sociales.",
      body: "Siga su visibilidad en IA, gane backlinks y publique en redes sociales cuando empiece su plan.",
    },
    finalEyebrow: "El siguiente paso es suyo",
    finalTitle: ["Su auditoría es el punto de partida.", "Lo que viene después es crecer."],
    finalBody: "Ponga sus resultados a trabajar con un único sistema conectado para búsqueda, descubrimiento con IA, contenido y redes sociales.",
    finalCta: ["Cree su artículo gratis", "Cree {count} artículos gratis"],
  },
  fr: {
    label: "Débloquez votre audit RepGet complet",
    overline: "Votre audit gratuit est un aperçu",
    title: "Vous avez vu l’instantané. Découvrez maintenant la vue d’ensemble.",
    body: [
      "Cette vérification rapide couvre un **nombre limité de pages et de signaux**, pas toute votre présence en ligne. Créez un compte : **votre premier article est gratuit**, et vous pouvez vérifier jusqu’à {pages} pages de votre site.",
      "Cette vérification rapide couvre un **nombre limité de pages et de signaux**, pas toute votre présence en ligne. Créez un compte : **vos {count} premiers articles sont gratuits**, et vous pouvez vérifier jusqu’à {pages} pages de votre site.",
    ],
    cta: "Débloquer mon audit complet",
    noteOffer: ["{count} article gratuit", "{count} articles gratuits"],
    noteTerms: "Inscription et moyen de paiement requis. Rien n’est débité avant le début de votre formule.",
    unlockTitle: "Allez plus loin avec RepGet",
    unlockTag: "Avec votre compte",
    deeperAudit: {
      title: "Plus de pages. Un audit plus approfondi.",
      body: "Vérifiez jusqu’à {pages} pages de votre site, pas seulement les {freePages} de cet échantillon gratuit.",
    },
    freeArticles: {
      title: ["Votre premier article, gratuit.", "Vos {count} premiers articles, gratuits."],
      body: "Recherchés, rédigés avec images et publiés sur votre propre site.",
    },
    withPlan: {
      title: "Plus de SEO, d’IA et de social.",
      body: "Suivez votre visibilité IA, gagnez des backlinks et publiez sur les réseaux sociaux dès le début de votre formule.",
    },
    finalEyebrow: "La prochaine étape vous appartient",
    finalTitle: ["Votre audit est le point de départ.", "La croissance vient ensuite."],
    finalBody: "Mettez vos résultats au travail avec un seul système connecté pour la recherche, la découverte par IA, le contenu et les réseaux sociaux.",
    finalCta: ["Créez votre article gratuit", "Créez {count} articles gratuitement"],
  },
  it: {
    label: "Sblocchi il suo audit completo di RepGet",
    overline: "Il suo audit gratuito è un’anteprima",
    title: "Ha visto l’istantanea. Ora veda il quadro completo.",
    body: [
      "Questo controllo rapido copre un **numero limitato di pagine e segnali**, non tutta la sua presenza online. Crei un account: **il suo primo articolo è gratis** e può controllare fino a {pages} pagine del suo sito.",
      "Questo controllo rapido copre un **numero limitato di pagine e segnali**, non tutta la sua presenza online. Crei un account: **i suoi primi {count} articoli sono gratis** e può controllare fino a {pages} pagine del suo sito.",
    ],
    cta: "Sblocca il mio audit completo",
    noteOffer: ["{count} articolo gratis", "{count} articoli gratis"],
    noteTerms: "Registrazione e metodo di pagamento richiesti. Nessun addebito fino all’avvio del piano.",
    unlockTitle: "Vada più a fondo con RepGet",
    unlockTag: "Con il suo account",
    deeperAudit: {
      title: "Più pagine. Un audit più approfondito.",
      body: "Controlli fino a {pages} pagine del suo sito, non solo le {freePages} di questo campione gratuito.",
    },
    freeArticles: {
      title: ["Il suo primo articolo, gratis.", "I suoi primi {count} articoli, gratis."],
      body: "Ricercati, scritti con immagini e pubblicati sul suo sito.",
    },
    withPlan: {
      title: "Più SEO, AI e social.",
      body: "Segua la sua visibilità AI, ottenga backlink e pubblichi sui social all’avvio del piano.",
    },
    finalEyebrow: "La prossima mossa è sua",
    finalTitle: ["Il suo audit è il punto di partenza.", "Poi viene la crescita."],
    finalBody: "Metta a frutto i risultati con un unico sistema connesso per ricerca, scoperta con l’AI, contenuti e social.",
    finalCta: ["Crei il suo articolo gratis", "Crei {count} articoli gratis"],
  },
  de: {
    label: "Ihr vollständiges RepGet-Audit freischalten",
    overline: "Ihr kostenloses Audit ist eine Vorschau",
    title: "Sie haben die Momentaufnahme gesehen. Jetzt das ganze Bild.",
    body: [
      "Diese schnelle Prüfung deckt eine **begrenzte Zahl von Seiten und Signalen** ab, nicht Ihre gesamte Online-Präsenz. Erstellen Sie ein Konto: **Ihr erster Artikel ist kostenlos**, und Sie können bis zu {pages} Seiten Ihrer Website prüfen.",
      "Diese schnelle Prüfung deckt eine **begrenzte Zahl von Seiten und Signalen** ab, nicht Ihre gesamte Online-Präsenz. Erstellen Sie ein Konto: **Ihre ersten {count} Artikel sind kostenlos**, und Sie können bis zu {pages} Seiten Ihrer Website prüfen.",
    ],
    cta: "Mein vollständiges Audit freischalten",
    noteOffer: ["{count} kostenloser Artikel", "{count} kostenlose Artikel"],
    noteTerms: "Registrierung und Zahlungsmethode erforderlich. Es wird nichts berechnet, bis Ihr Tarif beginnt.",
    unlockTitle: "Mehr erreichen mit RepGet",
    unlockTag: "Mit Ihrem Konto",
    deeperAudit: {
      title: "Mehr Seiten. Ein gründlicheres Audit.",
      body: "Prüfen Sie bis zu {pages} Seiten Ihrer Website, nicht nur die {freePages} dieser kostenlosen Stichprobe.",
    },
    freeArticles: {
      title: ["Ihr erster Artikel, kostenlos.", "Ihre ersten {count} Artikel, kostenlos."],
      body: "Recherchiert, mit Bildern geschrieben und auf Ihrer eigenen Website veröffentlicht.",
    },
    withPlan: {
      title: "Mehr SEO, KI und Social.",
      body: "Verfolgen Sie Ihre KI-Sichtbarkeit, verdienen Sie Backlinks und veröffentlichen Sie in sozialen Netzwerken, sobald Ihr Tarif beginnt.",
    },
    finalEyebrow: "Der nächste Schritt liegt bei Ihnen",
    finalTitle: ["Ihr Audit ist der Ausgangspunkt.", "Danach kommt das Wachstum."],
    finalBody: "Setzen Sie Ihre Ergebnisse um, mit einem vernetzten System für Suche, KI-Auffindbarkeit, Inhalte und soziale Netzwerke.",
    finalCta: ["Ihren kostenlosen Artikel erstellen", "{count} Artikel kostenlos erstellen"],
  },
};

export function auditEndingCopy(locale: Locale): AuditEndingCopy {
  return COPY[locale];
}
