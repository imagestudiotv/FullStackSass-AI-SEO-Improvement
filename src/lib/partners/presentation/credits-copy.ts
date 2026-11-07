import type { Locale } from "@/lib/i18n/config";

/**
 * Partner portal wording for being paid in RepGet credits (payment session;
 * owner's decision 2026-11-07). Beside copy.ts, so the public partner pages'
 * copy (another session's) is untouched. Formal register. Native read pending.
 */
export type PartnerCreditsCopy = {
  title: string;
  /** {credits} {price} */
  intro: string;
  timing: string;
  refunds: string;
  workspace: string;
  save: string;
  /** {name} */
  saved: string;
  choose: string;
  noWorkspace: string;
  history: string;
  date: string;
  commission: string;
  credits: string;
  empty: string;
  error: string;
};

export const PARTNER_CREDITS_COPY: Record<Locale, PartnerCreditsCopy> = {
  en: {
    title: "Paid in RepGet credits",
    intro: "Your commissions are paid as RepGet credits: {credits} credits for every {price} of commission, the price of the smallest credit pack.",
    timing: "Each commission becomes credits 30 days after the customer's payment, with no minimum.",
    refunds: "If a customer is refunded after you received credits for them, that amount is deducted from your next credits. Credits you already received are not taken back.",
    workspace: "Workspace that receives the credits",
    save: "Save",
    saved: "Credits go to {name}.",
    choose: "Choose a workspace to start receiving credits. Your commissions wait until you do.",
    noWorkspace: "You do not own a workspace yet. Create one, then choose it here.",
    history: "Credits received",
    date: "Date",
    commission: "Commission",
    credits: "Credits",
    empty: "No credits yet.",
    error: "That did not work. Please try again.",
  },
  es: {
    title: "Cobro en créditos de RepGet",
    intro: "Sus comisiones se pagan en créditos de RepGet: {credits} créditos por cada {price} de comisión, el precio del paquete de créditos más pequeño.",
    timing: "Cada comisión se convierte en créditos 30 días después del pago del cliente, sin mínimo.",
    refunds: "Si a un cliente se le reembolsa después de que usted recibiera créditos por él, ese importe se descuenta de sus próximos créditos. Los créditos ya recibidos no se retiran.",
    workspace: "Espacio de trabajo que recibe los créditos",
    save: "Guardar",
    saved: "Los créditos van a {name}.",
    choose: "Elija un espacio de trabajo para empezar a recibir créditos. Sus comisiones esperan hasta entonces.",
    noWorkspace: "Aún no es propietario de ningún espacio de trabajo. Cree uno y elíjalo aquí.",
    history: "Créditos recibidos",
    date: "Fecha",
    commission: "Comisión",
    credits: "Créditos",
    empty: "Aún no hay créditos.",
    error: "No ha funcionado. Inténtelo de nuevo.",
  },
  fr: {
    title: "Payé en crédits RepGet",
    intro: "Vos commissions sont payées en crédits RepGet : {credits} crédits pour chaque {price} de commission, le prix du plus petit pack de crédits.",
    timing: "Chaque commission devient des crédits 30 jours après le paiement du client, sans minimum.",
    refunds: "Si un client est remboursé après que vous avez reçu des crédits pour lui, ce montant est déduit de vos prochains crédits. Les crédits déjà reçus ne sont pas repris.",
    workspace: "Espace de travail qui reçoit les crédits",
    save: "Enregistrer",
    saved: "Les crédits vont à {name}.",
    choose: "Choisissez un espace de travail pour commencer à recevoir des crédits. Vos commissions attendent jusque-là.",
    noWorkspace: "Vous n’êtes propriétaire d’aucun espace de travail. Créez-en un, puis choisissez-le ici.",
    history: "Crédits reçus",
    date: "Date",
    commission: "Commission",
    credits: "Crédits",
    empty: "Pas encore de crédits.",
    error: "Cela n’a pas fonctionné. Veuillez réessayer.",
  },
  it: {
    title: "Pagato in crediti RepGet",
    intro: "Le sue commissioni sono pagate in crediti RepGet: {credits} crediti per ogni {price} di commissione, il prezzo del pacchetto di crediti più piccolo.",
    timing: "Ogni commissione diventa crediti 30 giorni dopo il pagamento del cliente, senza minimo.",
    refunds: "Se un cliente viene rimborsato dopo che lei ha ricevuto crediti per lui, quell’importo viene detratto dai suoi prossimi crediti. I crediti già ricevuti non vengono ripresi.",
    workspace: "Area di lavoro che riceve i crediti",
    save: "Salva",
    saved: "I crediti vanno a {name}.",
    choose: "Scelga un’area di lavoro per iniziare a ricevere crediti. Le sue commissioni attendono fino ad allora.",
    noWorkspace: "Non è ancora proprietario di un’area di lavoro. Ne crei una, poi la scelga qui.",
    history: "Crediti ricevuti",
    date: "Data",
    commission: "Commissione",
    credits: "Crediti",
    empty: "Ancora nessun credito.",
    error: "Non ha funzionato. Riprovi.",
  },
  de: {
    title: "Auszahlung in RepGet-Credits",
    intro: "Ihre Provisionen werden in RepGet-Credits ausgezahlt: {credits} Credits für je {price} Provision, der Preis des kleinsten Credit-Pakets.",
    timing: "Jede Provision wird 30 Tage nach der Zahlung des Kunden zu Credits, ohne Mindestbetrag.",
    refunds: "Wird ein Kunde erstattet, nachdem Sie Credits für ihn erhalten haben, wird dieser Betrag von Ihren nächsten Credits abgezogen. Bereits erhaltene Credits werden nicht zurückgenommen.",
    workspace: "Arbeitsbereich, der die Credits erhält",
    save: "Speichern",
    saved: "Die Credits gehen an {name}.",
    choose: "Wählen Sie einen Arbeitsbereich, um Credits zu erhalten. Ihre Provisionen warten bis dahin.",
    noWorkspace: "Sie besitzen noch keinen Arbeitsbereich. Erstellen Sie einen und wählen Sie ihn dann hier.",
    history: "Erhaltene Credits",
    date: "Datum",
    commission: "Provision",
    credits: "Credits",
    empty: "Noch keine Credits.",
    error: "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
  },
};
