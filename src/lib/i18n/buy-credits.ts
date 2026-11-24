import type { Locale } from "@/lib/i18n/config";

/**
 * The credit packs' page (/credits/buy; Daniel's design of 2026-11-24,
 * repget-credits-addons.html). Formal address in every language. Figures are
 * never written here: `{credits}`, `{price}`, `{n}` and `{balance}` are the
 * add-on rows' and the ledger's.
 */
export type BuyCreditsCopy = {
  title: string;
  subtitle: string;
  howLink: string;
  introTitle: string;
  introBody: string;
  benefits: [string, string, string];
  /** The packs' types, in size order: only when there are exactly three. */
  types: [string, string, string];
  descriptions: [string, string, string];
  points: [string, string, string];
  pointAdded: string;
  pointBetter: string;
  pointLowest: string;
  /** After the number, on a card: "250 credits". */
  creditsWord: string;
  save: string;
  cardOrPayPal: string;
  cardOnly: string;
  topUpLead: string;
  topUpOffer: string;
  topUpButton: string;
  trustSecure: string;
  trustBoth: string;
  trustCard: string;
  trustNever: string;
  howTitle: string;
  howHelp: string;
  steps: { title: string; body: string }[];
  /** The balance beside the title. */
  balance: string;
  dialogTitle: string;
  dialogBody: string;
  orderHelp: string;
  noPacks: string;
  billingLink: string;
};

/** The payment choice, shared by the credit packs' and the plans' dialogs. */
export type PaymentChoiceCopy = {
  label: string;
  card: string;
  cardHelp: string;
  paypalHelp: string;
  continueCard: string;
  continuePayPal: string;
  note: string;
  close: string;
};

export const BUY_CREDITS_COPY: Record<Locale, BuyCreditsCopy> = {
  en: {
    title: "Buy credits",
    subtitle: "Get more done, whenever you need to.",
    howLink: "How do credits work?",
    introTitle: "Extra credits, whenever you need them.",
    introBody: "Top up your balance with a one-time purchase. No recurring charges. Purchased credits never expire.",
    benefits: ["One-time purchase", "Credits never expire", "No subscription changes"],
    types: ["Starter", "Growth", "Scale"],
    descriptions: ["A little extra room when you need it.", "More flexibility for regular projects.", "More room for larger workloads."],
    points: ["Ideal for occasional top-ups", "Great for consistent creation", "Designed for higher volume"],
    pointAdded: "Added to your credit balance",
    pointBetter: "Better value per credit",
    pointLowest: "Lowest price per credit",
    creditsWord: "credits",
    save: "Save {n}%",
    cardOrPayPal: "Card or PayPal at checkout",
    cardOnly: "Card at checkout",
    topUpLead: "Need a smaller top-up?",
    topUpOffer: "{credits} credits for {price}.",
    topUpButton: "Get {credits} credits",
    trustSecure: "Secure checkout",
    trustBoth: "Card & PayPal",
    trustCard: "Card payments",
    trustNever: "Credits never expire",
    howTitle: "How do add-on credits work?",
    howHelp: "Everything you need to know before purchasing.",
    steps: [
      { title: "Choose your package", body: "Buy extra credits whenever you need more, without changing your plan." },
      { title: "Top up your balance", body: "Your purchased credits are added after successful payment and do not expire." },
      { title: "Use them when you need them", body: "Credit costs vary by feature. Every paid action shows its price before you confirm." },
    ],
    balance: "Your balance: {balance}",
    dialogTitle: "Complete your top-up",
    dialogBody: "One-time payment. Your purchased credits will never expire.",
    orderHelp: "One-time purchase · No recurring charges",
    noPacks: "No credit packs are on sale right now.",
    billingLink: "Plans and billing",
  },
  es: {
    title: "Comprar créditos",
    subtitle: "Haga más, siempre que lo necesite.",
    howLink: "¿Cómo funcionan los créditos?",
    introTitle: "Créditos extra, cuando los necesite.",
    introBody: "Recargue su saldo con una compra única. Sin cargos recurrentes. Los créditos comprados no caducan.",
    benefits: ["Compra única", "Los créditos no caducan", "Sin cambios en su suscripción"],
    types: ["Starter", "Growth", "Scale"],
    descriptions: ["Un poco más de margen cuando lo necesite.", "Más flexibilidad para proyectos habituales.", "Más margen para cargas de trabajo mayores."],
    points: ["Ideal para recargas puntuales", "Perfecto para crear con constancia", "Pensado para un mayor volumen"],
    pointAdded: "Se añaden a su saldo de créditos",
    pointBetter: "Mejor precio por crédito",
    pointLowest: "El precio más bajo por crédito",
    creditsWord: "créditos",
    save: "Ahorre un {n} %",
    cardOrPayPal: "Tarjeta o PayPal al pagar",
    cardOnly: "Tarjeta al pagar",
    topUpLead: "¿Necesita una recarga más pequeña?",
    topUpOffer: "{credits} créditos por {price}.",
    topUpButton: "Obtener {credits} créditos",
    trustSecure: "Pago seguro",
    trustBoth: "Tarjeta y PayPal",
    trustCard: "Pago con tarjeta",
    trustNever: "Los créditos no caducan",
    howTitle: "¿Cómo funcionan los créditos adicionales?",
    howHelp: "Todo lo que debe saber antes de comprar.",
    steps: [
      { title: "Elija su paquete", body: "Compre créditos extra siempre que necesite más, sin cambiar de plan." },
      { title: "Recargue su saldo", body: "Los créditos comprados se añaden cuando el pago se completa y no caducan." },
      { title: "Úselos cuando los necesite", body: "El coste en créditos varía según la función. Cada acción de pago muestra su precio antes de confirmar." },
    ],
    balance: "Su saldo: {balance}",
    dialogTitle: "Complete su recarga",
    dialogBody: "Pago único. Los créditos comprados no caducan nunca.",
    orderHelp: "Compra única · Sin cargos recurrentes",
    noPacks: "Ahora mismo no hay paquetes de créditos a la venta.",
    billingLink: "Planes y facturación",
  },
  fr: {
    title: "Acheter des crédits",
    subtitle: "Faites-en plus, dès que vous en avez besoin.",
    howLink: "Comment fonctionnent les crédits ?",
    introTitle: "Des crédits supplémentaires, quand vous en avez besoin.",
    introBody: "Rechargez votre solde par un achat unique. Aucun prélèvement récurrent. Les crédits achetés n’expirent jamais.",
    benefits: ["Achat unique", "Les crédits n’expirent jamais", "Aucun changement d’abonnement"],
    types: ["Starter", "Growth", "Scale"],
    descriptions: ["Un peu plus de marge quand il le faut.", "Plus de souplesse pour vos projets réguliers.", "Plus de marge pour les gros volumes."],
    points: ["Idéal pour une recharge ponctuelle", "Parfait pour créer régulièrement", "Conçu pour un volume plus élevé"],
    pointAdded: "Ajoutés à votre solde de crédits",
    pointBetter: "Meilleur prix par crédit",
    pointLowest: "Le prix par crédit le plus bas",
    creditsWord: "crédits",
    save: "Économisez {n} %",
    cardOrPayPal: "Carte ou PayPal au paiement",
    cardOnly: "Carte au paiement",
    topUpLead: "Besoin d’une plus petite recharge ?",
    topUpOffer: "{credits} crédits pour {price}.",
    topUpButton: "Obtenir {credits} crédits",
    trustSecure: "Paiement sécurisé",
    trustBoth: "Carte et PayPal",
    trustCard: "Paiement par carte",
    trustNever: "Les crédits n’expirent jamais",
    howTitle: "Comment fonctionnent les crédits supplémentaires ?",
    howHelp: "Tout ce qu’il faut savoir avant d’acheter.",
    steps: [
      { title: "Choisissez votre pack", body: "Achetez des crédits dès qu’il vous en faut davantage, sans changer de forfait." },
      { title: "Rechargez votre solde", body: "Les crédits achetés sont ajoutés une fois le paiement réussi et n’expirent pas." },
      { title: "Utilisez-les quand vous voulez", body: "Le coût en crédits varie selon la fonction. Chaque action payante affiche son prix avant votre confirmation." },
    ],
    balance: "Votre solde : {balance}",
    dialogTitle: "Finalisez votre recharge",
    dialogBody: "Paiement unique. Vos crédits achetés n’expireront jamais.",
    orderHelp: "Achat unique · Aucun prélèvement récurrent",
    noPacks: "Aucun pack de crédits n’est en vente pour le moment.",
    billingLink: "Forfaits et facturation",
  },
  it: {
    title: "Acquista crediti",
    subtitle: "Faccia di più, ogni volta che Le serve.",
    howLink: "Come funzionano i crediti?",
    introTitle: "Crediti extra, quando Le servono.",
    introBody: "Ricarichi il saldo con un acquisto unico. Nessun addebito ricorrente. I crediti acquistati non scadono mai.",
    benefits: ["Acquisto unico", "I crediti non scadono mai", "Nessuna modifica all’abbonamento"],
    types: ["Starter", "Growth", "Scale"],
    descriptions: ["Un po’ di margine in più quando serve.", "Più flessibilità per i progetti abituali.", "Più margine per carichi di lavoro maggiori."],
    points: ["Ideale per ricariche occasionali", "Ottimo per creare con costanza", "Pensato per volumi più alti"],
    pointAdded: "Aggiunti al Suo saldo crediti",
    pointBetter: "Prezzo per credito più conveniente",
    pointLowest: "Il prezzo per credito più basso",
    creditsWord: "crediti",
    save: "Risparmi il {n}%",
    cardOrPayPal: "Carta o PayPal al pagamento",
    cardOnly: "Carta al pagamento",
    topUpLead: "Le serve una ricarica più piccola?",
    topUpOffer: "{credits} crediti a {price}.",
    topUpButton: "Ottenga {credits} crediti",
    trustSecure: "Pagamento sicuro",
    trustBoth: "Carta e PayPal",
    trustCard: "Pagamento con carta",
    trustNever: "I crediti non scadono mai",
    howTitle: "Come funzionano i crediti aggiuntivi?",
    howHelp: "Tutto ciò che c’è da sapere prima dell’acquisto.",
    steps: [
      { title: "Scelga il pacchetto", body: "Acquisti crediti extra ogni volta che Le servono, senza cambiare piano." },
      { title: "Ricarichi il saldo", body: "I crediti acquistati vengono aggiunti a pagamento riuscito e non scadono." },
      { title: "Li usi quando Le servono", body: "Il costo in crediti varia secondo la funzione. Ogni azione a pagamento mostra il prezzo prima della conferma." },
    ],
    balance: "Il Suo saldo: {balance}",
    dialogTitle: "Completi la ricarica",
    dialogBody: "Pagamento unico. I crediti acquistati non scadranno mai.",
    orderHelp: "Acquisto unico · Nessun addebito ricorrente",
    noPacks: "Al momento non ci sono pacchetti di crediti in vendita.",
    billingLink: "Piani e fatturazione",
  },
  de: {
    title: "Credits kaufen",
    subtitle: "Erreichen Sie mehr, wann immer Sie es brauchen.",
    howLink: "Wie funktionieren Credits?",
    introTitle: "Zusätzliche Credits, wann immer Sie sie brauchen.",
    introBody: "Laden Sie Ihr Guthaben mit einem einmaligen Kauf auf. Keine wiederkehrenden Kosten. Gekaufte Credits verfallen nie.",
    benefits: ["Einmaliger Kauf", "Credits verfallen nie", "Keine Änderung am Abo"],
    types: ["Starter", "Growth", "Scale"],
    descriptions: ["Etwas mehr Spielraum, wenn Sie ihn brauchen.", "Mehr Flexibilität für regelmäßige Projekte.", "Mehr Spielraum für größere Mengen."],
    points: ["Ideal für gelegentliches Aufladen", "Passend für regelmäßige Inhalte", "Für höhere Mengen gedacht"],
    pointAdded: "Wird Ihrem Credit-Guthaben hinzugefügt",
    pointBetter: "Günstigerer Preis pro Credit",
    pointLowest: "Niedrigster Preis pro Credit",
    creditsWord: "Credits",
    save: "{n} % sparen",
    cardOrPayPal: "Karte oder PayPal beim Bezahlen",
    cardOnly: "Karte beim Bezahlen",
    topUpLead: "Sie brauchen weniger?",
    topUpOffer: "{credits} Credits für {price}.",
    topUpButton: "{credits} Credits holen",
    trustSecure: "Sichere Zahlung",
    trustBoth: "Karte und PayPal",
    trustCard: "Kartenzahlung",
    trustNever: "Credits verfallen nie",
    howTitle: "Wie funktionieren zusätzliche Credits?",
    howHelp: "Alles, was Sie vor dem Kauf wissen sollten.",
    steps: [
      { title: "Paket auswählen", body: "Kaufen Sie zusätzliche Credits, wann immer Sie mehr brauchen, ohne Ihren Tarif zu ändern." },
      { title: "Guthaben aufladen", body: "Ihre gekauften Credits werden nach erfolgreicher Zahlung gutgeschrieben und verfallen nicht." },
      { title: "Nutzen, wenn Sie sie brauchen", body: "Die Kosten in Credits hängen von der Funktion ab. Jede kostenpflichtige Aktion zeigt ihren Preis, bevor Sie bestätigen." },
    ],
    balance: "Ihr Guthaben: {balance}",
    dialogTitle: "Aufladung abschließen",
    dialogBody: "Einmalige Zahlung. Ihre gekauften Credits verfallen nie.",
    orderHelp: "Einmaliger Kauf · Keine wiederkehrenden Kosten",
    noPacks: "Zurzeit sind keine Credit-Pakete im Verkauf.",
    billingLink: "Tarife und Abrechnung",
  },
};

export const PAYMENT_CHOICE_COPY: Record<Locale, PaymentChoiceCopy> = {
  en: {
    label: "Choose a payment method",
    card: "Credit or debit card",
    cardHelp: "Secure card checkout",
    paypalHelp: "Pay using your PayPal account",
    continueCard: "Continue with card",
    continuePayPal: "Continue with PayPal",
    note: "Payment is completed on the payment provider's secure page.",
    close: "Close",
  },
  es: {
    label: "Elija un método de pago",
    card: "Tarjeta de crédito o débito",
    cardHelp: "Pago seguro con tarjeta",
    paypalHelp: "Pague con su cuenta de PayPal",
    continueCard: "Continuar con tarjeta",
    continuePayPal: "Continuar con PayPal",
    note: "El pago se completa en la página segura del proveedor de pago.",
    close: "Cerrar",
  },
  fr: {
    label: "Choisissez un moyen de paiement",
    card: "Carte de crédit ou de débit",
    cardHelp: "Paiement sécurisé par carte",
    paypalHelp: "Payez avec votre compte PayPal",
    continueCard: "Continuer par carte",
    continuePayPal: "Continuer avec PayPal",
    note: "Le paiement se termine sur la page sécurisée du prestataire de paiement.",
    close: "Fermer",
  },
  it: {
    label: "Scelga un metodo di pagamento",
    card: "Carta di credito o debito",
    cardHelp: "Pagamento sicuro con carta",
    paypalHelp: "Paghi con il Suo conto PayPal",
    continueCard: "Continua con la carta",
    continuePayPal: "Continua con PayPal",
    note: "Il pagamento si completa sulla pagina sicura del fornitore di pagamento.",
    close: "Chiudi",
  },
  de: {
    label: "Zahlungsmethode wählen",
    card: "Kredit- oder Debitkarte",
    cardHelp: "Sichere Kartenzahlung",
    paypalHelp: "Mit Ihrem PayPal-Konto bezahlen",
    continueCard: "Weiter mit Karte",
    continuePayPal: "Weiter mit PayPal",
    note: "Die Zahlung wird auf der sicheren Seite des Zahlungsanbieters abgeschlossen.",
    close: "Schließen",
  },
};
