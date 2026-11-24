import type { Locale } from "@/lib/i18n/config";

/**
 * The plans on Billing (Daniel's design of 2026-11-24,
 * repget-pricing-redesign.html): the words around the cards, the comparison
 * and the checkout dialog. Formal address in every language. The plans'
 * benefits, prices and terms are not here: they are the pricing page's and the
 * plan rows' (lib/plans/benefits.ts, billing/plan-cards.ts).
 */
export type BillingPlansCopy = {
  eyebrow: string;
  title: string;
  body: string;
  website: string;
  switchWebsite: string;
  assist: string;
  frequency: string;
  promoActive: string;
  /** A website already on the REPGET launch price: it keeps it through a plan change. */
  keptTitle: string;
  keptBody: string;
  bestValue: string;
  yourChoice: string;
  highlights: string;
  highlightsBundle: string;
  choose: string;
  get: string;
  seeEverything: string;
  seeBenefits: string;
  monthlyOnly: string;
  /** In place of the button: the server refuses this change (repget-subscription.ts offerForPlanChange). */
  launchNotCovered: string;
  /** Under the button of Grow + Visibility, for a website on the launch price. */
  bundleLaunchNote: string;
  /** In place of its button: during a free trial, and from a yearly plan (repget-subscription.ts bundleChangeRefusal). */
  bundleAfterTrial: string;
  bundleNotYearly: string;
  contactUs: string;
  trustSecure: string;
  trustClear: string;
  trustPeriods: string;
  trustMonthly: string;
  trustBoth: string;
  trustCard: string;
  compareTitle: string;
  compareBody: string;
  showAll: string;
  showFewer: string;
  swipe: string;
  features: string;
  included: string;
  notIncluded: string;
  monthlyCredits: string;
  videos: string;
  /** In the list of websites, under the plans: the one this page is about. */
  shownAbove: string;
  addonsTitle: string;
  addonsBody: string;
  creditPacks: string;
  dialogEyebrow: string;
  dialogTitle: string;
  switchTitle: string;
  dialogBody: string;
  dialogBodyNoSite: string;
  switchBody: string;
  planName: string;
  monthlySubscription: string;
  annualSubscription: string;
};

export const BILLING_PLANS_COPY: Record<Locale, BillingPlansCopy> = {
  en: {
    eyebrow: "Your growth, your way",
    title: "Choose your next stage of growth.",
    body: "Powerful tools, more visibility, and room to scale. Find the right fit for your brand.",
    website: "Website:",
    switchWebsite: "Show another website",
    assist: "Simple plans. Clear limits. Each plan is for one website.",
    frequency: "Billing frequency",
    promoActive: "Promo active",
    keptTitle: "Your launch price stays with you.",
    keptBody: "40% off the regular price on every payment, on Grow and Scale, also when you change plan.",
    bestValue: "Best value",
    yourChoice: "Your choice",
    highlights: "Plan highlights",
    highlightsBundle: "Everything to grow your reach",
    choose: "Choose {plan}",
    get: "Get {plan}",
    seeEverything: "See everything included",
    seeBenefits: "Explore all benefits",
    monthlyOnly: "Monthly only",
    launchNotCovered: "Your launch price does not cover this plan, so moving to it would end your discount.",
    bundleLaunchNote: "Your 40% launch discount does not apply to this plan: you pay the price shown. Go back to Grow or Scale and it returns.",
    bundleAfterTrial: "This plan has no free trial. You can change to it once your free trial has ended.",
    bundleNotYearly: "This plan is billed monthly only, so a yearly plan cannot be changed to it.",
    contactUs: "Contact us to change to it",
    trustSecure: "Secure payments",
    trustClear: "Transparent billing",
    trustPeriods: "Monthly or annual billing",
    trustMonthly: "Monthly billing",
    trustBoth: "Card or PayPal",
    trustCard: "Card payments",
    compareTitle: "Compare plans at a glance.",
    compareBody: "All the important numbers, without the guesswork.",
    showAll: "Show complete comparison",
    showFewer: "Show fewer features",
    swipe: "Swipe the table sideways to see every plan.",
    features: "Features",
    included: "Included",
    notIncluded: "Not included",
    monthlyCredits: "Credits / month",
    videos: "Short videos and carousels, each made for credits",
    shownAbove: "Shown above",
    addonsTitle: "Need something beyond your plan?",
    addonsBody: "Explore optional services without complicating your subscription.",
    creditPacks: "Credit packs",
    dialogEyebrow: "Next step",
    dialogTitle: "Continue with {plan}",
    switchTitle: "Switch to {plan}",
    dialogBody: "Choose how to pay for {domain}.",
    dialogBodyNoSite: "Choose how to pay.",
    switchBody: "You review the change for {domain}, and anything to pay for it, on the payment provider's page before you confirm.",
    planName: "{plan} plan",
    monthlySubscription: "Monthly subscription",
    annualSubscription: "Annual subscription (12 months)",
  },
  es: {
    eyebrow: "Su crecimiento, a su manera",
    title: "Elija su próxima etapa de crecimiento.",
    body: "Herramientas potentes, más visibilidad y margen para crecer. Encuentre lo que mejor encaja con su marca.",
    website: "Sitio web:",
    switchWebsite: "Ver otro sitio web",
    assist: "Planes sencillos. Límites claros. Cada plan es para un sitio web.",
    frequency: "Frecuencia de facturación",
    promoActive: "Promoción activa",
    keptTitle: "Usted conserva su precio de lanzamiento.",
    keptBody: "Un 40 % de descuento sobre el precio normal en cada pago, en Grow y Scale, también al cambiar de plan.",
    bestValue: "La mejor opción",
    yourChoice: "Su elección",
    highlights: "Lo más destacado",
    highlightsBundle: "Todo para ampliar su alcance",
    choose: "Elegir {plan}",
    get: "Conseguir {plan}",
    seeEverything: "Ver todo lo que incluye",
    seeBenefits: "Ver todas las ventajas",
    monthlyOnly: "Solo mensual",
    launchNotCovered: "Su precio de lanzamiento no cubre este plan, así que al cambiar perdería el descuento.",
    bundleLaunchNote: "Su descuento de lanzamiento del 40 % no se aplica a este plan: paga el precio indicado. Si vuelve a Grow o Scale, lo recupera.",
    bundleAfterTrial: "Este plan no tiene prueba gratuita. Podrá cambiar a él cuando termine su prueba gratuita.",
    bundleNotYearly: "Este plan solo se factura por meses, así que no se puede cambiar a él desde un plan anual.",
    contactUs: "Contáctenos para cambiar a él",
    trustSecure: "Pagos seguros",
    trustClear: "Facturación transparente",
    trustPeriods: "Facturación mensual o anual",
    trustMonthly: "Facturación mensual",
    trustBoth: "Tarjeta o PayPal",
    trustCard: "Pago con tarjeta",
    compareTitle: "Compare los planes de un vistazo.",
    compareBody: "Todas las cifras importantes, sin conjeturas.",
    showAll: "Ver la comparación completa",
    showFewer: "Ver menos funciones",
    swipe: "Deslice la tabla hacia los lados para ver todos los planes.",
    features: "Funciones",
    included: "Incluido",
    notIncluded: "No incluido",
    monthlyCredits: "Créditos / mes",
    videos: "Vídeos cortos y carruseles, cada uno por créditos",
    shownAbove: "Se muestra arriba",
    addonsTitle: "¿Necesita algo más que su plan?",
    addonsBody: "Descubra servicios opcionales sin complicar su suscripción.",
    creditPacks: "Paquetes de créditos",
    dialogEyebrow: "Siguiente paso",
    dialogTitle: "Continuar con {plan}",
    switchTitle: "Cambiar a {plan}",
    dialogBody: "Elija cómo pagar {domain}.",
    dialogBodyNoSite: "Elija cómo pagar.",
    switchBody: "Antes de confirmar, revisará el cambio de {domain} y lo que haya que pagar en la página del proveedor de pago.",
    planName: "Plan {plan}",
    monthlySubscription: "Suscripción mensual",
    annualSubscription: "Suscripción anual (12 meses)",
  },
  fr: {
    eyebrow: "Votre croissance, à votre façon",
    title: "Choisissez votre prochaine étape de croissance.",
    body: "Des outils puissants, plus de visibilité et de quoi grandir. Trouvez ce qui convient à votre marque.",
    website: "Site :",
    switchWebsite: "Afficher un autre site",
    assist: "Des forfaits simples. Des limites claires. Chaque forfait couvre un site.",
    frequency: "Fréquence de facturation",
    promoActive: "Promo active",
    keptTitle: "Vous conservez votre prix de lancement.",
    keptBody: "40 % de réduction sur le prix normal à chaque paiement, sur Grow et Scale, même en changeant de forfait.",
    bestValue: "Le plus avantageux",
    yourChoice: "Votre choix",
    highlights: "Les points forts",
    highlightsBundle: "Tout pour élargir votre portée",
    choose: "Choisir {plan}",
    get: "Obtenir {plan}",
    seeEverything: "Voir tout ce qui est inclus",
    seeBenefits: "Découvrir tous les avantages",
    monthlyOnly: "Mensuel uniquement",
    launchNotCovered: "Votre prix de lancement ne couvre pas ce forfait : en changer mettrait fin à votre réduction.",
    bundleLaunchNote: "Votre réduction de lancement de 40 % ne s’applique pas à ce forfait : vous payez le prix affiché. Elle revient si vous repassez à Grow ou Scale.",
    bundleAfterTrial: "Ce forfait n’a pas d’essai gratuit. Vous pourrez y passer une fois votre essai gratuit terminé.",
    bundleNotYearly: "Ce forfait est facturé au mois uniquement : un forfait annuel ne peut pas y passer.",
    contactUs: "Contactez-nous pour y passer",
    trustSecure: "Paiements sécurisés",
    trustClear: "Facturation transparente",
    trustPeriods: "Facturation mensuelle ou annuelle",
    trustMonthly: "Facturation mensuelle",
    trustBoth: "Carte ou PayPal",
    trustCard: "Paiement par carte",
    compareTitle: "Comparez les forfaits en un coup d’œil.",
    compareBody: "Tous les chiffres importants, sans devinettes.",
    showAll: "Afficher la comparaison complète",
    showFewer: "Afficher moins de fonctions",
    swipe: "Faites glisser le tableau sur le côté pour voir tous les forfaits.",
    features: "Fonctions",
    included: "Inclus",
    notIncluded: "Non inclus",
    monthlyCredits: "Crédits / mois",
    videos: "Vidéos courtes et carrousels, chacun en crédits",
    shownAbove: "Affiché ci-dessus",
    addonsTitle: "Besoin de plus que votre forfait ?",
    addonsBody: "Découvrez des services en option sans compliquer votre abonnement.",
    creditPacks: "Packs de crédits",
    dialogEyebrow: "Étape suivante",
    dialogTitle: "Continuer avec {plan}",
    switchTitle: "Passer à {plan}",
    dialogBody: "Choisissez comment payer pour {domain}.",
    dialogBodyNoSite: "Choisissez comment payer.",
    switchBody: "Vous vérifiez le changement pour {domain}, et ce qu’il y a à payer, sur la page du prestataire de paiement avant de confirmer.",
    planName: "Forfait {plan}",
    monthlySubscription: "Abonnement mensuel",
    annualSubscription: "Abonnement annuel (12 mois)",
  },
  it: {
    eyebrow: "La Sua crescita, a modo Suo",
    title: "Scelga la Sua prossima fase di crescita.",
    body: "Strumenti potenti, più visibilità e spazio per crescere. Trovi ciò che fa per il Suo brand.",
    website: "Sito:",
    switchWebsite: "Mostra un altro sito",
    assist: "Piani semplici. Limiti chiari. Ogni piano vale per un sito.",
    frequency: "Frequenza di fatturazione",
    promoActive: "Promo attiva",
    keptTitle: "Il Suo prezzo di lancio resta.",
    keptBody: "40% di sconto sul prezzo normale a ogni pagamento, su Grow e Scale, anche cambiando piano.",
    bestValue: "Il più conveniente",
    yourChoice: "La Sua scelta",
    highlights: "In evidenza",
    highlightsBundle: "Tutto per ampliare la Sua portata",
    choose: "Scegli {plan}",
    get: "Ottieni {plan}",
    seeEverything: "Vedi tutto ciò che è incluso",
    seeBenefits: "Scopri tutti i vantaggi",
    monthlyOnly: "Solo mensile",
    launchNotCovered: "Il Suo prezzo di lancio non copre questo piano: passando a questo piano perderebbe lo sconto.",
    bundleLaunchNote: "Il Suo sconto di lancio del 40% non si applica a questo piano: paga il prezzo indicato. Se torna a Grow o Scale, lo ritrova.",
    bundleAfterTrial: "Questo piano non ha una prova gratuita. Potrà passare a questo piano al termine della prova gratuita.",
    bundleNotYearly: "Questo piano si paga solo mensilmente: da un piano annuale non è possibile passare a questo.",
    contactUs: "Ci contatti per cambiare",
    trustSecure: "Pagamenti sicuri",
    trustClear: "Fatturazione trasparente",
    trustPeriods: "Fatturazione mensile o annuale",
    trustMonthly: "Fatturazione mensile",
    trustBoth: "Carta o PayPal",
    trustCard: "Pagamento con carta",
    compareTitle: "Confronti i piani a colpo d’occhio.",
    compareBody: "Tutti i numeri importanti, senza congetture.",
    showAll: "Mostra il confronto completo",
    showFewer: "Mostra meno funzioni",
    swipe: "Scorra la tabella di lato per vedere tutti i piani.",
    features: "Funzioni",
    included: "Incluso",
    notIncluded: "Non incluso",
    monthlyCredits: "Crediti / mese",
    videos: "Video brevi e caroselli, ciascuno con i crediti",
    shownAbove: "Mostrato sopra",
    addonsTitle: "Le serve qualcosa oltre il piano?",
    addonsBody: "Scopra i servizi opzionali senza complicare l’abbonamento.",
    creditPacks: "Pacchetti di crediti",
    dialogEyebrow: "Prossimo passo",
    dialogTitle: "Continui con {plan}",
    switchTitle: "Passa a {plan}",
    dialogBody: "Scelga come pagare per {domain}.",
    dialogBodyNoSite: "Scelga come pagare.",
    switchBody: "Prima di confermare, verifica la modifica per {domain} e l’eventuale importo da pagare sulla pagina del fornitore di pagamento.",
    planName: "Piano {plan}",
    monthlySubscription: "Abbonamento mensile",
    annualSubscription: "Abbonamento annuale (12 mesi)",
  },
  de: {
    eyebrow: "Ihr Wachstum, Ihr Weg",
    title: "Wählen Sie Ihre nächste Wachstumsstufe.",
    body: "Starke Werkzeuge, mehr Sichtbarkeit und Platz zum Wachsen. Finden Sie, was zu Ihrer Marke passt.",
    website: "Website:",
    switchWebsite: "Andere Website anzeigen",
    assist: "Einfache Tarife. Klare Grenzen. Jeder Tarif gilt für eine Website.",
    frequency: "Abrechnungszeitraum",
    promoActive: "Aktion aktiv",
    keptTitle: "Ihr Einführungspreis bleibt Ihnen erhalten.",
    keptBody: "40 % Rabatt auf den regulären Preis bei jeder Zahlung, für Grow und Scale, auch beim Tarifwechsel.",
    bestValue: "Bestes Angebot",
    yourChoice: "Ihre Auswahl",
    highlights: "Das Wichtigste",
    highlightsBundle: "Alles für mehr Reichweite",
    choose: "{plan} wählen",
    get: "{plan} holen",
    seeEverything: "Alles Enthaltene ansehen",
    seeBenefits: "Alle Vorteile ansehen",
    monthlyOnly: "Nur monatlich",
    launchNotCovered: "Ihr Einführungspreis gilt nicht für diesen Tarif; mit einem Wechsel würde Ihr Rabatt enden.",
    bundleLaunchNote: "Ihr Einführungsrabatt von 40 % gilt nicht für diesen Tarif: Sie zahlen den angezeigten Preis. Wechseln Sie zurück zu Grow oder Scale, gilt er wieder.",
    bundleAfterTrial: "Dieser Tarif hat keine kostenlose Testphase. Sie können zu ihm wechseln, sobald Ihre Testphase endet.",
    bundleNotYearly: "Dieser Tarif wird nur monatlich abgerechnet; von einem Jahrestarif ist kein Wechsel möglich.",
    contactUs: "Kontaktieren Sie uns für den Wechsel",
    trustSecure: "Sichere Zahlungen",
    trustClear: "Transparente Abrechnung",
    trustPeriods: "Monatliche oder jährliche Abrechnung",
    trustMonthly: "Monatliche Abrechnung",
    trustBoth: "Karte oder PayPal",
    trustCard: "Kartenzahlung",
    compareTitle: "Tarife auf einen Blick vergleichen.",
    compareBody: "Alle wichtigen Zahlen, ohne Rätselraten.",
    showAll: "Vollständigen Vergleich anzeigen",
    showFewer: "Weniger Funktionen anzeigen",
    swipe: "Wischen Sie die Tabelle zur Seite, um alle Tarife zu sehen.",
    features: "Funktionen",
    included: "Enthalten",
    notIncluded: "Nicht enthalten",
    monthlyCredits: "Credits / Monat",
    videos: "Kurzvideos und Karussells, jeweils gegen Credits",
    shownAbove: "Oben angezeigt",
    addonsTitle: "Sie brauchen mehr als Ihren Tarif?",
    addonsBody: "Entdecken Sie optionale Leistungen, ohne Ihr Abo zu verkomplizieren.",
    creditPacks: "Credit-Pakete",
    dialogEyebrow: "Nächster Schritt",
    dialogTitle: "Weiter mit {plan}",
    switchTitle: "Zu {plan} wechseln",
    dialogBody: "Wählen Sie, wie Sie für {domain} bezahlen.",
    dialogBodyNoSite: "Wählen Sie, wie Sie bezahlen.",
    switchBody: "Sie prüfen den Wechsel für {domain} und eine mögliche Zahlung auf der Seite des Zahlungsanbieters, bevor Sie bestätigen.",
    planName: "Tarif {plan}",
    monthlySubscription: "Monatliches Abo",
    annualSubscription: "Jahresabo (12 Monate)",
  },
};
