import type { Locale } from "@/lib/i18n/config";

import type { PayoutStep } from "../application/queries/payout-status";

/**
 * "How and when you are paid" (application/queries/payout-status.ts), and the
 * few words elsewhere in the portal that depend on how partners are paid now.
 * Beside copy.ts, as credits-copy.ts and paypal-copy.ts are. Formal register.
 * Figures are placeholders ({days}, {amount}, {date}) filled from the policy.
 */
export type PayoutStatusCopy = {
  title: string;
  /** Under the status: what is needed, and when the money comes. */
  factsTitle: string;
  paused: string;
  steps: Record<PayoutStep, { title: string; body: string; action: string | null }>;
  facts: {
    creditsWhen: string;
    cashWhen: string;
    minimum: string;
    nextRun: string;
    bankDelay: string;
    payPalDelay: string;
    other: string;
  };
  contact: string;
  /** Under the application form. */
  countryMissing: string;
  /** The overview's "Paid" figure, by how it was paid. */
  paidDefinition: { credits: string; cash: string };
  /** The payouts page. */
  payouts: { introCredits: string; introCash: string; sent: string; received: string; viaPayPal: string; viaCredits: string };
  /** /partners metadata and the address check while partners are paid in credits. */
  creditsMetaDescription: string;
  creditsVerifyBody: string;
  /** Stripe refused to make an account (its own rules for the country or the platform). */
  setupRefused: string;
};

export const PAYOUT_STATUS_COPY: Record<Locale, PayoutStatusCopy> = {
  en: {
    title: "How and when you are paid",
    factsTitle: "What to know",
    paused: "Payouts have not started yet. Your commissions are recorded and kept for you; completing your setup now means nothing holds up your first payout.",
    steps: {
      credits_ready: { title: "You are set to receive RepGet credits", body: "Your commissions are added to the workspace you chose. Cash payouts are not available yet.", action: "Change the workspace" },
      credits_choose: { title: "Choose a workspace to be paid", body: "Commissions are currently paid as RepGet credits. They wait until you choose which of your workspaces receives them.", action: "Choose a workspace" },
      credits_no_workspace: { title: "You need a workspace to be paid", body: "Commissions are currently paid as RepGet credits, added to a workspace you own. Create one in RepGet, then choose it in Settings. Your commissions wait until then.", action: "Open settings" },
      stripe_not_started: { title: "Set up payouts to be paid", body: "Stripe asks for your identity and bank details. You can earn before this, but nothing is paid until it is done.", action: "Set up payouts" },
      stripe_setup_required: { title: "Finish your Stripe setup to be paid", body: "Stripe still needs some details. Nothing is paid until they are provided.", action: "Continue the setup" },
      stripe_verification_pending: { title: "Stripe is checking your details", body: "Nothing to do for now. It usually takes a few minutes, sometimes a few days.", action: null },
      stripe_restricted: { title: "Stripe needs more information", body: "Payouts to you are paused until the missing details are provided.", action: "See what is missing" },
      stripe_ready: { title: "You are ready to be paid to your bank", body: "Payouts are sent automatically through Stripe.", action: null },
      paypal_confirm: { title: "Confirm your PayPal address to be paid", body: "We send a code to the address, so a payout can only go to an account you control.", action: "Confirm your address" },
      paypal_ready: { title: "You are ready to be paid with PayPal", body: "Payouts are sent to the PayPal address you confirmed.", action: null },
      paypal_off: { title: "PayPal payouts are not available right now", body: "Your commissions are kept. Choose a bank payout in Settings if it is offered to you, or contact us.", action: "Open settings" },
      country: { title: "Payouts are not available in your country yet", body: "Your commissions are still recorded and kept for you. If your payout country is wrong, contact us to change it.", action: null },
      unavailable: { title: "Payouts are not available yet", body: "Your commissions are recorded and kept for you. There is nothing to set up for now.", action: null },
    },
    facts: {
      creditsWhen: "Each commission becomes credits {days} days after the customer's payment, with no minimum.",
      cashWhen: "Payouts run on the first day of each month (UTC). A commission can be paid once it is {days} days old.",
      minimum: "The minimum payout is {amount}. A smaller balance is kept and carried over to the next month.",
      nextRun: "Next payout run: {date}.",
      bankDelay: "Stripe then needs a few days to reach your bank. If your account is not in euros, Stripe converts the amount.",
      payPalDelay: "PayPal tells you when the money arrives.",
      other: "Refunds and chargebacks are deducted, including after a payout.",
    },
    contact: "Contact us",
    countryMissing: "Is your country not in the list? We cannot pay partners there yet. Contact us and tell us about your audience.",
    paidDefinition: { credits: "Paid to you as RepGet credits.", cash: "Sent to you." },
    payouts: {
      introCredits: "Your commissions are currently paid as RepGet credits. Each payment to you is listed here.",
      introCash: "Each payout is listed here, with each step it has completed.",
      sent: "Sent",
      received: "Received",
      viaPayPal: "PayPal account",
      viaCredits: "RepGet credits",
    },
    creditsMetaDescription: "Join the RepGet Affiliate Program: share your link and earn a recurring commission on what your referrals pay, currently paid as RepGet credits.",
    creditsVerifyBody: "Your commissions depend on this address, so we need to know it is yours. We will send a six-digit code.",
    setupRefused: "Stripe cannot open a payout account with these details at the moment. Your commissions are kept; contact us and we will find a way to pay you.",
  },
  es: {
    title: "Cómo y cuándo se le paga",
    factsTitle: "Qué debe saber",
    paused: "Los pagos aún no han comenzado. Sus comisiones se registran y se conservan; si completa ahora la configuración, nada retrasará su primer pago.",
    steps: {
      credits_ready: { title: "Todo listo para recibir créditos de RepGet", body: "Sus comisiones se añaden al espacio de trabajo que eligió. Los pagos en dinero aún no están disponibles.", action: "Cambiar el espacio de trabajo" },
      credits_choose: { title: "Elija un espacio de trabajo para cobrar", body: "Por ahora, las comisiones se pagan en créditos de RepGet. Esperan hasta que elija cuál de sus espacios de trabajo los recibe.", action: "Elegir un espacio de trabajo" },
      credits_no_workspace: { title: "Necesita un espacio de trabajo para cobrar", body: "Por ahora, las comisiones se pagan en créditos de RepGet, en un espacio de trabajo de su propiedad. Cree uno en RepGet y elíjalo en Ajustes. Sus comisiones esperan hasta entonces.", action: "Abrir ajustes" },
      stripe_not_started: { title: "Configure los pagos para cobrar", body: "Stripe le pide su identidad y sus datos bancarios. Puede ganar comisiones antes, pero no se paga nada hasta completarlo.", action: "Configurar los pagos" },
      stripe_setup_required: { title: "Termine la configuración de Stripe para cobrar", body: "Stripe todavía necesita algunos datos. No se paga nada hasta que los facilite.", action: "Continuar la configuración" },
      stripe_verification_pending: { title: "Stripe está comprobando sus datos", body: "No tiene que hacer nada por ahora. Suele tardar unos minutos, a veces unos días.", action: null },
      stripe_restricted: { title: "Stripe necesita más información", body: "Sus pagos están en pausa hasta que facilite los datos que faltan.", action: "Ver qué falta" },
      stripe_ready: { title: "Todo listo para cobrar en su banco", body: "Los pagos se envían automáticamente a través de Stripe.", action: null },
      paypal_confirm: { title: "Confirme su dirección de PayPal para cobrar", body: "Enviamos un código a esa dirección, para que el pago solo pueda llegar a una cuenta que usted controla.", action: "Confirmar la dirección" },
      paypal_ready: { title: "Todo listo para cobrar con PayPal", body: "Los pagos se envían a la dirección de PayPal que confirmó.", action: null },
      paypal_off: { title: "Los pagos por PayPal no están disponibles ahora", body: "Sus comisiones se conservan. Elija el pago bancario en Ajustes si se le ofrece, o contáctenos.", action: "Abrir ajustes" },
      country: { title: "Los pagos aún no están disponibles en su país", body: "Sus comisiones se siguen registrando y se conservan. Si su país de cobro no es correcto, contáctenos para cambiarlo.", action: null },
      unavailable: { title: "Los pagos aún no están disponibles", body: "Sus comisiones se registran y se conservan. Por ahora no hay nada que configurar.", action: null },
    },
    facts: {
      creditsWhen: "Cada comisión se convierte en créditos {days} días después del pago del cliente, sin mínimo.",
      cashWhen: "Los pagos se realizan el primer día de cada mes (UTC). Una comisión se puede pagar cuando tiene {days} días.",
      minimum: "El pago mínimo es de {amount}. Un saldo menor se conserva y pasa al mes siguiente.",
      nextRun: "Próxima ronda de pagos: {date}.",
      bankDelay: "Después, Stripe necesita unos días para llegar a su banco. Si su cuenta no está en euros, Stripe convierte el importe.",
      payPalDelay: "PayPal le avisa cuando llega el dinero.",
      other: "Los reembolsos y las devoluciones de cargo se descuentan, también después de un pago.",
    },
    contact: "Contáctenos",
    countryMissing: "¿Su país no está en la lista? Aún no podemos pagar a socios allí. Contáctenos y cuéntenos sobre su audiencia.",
    paidDefinition: { credits: "Pagado a usted en créditos de RepGet.", cash: "Enviado a usted." },
    payouts: {
      introCredits: "Por ahora, sus comisiones se pagan en créditos de RepGet. Aquí se muestra cada pago.",
      introCash: "Aquí se muestra cada pago, con los pasos que ha completado.",
      sent: "Enviado",
      received: "Recibido",
      viaPayPal: "Cuenta de PayPal",
      viaCredits: "Créditos de RepGet",
    },
    creditsMetaDescription: "Únase al programa de afiliados de RepGet: comparta su enlace y gane una comisión recurrente sobre los pagos de sus referidos, por ahora en créditos.",
    creditsVerifyBody: "Sus comisiones dependen de esta dirección, por lo que necesitamos saber que es suya. Le enviaremos un código de seis dígitos.",
    setupRefused: "Stripe no puede abrir ahora una cuenta de pagos con estos datos. Sus comisiones se conservan; contáctenos y buscaremos la forma de pagarle.",
  },
  fr: {
    title: "Comment et quand vous êtes payé",
    factsTitle: "À savoir",
    paused: "Les versements n'ont pas encore commencé. Vos commissions sont enregistrées et conservées ; en terminant la configuration maintenant, rien ne retardera votre premier versement.",
    steps: {
      credits_ready: { title: "Tout est prêt pour recevoir des crédits RepGet", body: "Vos commissions sont ajoutées à l'espace de travail choisi. Les versements en argent ne sont pas encore disponibles.", action: "Changer d'espace de travail" },
      credits_choose: { title: "Choisissez un espace de travail pour être payé", body: "Les commissions sont actuellement payées en crédits RepGet. Elles attendent que vous choisissiez lequel de vos espaces de travail les reçoit.", action: "Choisir un espace de travail" },
      credits_no_workspace: { title: "Il vous faut un espace de travail pour être payé", body: "Les commissions sont actuellement payées en crédits RepGet, dans un espace de travail qui vous appartient. Créez-en un dans RepGet, puis choisissez-le dans les paramètres. Vos commissions attendent jusque-là.", action: "Ouvrir les paramètres" },
      stripe_not_started: { title: "Configurez les versements pour être payé", body: "Stripe demande votre identité et vos coordonnées bancaires. Vous pouvez gagner des commissions avant, mais rien n'est versé tant que ce n'est pas fait.", action: "Configurer les versements" },
      stripe_setup_required: { title: "Terminez la configuration Stripe pour être payé", body: "Stripe a encore besoin de quelques informations. Rien n'est versé tant qu'elles manquent.", action: "Continuer la configuration" },
      stripe_verification_pending: { title: "Stripe vérifie vos informations", body: "Rien à faire pour l'instant. Cela prend en général quelques minutes, parfois quelques jours.", action: null },
      stripe_restricted: { title: "Stripe a besoin d'informations supplémentaires", body: "Vos versements sont suspendus tant que les informations manquent.", action: "Voir ce qui manque" },
      stripe_ready: { title: "Tout est prêt pour être payé sur votre compte bancaire", body: "Les versements sont envoyés automatiquement par Stripe.", action: null },
      paypal_confirm: { title: "Confirmez votre adresse PayPal pour être payé", body: "Nous envoyons un code à cette adresse, afin qu'un versement n'arrive que sur un compte que vous contrôlez.", action: "Confirmer l'adresse" },
      paypal_ready: { title: "Tout est prêt pour être payé avec PayPal", body: "Les versements sont envoyés à l'adresse PayPal que vous avez confirmée.", action: null },
      paypal_off: { title: "Les versements PayPal ne sont pas disponibles pour le moment", body: "Vos commissions sont conservées. Choisissez le versement bancaire dans les paramètres s'il vous est proposé, ou contactez-nous.", action: "Ouvrir les paramètres" },
      country: { title: "Les versements ne sont pas encore disponibles dans votre pays", body: "Vos commissions restent enregistrées et conservées. Si votre pays de versement est inexact, contactez-nous pour le modifier.", action: null },
      unavailable: { title: "Les versements ne sont pas encore disponibles", body: "Vos commissions sont enregistrées et conservées. Il n'y a rien à configurer pour l'instant.", action: null },
    },
    facts: {
      creditsWhen: "Chaque commission devient des crédits {days} jours après le paiement du client, sans minimum.",
      cashWhen: "Les versements ont lieu le premier jour de chaque mois (UTC). Une commission peut être versée dès qu'elle a {days} jours.",
      minimum: "Le versement minimum est de {amount}. Un solde inférieur est conservé et reporté au mois suivant.",
      nextRun: "Prochains versements : {date}.",
      bankDelay: "Stripe met ensuite quelques jours pour atteindre votre banque. Si votre compte n'est pas en euros, Stripe convertit le montant.",
      payPalDelay: "PayPal vous prévient quand l'argent arrive.",
      other: "Les remboursements et les rétrofacturations sont déduits, même après un versement.",
    },
    contact: "Contactez-nous",
    countryMissing: "Votre pays n'est pas dans la liste ? Nous ne pouvons pas encore y payer de partenaires. Contactez-nous et parlez-nous de votre audience.",
    paidDefinition: { credits: "Payé en crédits RepGet.", cash: "Envoyé à vous." },
    payouts: {
      introCredits: "Vos commissions sont actuellement payées en crédits RepGet. Chaque paiement apparaît ici.",
      introCash: "Chaque versement apparaît ici, avec les étapes déjà terminées.",
      sent: "Envoyé",
      received: "Reçu",
      viaPayPal: "Compte PayPal",
      viaCredits: "Crédits RepGet",
    },
    creditsMetaDescription: "Rejoignez le programme d'affiliation RepGet : partagez votre lien et touchez une commission récurrente, payée pour l'instant en crédits RepGet.",
    creditsVerifyBody: "Vos commissions dépendent de cette adresse : nous devons savoir qu'elle est bien la vôtre. Nous allons vous envoyer un code à six chiffres.",
    setupRefused: "Stripe ne peut pas ouvrir de compte de versement avec ces informations pour le moment. Vos commissions sont conservées ; contactez-nous et nous trouverons comment vous payer.",
  },
  it: {
    title: "Come e quando viene pagato",
    factsTitle: "Cosa sapere",
    paused: "I pagamenti non sono ancora iniziati. Le sue commissioni sono registrate e conservate; se completa ora la configurazione, nulla ritarderà il primo pagamento.",
    steps: {
      credits_ready: { title: "Tutto pronto per ricevere crediti RepGet", body: "Le sue commissioni vengono aggiunte allo spazio di lavoro scelto. I pagamenti in denaro non sono ancora disponibili.", action: "Cambia spazio di lavoro" },
      credits_choose: { title: "Scelga uno spazio di lavoro per essere pagato", body: "Al momento le commissioni sono pagate in crediti RepGet. Restano in attesa finché non sceglie quale dei suoi spazi di lavoro li riceve.", action: "Scegli uno spazio di lavoro" },
      credits_no_workspace: { title: "Le serve uno spazio di lavoro per essere pagato", body: "Al momento le commissioni sono pagate in crediti RepGet, in uno spazio di lavoro di sua proprietà. Ne crei uno in RepGet e lo scelga nelle impostazioni. Fino ad allora le commissioni restano in attesa.", action: "Apri le impostazioni" },
      stripe_not_started: { title: "Configuri i pagamenti per essere pagato", body: "Stripe chiede la sua identità e i dati bancari. Può guadagnare prima, ma nulla viene pagato finché non è completato.", action: "Configura i pagamenti" },
      stripe_setup_required: { title: "Completi la configurazione di Stripe per essere pagato", body: "A Stripe servono ancora alcuni dati. Nulla viene pagato finché non li fornisce.", action: "Continua la configurazione" },
      stripe_verification_pending: { title: "Stripe sta verificando i suoi dati", body: "Per ora non deve fare nulla. Di solito bastano pochi minuti, a volte qualche giorno.", action: null },
      stripe_restricted: { title: "Stripe ha bisogno di altre informazioni", body: "I suoi pagamenti sono sospesi finché non fornisce i dati mancanti.", action: "Vedi cosa manca" },
      stripe_ready: { title: "Tutto pronto per essere pagato in banca", body: "I pagamenti vengono inviati automaticamente tramite Stripe.", action: null },
      paypal_confirm: { title: "Confermi il suo indirizzo PayPal per essere pagato", body: "Inviamo un codice a quell'indirizzo, così il pagamento può arrivare solo a un conto che controlla lei.", action: "Conferma l'indirizzo" },
      paypal_ready: { title: "Tutto pronto per essere pagato con PayPal", body: "I pagamenti vengono inviati all'indirizzo PayPal che ha confermato.", action: null },
      paypal_off: { title: "I pagamenti PayPal non sono disponibili al momento", body: "Le sue commissioni sono conservate. Scelga il pagamento in banca nelle impostazioni, se le viene offerto, oppure ci contatti.", action: "Apri le impostazioni" },
      country: { title: "I pagamenti non sono ancora disponibili nel suo paese", body: "Le sue commissioni continuano a essere registrate e conservate. Se il paese di pagamento non è corretto, ci contatti per cambiarlo.", action: null },
      unavailable: { title: "I pagamenti non sono ancora disponibili", body: "Le sue commissioni sono registrate e conservate. Per ora non c'è nulla da configurare.", action: null },
    },
    facts: {
      creditsWhen: "Ogni commissione diventa crediti {days} giorni dopo il pagamento del cliente, senza minimo.",
      cashWhen: "I pagamenti avvengono il primo giorno di ogni mese (UTC). Una commissione può essere pagata quando ha {days} giorni.",
      minimum: "Il pagamento minimo è di {amount}. Un saldo inferiore viene conservato e riportato al mese successivo.",
      nextRun: "Prossimo ciclo di pagamenti: {date}.",
      bankDelay: "Stripe impiega poi qualche giorno per raggiungere la sua banca. Se il suo conto non è in euro, Stripe converte l'importo.",
      payPalDelay: "PayPal la avvisa quando arriva il denaro.",
      other: "Rimborsi e contestazioni vengono detratti, anche dopo un pagamento.",
    },
    contact: "Ci contatti",
    countryMissing: "Il suo paese non è nell'elenco? Non possiamo ancora pagare partner lì. Ci contatti e ci parli del suo pubblico.",
    paidDefinition: { credits: "Pagato a lei in crediti RepGet.", cash: "Inviato a lei." },
    payouts: {
      introCredits: "Al momento le sue commissioni sono pagate in crediti RepGet. Ogni pagamento è elencato qui.",
      introCash: "Ogni pagamento è elencato qui, con i passaggi già completati.",
      sent: "Inviato",
      received: "Ricevuto",
      viaPayPal: "Conto PayPal",
      viaCredits: "Crediti RepGet",
    },
    creditsMetaDescription: "Entri nel programma di affiliazione di RepGet: condivida il suo link e guadagni una commissione ricorrente, per ora pagata in crediti RepGet.",
    creditsVerifyBody: "Le sue commissioni dipendono da questo indirizzo, quindi dobbiamo sapere che è suo. Le invieremo un codice di sei cifre.",
    setupRefused: "Al momento Stripe non può aprire un conto per i pagamenti con questi dati. Le sue commissioni sono conservate; ci contatti e troveremo il modo di pagarla.",
  },
  de: {
    title: "Wie und wann Sie bezahlt werden",
    factsTitle: "Gut zu wissen",
    paused: "Die Auszahlungen haben noch nicht begonnen. Ihre Provisionen werden erfasst und für Sie aufbewahrt; wenn Sie die Einrichtung jetzt abschließen, verzögert nichts Ihre erste Auszahlung.",
    steps: {
      credits_ready: { title: "Sie erhalten RepGet-Credits", body: "Ihre Provisionen werden dem gewählten Workspace gutgeschrieben. Auszahlungen in Geld sind noch nicht verfügbar.", action: "Workspace ändern" },
      credits_choose: { title: "Wählen Sie einen Workspace, um bezahlt zu werden", body: "Provisionen werden derzeit in RepGet-Credits bezahlt. Sie warten, bis Sie wählen, welcher Ihrer Workspaces sie erhält.", action: "Workspace wählen" },
      credits_no_workspace: { title: "Sie brauchen einen Workspace, um bezahlt zu werden", body: "Provisionen werden derzeit in RepGet-Credits bezahlt, in einem Workspace, der Ihnen gehört. Legen Sie in RepGet einen an und wählen Sie ihn in den Einstellungen. Ihre Provisionen warten bis dahin.", action: "Einstellungen öffnen" },
      stripe_not_started: { title: "Richten Sie Auszahlungen ein, um bezahlt zu werden", body: "Stripe fragt Ihre Identität und Bankverbindung ab. Sie können vorher verdienen, aber ohne diesen Schritt wird nichts ausgezahlt.", action: "Auszahlungen einrichten" },
      stripe_setup_required: { title: "Schließen Sie die Stripe-Einrichtung ab, um bezahlt zu werden", body: "Stripe benötigt noch einige Angaben. Bis dahin wird nichts ausgezahlt.", action: "Einrichtung fortsetzen" },
      stripe_verification_pending: { title: "Stripe prüft Ihre Angaben", body: "Im Moment ist nichts zu tun. Das dauert meist einige Minuten, manchmal einige Tage.", action: null },
      stripe_restricted: { title: "Stripe benötigt weitere Angaben", body: "Ihre Auszahlungen sind angehalten, bis die fehlenden Angaben vorliegen.", action: "Ansehen, was fehlt" },
      stripe_ready: { title: "Sie können auf Ihr Bankkonto bezahlt werden", body: "Auszahlungen werden automatisch über Stripe gesendet.", action: null },
      paypal_confirm: { title: "Bestätigen Sie Ihre PayPal-Adresse, um bezahlt zu werden", body: "Wir senden einen Code an diese Adresse, damit eine Auszahlung nur auf ein Konto geht, das Ihnen gehört.", action: "Adresse bestätigen" },
      paypal_ready: { title: "Sie können über PayPal bezahlt werden", body: "Auszahlungen gehen an die PayPal-Adresse, die Sie bestätigt haben.", action: null },
      paypal_off: { title: "PayPal-Auszahlungen sind derzeit nicht verfügbar", body: "Ihre Provisionen bleiben erhalten. Wählen Sie in den Einstellungen die Auszahlung auf Ihr Bankkonto, wenn sie angeboten wird, oder kontaktieren Sie uns.", action: "Einstellungen öffnen" },
      country: { title: "Auszahlungen sind in Ihrem Land noch nicht verfügbar", body: "Ihre Provisionen werden weiterhin erfasst und für Sie aufbewahrt. Wenn Ihr Auszahlungsland nicht stimmt, kontaktieren Sie uns, um es zu ändern.", action: null },
      unavailable: { title: "Auszahlungen sind noch nicht verfügbar", body: "Ihre Provisionen werden erfasst und für Sie aufbewahrt. Im Moment ist nichts einzurichten.", action: null },
    },
    facts: {
      creditsWhen: "Jede Provision wird {days} Tage nach der Zahlung des Kunden zu Credits, ohne Mindestbetrag.",
      cashWhen: "Auszahlungen erfolgen am ersten Tag jedes Monats (UTC). Eine Provision kann ausgezahlt werden, sobald sie {days} Tage alt ist.",
      minimum: "Der Mindestbetrag für eine Auszahlung ist {amount}. Ein kleineres Guthaben bleibt erhalten und wird in den nächsten Monat übertragen.",
      nextRun: "Nächster Auszahlungslauf: {date}.",
      bankDelay: "Danach braucht Stripe einige Tage bis zu Ihrer Bank. Wird Ihr Konto nicht in Euro geführt, rechnet Stripe den Betrag um.",
      payPalDelay: "PayPal informiert Sie, sobald das Geld eingeht.",
      other: "Erstattungen und Rückbuchungen werden abgezogen, auch nach einer Auszahlung.",
    },
    contact: "Kontakt aufnehmen",
    countryMissing: "Ihr Land steht nicht in der Liste? Dort können wir Partner noch nicht bezahlen. Kontaktieren Sie uns und erzählen Sie uns von Ihrer Zielgruppe.",
    paidDefinition: { credits: "An Sie in RepGet-Credits bezahlt.", cash: "An Sie gesendet." },
    payouts: {
      introCredits: "Ihre Provisionen werden derzeit in RepGet-Credits bezahlt. Jede Zahlung an Sie ist hier aufgeführt.",
      introCash: "Jede Auszahlung ist hier aufgeführt, mit den bereits abgeschlossenen Schritten.",
      sent: "Gesendet",
      received: "Erhalten",
      viaPayPal: "PayPal-Konto",
      viaCredits: "RepGet-Credits",
    },
    creditsMetaDescription: "Werden Sie RepGet-Partner: Teilen Sie Ihren Link und erhalten Sie eine wiederkehrende Provision auf Zahlungen, derzeit als RepGet-Credits.",
    creditsVerifyBody: "Ihre Provisionen hängen an dieser Adresse, daher müssen wir wissen, dass sie Ihnen gehört. Wir senden Ihnen einen sechsstelligen Code.",
    setupRefused: "Stripe kann mit diesen Angaben derzeit kein Auszahlungskonto eröffnen. Ihre Provisionen bleiben erhalten; kontaktieren Sie uns, und wir finden einen Weg, Sie zu bezahlen.",
  },
};
