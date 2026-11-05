import type { Locale } from "@/lib/i18n/config";
import type { WebsiteProjectField, WebsiteProjectKind, WebsiteProjectStatus } from "@/lib/website-projects/shared";

/**
 * The signed-in screen for website projects, and what the sidebar, Billing and
 * notifications say about them. Five languages, formal address, like the rest
 * of the app. {placeholders} are filled with format() (lib/i18n/format.ts).
 *
 * "Credits" here are the ordinary wallet; nothing in this file may suggest a
 * second currency, a fixed price, a deadline or a named person.
 */
export type WebsiteProjectCopy = {
  title: string;
  subtitle: string;
  walletLabel: string;
  walletHelp: string;
  /** "{count} held for backlinks being placed" */
  walletReserved: string;
  buyCredits: string;
  options: Record<WebsiteProjectKind, { title: string; body: string; cta: string }>;
  formTitle: Record<WebsiteProjectKind, string>;
  formHelp: string;
  fields: Record<WebsiteProjectField, { label: string; hint: string }>;
  optional: string;
  submit: string;
  sending: string;
  sent: string;
  errors: Record<WebsiteProjectField, string>;
  fixFields: string;
  tooManyOpen: string;
  sendFailed: string;
  listTitle: string;
  listHelp: string;
  listEmpty: string;
  kind: Record<WebsiteProjectKind, string>;
  status: Record<WebsiteProjectStatus, { label: string; help: string }>;
  /** The four stages, in order. */
  stages: [string, string, string, string];
  stagesLabel: string;
  yourBrief: string;
  yourRequirements: string;
  currentWebsite: string;
  contactLabel: string;
  scopeTitle: string;
  priceLabel: string;
  paidLabel: string;
  deliveredTitle: string;
  declinedTitle: string;
  /** "Sent {date}" */
  sentOn: string;
  /** "Accept and pay {price}" */
  accept: string;
  confirmTitle: string;
  /** "{price} will be taken from your credits now. You have {available} available." */
  confirmBody: string;
  confirm: string;
  cancel: string;
  /** "This costs {price} and you have {available} available." */
  short: string;
  buyToPay: string;
  /** "The price was changed to {price}. Please check the quote again." */
  priceChanged: string;
  cannotPay: string;
  paid: string;
  payFailed: string;
  addSiteTitle: string;
  addSiteCta: string;
  onboardingPrompt: string;
  onboardingCta: string;
  notify: {
    requestedTitle: string;
    requestedBody: string;
    quotedTitle: string;
    /** "{credits} credits ..." */
    quotedBody: string;
    paidTitle: string;
    /** "{price} ..." */
    paidBody: string;
    fulfilledTitle: string;
    declinedTitle: string;
  };
  addons: Record<WebsiteProjectKind, { name: string; description: string }>;
};

export const WEBSITE_PROJECT_COPY: Record<Locale, WebsiteProjectCopy> = {
  en: {
    title: "Website projects",
    subtitle: "Ask our team to build a new website or redesign your current one. You see the agreed scope and the price in credits before anything is charged.",
    walletLabel: "Available credits",
    walletHelp: "Website work is paid with the same credits as everything else in RepGet. Nothing is taken until you accept a quote.",
    walletReserved: "{count} held for backlinks being placed",
    buyCredits: "Buy credits",
    options: {
      new: { title: "New website", body: "No website or domain yet? Tell us about your business and what the site should do.", cta: "Request a quote" },
      redesign: { title: "Website redesign", body: "Have a site that needs a serious upgrade? Tell us what is not working and what you want instead.", cta: "Request a quote" },
    },
    formTitle: { new: "Request a quote for a new website", redesign: "Request a quote for a redesign" },
    formHelp: "This asks for a quote and costs nothing. Our team reviews it and agrees the scope with you.",
    fields: {
      brief: { label: "Your brief", hint: "Your business, who the site is for and what it should achieve." },
      existingUrl: { label: "Current website address", hint: "The site to redesign, if there is one." },
      requirements: { label: "Requirements", hint: "Pages, languages, an online store, bookings, content you already have." },
      contactName: { label: "Your name", hint: "" },
      contactEmail: { label: "Contact email", hint: "Where our team can reach you about this project." },
      contactPhone: { label: "Phone", hint: "" },
    },
    optional: "optional",
    submit: "Send request",
    sending: "Sending...",
    sent: "Request sent. We will reply with the scope and a price.",
    errors: {
      brief: "Please describe the project in at least 20 characters.",
      existingUrl: "Enter a website address like example.com.",
      requirements: "Please shorten this to 4,000 characters.",
      contactName: "Please enter your name.",
      contactEmail: "Enter a valid email address.",
      contactPhone: "Please shorten this phone number.",
    },
    fixFields: "Please check the highlighted fields.",
    tooManyOpen: "You already have several requests waiting for a quote. Please wait for our reply to those first.",
    sendFailed: "The request could not be sent. Please try again.",
    listTitle: "Your projects",
    listHelp: "Where each request stands.",
    listEmpty: "No projects yet. Choose an option above to send your first brief.",
    kind: { new: "New website", redesign: "Website redesign" },
    status: {
      quote_requested: { label: "Quote requested", help: "Our team is reviewing your brief. Nothing has been charged and nothing has been ordered yet." },
      quoted: { label: "Quote ready", help: "Check the scope and the price. Paying in credits accepts the quote." },
      paid: { label: "Paid in credits", help: "Your order is confirmed and with our team." },
      fulfilled: { label: "Delivered", help: "This project has been delivered." },
      declined: { label: "Declined", help: "We cannot take this project on as requested. Nothing was charged." },
    },
    stages: ["Quote requested", "Quote ready", "Paid in credits", "Delivered"],
    stagesLabel: "Project progress",
    yourBrief: "Your brief",
    yourRequirements: "Requirements",
    currentWebsite: "Current website",
    contactLabel: "Contact",
    scopeTitle: "Agreed scope",
    priceLabel: "Price",
    paidLabel: "Paid",
    deliveredTitle: "Delivered",
    declinedTitle: "Reason",
    sentOn: "Sent {date}",
    accept: "Accept and pay {price}",
    confirmTitle: "Accept this quote?",
    confirmBody: "{price} will be taken from your credits now. You have {available} available.",
    confirm: "Accept and pay",
    cancel: "Cancel",
    short: "This costs {price} and you have {available} available.",
    buyToPay: "Buy credits",
    priceChanged: "The price is now {price}. Please check the quote again before paying.",
    cannotPay: "This project cannot be paid right now. Reload the page to see where it stands.",
    paid: "Paid. Your project is confirmed.",
    payFailed: "The payment could not be completed, and no credits were taken. Please try again.",
    addSiteTitle: "Already have a website you want to grow?",
    addSiteCta: "Add your website",
    onboardingPrompt: "No website yet?",
    onboardingCta: "Ask us to build one",
    notify: {
      requestedTitle: "Website quote requested",
      requestedBody: "We are reviewing your brief. Nothing has been charged.",
      quotedTitle: "Your website quote is ready",
      quotedBody: "The price is {credits} credits. Check the scope and accept it when you are ready.",
      paidTitle: "Website project paid",
      paidBody: "{price} paid. Your order is with our team.",
      fulfilledTitle: "Your website project was delivered",
      declinedTitle: "We cannot take on this website project",
    },
    addons: {
      new: { name: "New website", description: "Our team builds a website for you. Send a brief and we will agree the scope and quote a price in credits." },
      redesign: { name: "Website redesign", description: "Our team redesigns your current website. Send a brief and we will agree the scope and quote a price in credits." },
    },
  },
  es: {
    title: "Proyectos web",
    subtitle: "Pida a nuestro equipo que cree un sitio web nuevo o rediseñe el actual. Verá el alcance acordado y el precio en créditos antes de que se cobre nada.",
    walletLabel: "Créditos disponibles",
    walletHelp: "El trabajo web se paga con los mismos créditos que todo lo demás en RepGet. No se descuenta nada hasta que acepte un presupuesto.",
    walletReserved: "{count} retenidos para backlinks en curso",
    buyCredits: "Comprar créditos",
    options: {
      new: { title: "Sitio web nuevo", body: "¿Aún no tiene sitio web ni dominio? Cuéntenos sobre su negocio y qué debe hacer el sitio.", cta: "Solicitar presupuesto" },
      redesign: { title: "Rediseño web", body: "¿Su sitio necesita una mejora seria? Cuéntenos qué no funciona y qué desea en su lugar.", cta: "Solicitar presupuesto" },
    },
    formTitle: { new: "Solicitar presupuesto para un sitio web nuevo", redesign: "Solicitar presupuesto para un rediseño" },
    formHelp: "Esto solicita un presupuesto y no cuesta nada. Nuestro equipo lo revisa y acuerda el alcance con usted.",
    fields: {
      brief: { label: "Su briefing", hint: "Su negocio, a quién se dirige el sitio y qué debe conseguir." },
      existingUrl: { label: "Dirección del sitio actual", hint: "El sitio que desea rediseñar, si lo hay." },
      requirements: { label: "Requisitos", hint: "Páginas, idiomas, tienda online, reservas, contenido que ya tenga." },
      contactName: { label: "Su nombre", hint: "" },
      contactEmail: { label: "Correo de contacto", hint: "Donde nuestro equipo puede escribirle sobre este proyecto." },
      contactPhone: { label: "Teléfono", hint: "" },
    },
    optional: "opcional",
    submit: "Enviar solicitud",
    sending: "Enviando...",
    sent: "Solicitud enviada. Le responderemos con el alcance y un precio.",
    errors: {
      brief: "Describa el proyecto con al menos 20 caracteres.",
      existingUrl: "Introduzca una dirección web como ejemplo.com.",
      requirements: "Acorte este texto a 4.000 caracteres.",
      contactName: "Introduzca su nombre.",
      contactEmail: "Introduzca un correo electrónico válido.",
      contactPhone: "Acorte este número de teléfono.",
    },
    fixFields: "Revise los campos marcados.",
    tooManyOpen: "Ya tiene varias solicitudes pendientes de presupuesto. Espere primero nuestra respuesta a esas.",
    sendFailed: "No se pudo enviar la solicitud. Inténtelo de nuevo.",
    listTitle: "Sus proyectos",
    listHelp: "En qué punto está cada solicitud.",
    listEmpty: "Aún no hay proyectos. Elija una opción arriba para enviar su primer briefing.",
    kind: { new: "Sitio web nuevo", redesign: "Rediseño web" },
    status: {
      quote_requested: { label: "Presupuesto solicitado", help: "Nuestro equipo está revisando su briefing. Aún no se ha cobrado ni pedido nada." },
      quoted: { label: "Presupuesto listo", help: "Revise el alcance y el precio. Al pagar en créditos acepta el presupuesto." },
      paid: { label: "Pagado en créditos", help: "Su pedido está confirmado y en manos de nuestro equipo." },
      fulfilled: { label: "Entregado", help: "Este proyecto se ha entregado." },
      declined: { label: "Rechazado", help: "No podemos asumir este proyecto tal como se solicitó. No se ha cobrado nada." },
    },
    stages: ["Presupuesto solicitado", "Presupuesto listo", "Pagado en créditos", "Entregado"],
    stagesLabel: "Progreso del proyecto",
    yourBrief: "Su briefing",
    yourRequirements: "Requisitos",
    currentWebsite: "Sitio actual",
    contactLabel: "Contacto",
    scopeTitle: "Alcance acordado",
    priceLabel: "Precio",
    paidLabel: "Pagado",
    deliveredTitle: "Entregado",
    declinedTitle: "Motivo",
    sentOn: "Enviado el {date}",
    accept: "Aceptar y pagar {price}",
    confirmTitle: "¿Aceptar este presupuesto?",
    confirmBody: "Se descontarán {price} de sus créditos ahora. Tiene {available} disponibles.",
    confirm: "Aceptar y pagar",
    cancel: "Cancelar",
    short: "Esto cuesta {price} y tiene {available} disponibles.",
    buyToPay: "Comprar créditos",
    priceChanged: "El precio ahora es {price}. Revise de nuevo el presupuesto antes de pagar.",
    cannotPay: "Este proyecto no se puede pagar en este momento. Recargue la página para ver su estado.",
    paid: "Pagado. Su proyecto está confirmado.",
    payFailed: "No se pudo completar el pago y no se descontó ningún crédito. Inténtelo de nuevo.",
    addSiteTitle: "¿Ya tiene un sitio web que quiere hacer crecer?",
    addSiteCta: "Añadir su sitio web",
    onboardingPrompt: "¿Aún no tiene sitio web?",
    onboardingCta: "Pídanos que le creemos uno",
    notify: {
      requestedTitle: "Presupuesto web solicitado",
      requestedBody: "Estamos revisando su briefing. No se ha cobrado nada.",
      quotedTitle: "Su presupuesto web está listo",
      quotedBody: "El precio es de {credits} créditos. Revise el alcance y acéptelo cuando quiera.",
      paidTitle: "Proyecto web pagado",
      paidBody: "{price} pagados. Su pedido está en manos de nuestro equipo.",
      fulfilledTitle: "Su proyecto web se ha entregado",
      declinedTitle: "No podemos asumir este proyecto web",
    },
    addons: {
      new: { name: "Sitio web nuevo", description: "Nuestro equipo crea un sitio web para usted. Envíe un briefing y acordaremos el alcance y un precio en créditos." },
      redesign: { name: "Rediseño web", description: "Nuestro equipo rediseña su sitio actual. Envíe un briefing y acordaremos el alcance y un precio en créditos." },
    },
  },
  fr: {
    title: "Projets de site web",
    subtitle: "Demandez à notre équipe de créer un nouveau site ou de refondre le vôtre. Vous voyez le périmètre convenu et le prix en crédits avant tout débit.",
    walletLabel: "Crédits disponibles",
    walletHelp: "Le travail sur votre site se paie avec les mêmes crédits que tout le reste dans RepGet. Rien n'est débité tant que vous n'avez pas accepté un devis.",
    walletReserved: "{count} réservés pour des backlinks en cours",
    buyCredits: "Acheter des crédits",
    options: {
      new: { title: "Nouveau site web", body: "Pas encore de site ni de domaine ? Parlez-nous de votre activité et de ce que le site doit faire.", cta: "Demander un devis" },
      redesign: { title: "Refonte de site web", body: "Votre site a besoin d'une vraie remise à niveau ? Dites-nous ce qui ne fonctionne pas et ce que vous souhaitez.", cta: "Demander un devis" },
    },
    formTitle: { new: "Demander un devis pour un nouveau site", redesign: "Demander un devis pour une refonte" },
    formHelp: "Cette demande de devis est gratuite. Notre équipe l'examine et convient du périmètre avec vous.",
    fields: {
      brief: { label: "Votre brief", hint: "Votre activité, à qui s'adresse le site et ce qu'il doit accomplir." },
      existingUrl: { label: "Adresse du site actuel", hint: "Le site à refondre, s'il y en a un." },
      requirements: { label: "Exigences", hint: "Pages, langues, boutique en ligne, réservations, contenus déjà disponibles." },
      contactName: { label: "Votre nom", hint: "" },
      contactEmail: { label: "E-mail de contact", hint: "Où notre équipe peut vous joindre au sujet de ce projet." },
      contactPhone: { label: "Téléphone", hint: "" },
    },
    optional: "facultatif",
    submit: "Envoyer la demande",
    sending: "Envoi...",
    sent: "Demande envoyée. Nous vous répondrons avec le périmètre et un prix.",
    errors: {
      brief: "Décrivez le projet en au moins 20 caractères.",
      existingUrl: "Saisissez une adresse comme exemple.com.",
      requirements: "Veuillez raccourcir ce texte à 4 000 caractères.",
      contactName: "Veuillez saisir votre nom.",
      contactEmail: "Saisissez une adresse e-mail valide.",
      contactPhone: "Veuillez raccourcir ce numéro de téléphone.",
    },
    fixFields: "Veuillez vérifier les champs signalés.",
    tooManyOpen: "Plusieurs de vos demandes attendent déjà un devis. Veuillez d'abord attendre notre réponse.",
    sendFailed: "La demande n'a pas pu être envoyée. Veuillez réessayer.",
    listTitle: "Vos projets",
    listHelp: "Où en est chaque demande.",
    listEmpty: "Aucun projet pour l'instant. Choisissez une option ci-dessus pour envoyer votre premier brief.",
    kind: { new: "Nouveau site web", redesign: "Refonte de site web" },
    status: {
      quote_requested: { label: "Devis demandé", help: "Notre équipe examine votre brief. Rien n'a été débité ni commandé pour l'instant." },
      quoted: { label: "Devis prêt", help: "Vérifiez le périmètre et le prix. Payer en crédits vaut acceptation du devis." },
      paid: { label: "Payé en crédits", help: "Votre commande est confirmée et entre les mains de notre équipe." },
      fulfilled: { label: "Livré", help: "Ce projet a été livré." },
      declined: { label: "Refusé", help: "Nous ne pouvons pas prendre ce projet tel que demandé. Rien n'a été débité." },
    },
    stages: ["Devis demandé", "Devis prêt", "Payé en crédits", "Livré"],
    stagesLabel: "Avancement du projet",
    yourBrief: "Votre brief",
    yourRequirements: "Exigences",
    currentWebsite: "Site actuel",
    contactLabel: "Contact",
    scopeTitle: "Périmètre convenu",
    priceLabel: "Prix",
    paidLabel: "Payé",
    deliveredTitle: "Livré",
    declinedTitle: "Motif",
    sentOn: "Envoyé le {date}",
    accept: "Accepter et payer {price}",
    confirmTitle: "Accepter ce devis ?",
    confirmBody: "{price} seront débités de vos crédits maintenant. Vous en avez {available} disponibles.",
    confirm: "Accepter et payer",
    cancel: "Annuler",
    short: "Ce projet coûte {price} et vous en avez {available} disponibles.",
    buyToPay: "Acheter des crédits",
    priceChanged: "Le prix est maintenant de {price}. Veuillez revérifier le devis avant de payer.",
    cannotPay: "Ce projet ne peut pas être payé pour le moment. Rechargez la page pour voir où il en est.",
    paid: "Payé. Votre projet est confirmé.",
    payFailed: "Le paiement n'a pas abouti et aucun crédit n'a été débité. Veuillez réessayer.",
    addSiteTitle: "Vous avez déjà un site à développer ?",
    addSiteCta: "Ajouter votre site",
    onboardingPrompt: "Pas encore de site ?",
    onboardingCta: "Demandez-nous d'en créer un",
    notify: {
      requestedTitle: "Devis de site web demandé",
      requestedBody: "Nous examinons votre brief. Rien n'a été débité.",
      quotedTitle: "Votre devis de site web est prêt",
      quotedBody: "Le prix est de {credits} crédits. Vérifiez le périmètre et acceptez-le quand vous êtes prêt.",
      paidTitle: "Projet de site web payé",
      paidBody: "{price} payés. Votre commande est entre les mains de notre équipe.",
      fulfilledTitle: "Votre projet de site web a été livré",
      declinedTitle: "Nous ne pouvons pas prendre ce projet de site web",
    },
    addons: {
      new: { name: "Nouveau site web", description: "Notre équipe crée un site pour vous. Envoyez un brief et nous conviendrons du périmètre et d'un prix en crédits." },
      redesign: { name: "Refonte de site web", description: "Notre équipe refond votre site actuel. Envoyez un brief et nous conviendrons du périmètre et d'un prix en crédits." },
    },
  },
  it: {
    title: "Progetti web",
    subtitle: "Chieda al nostro team di creare un nuovo sito o di ridisegnare quello attuale. Vede l'ambito concordato e il prezzo in crediti prima di qualsiasi addebito.",
    walletLabel: "Crediti disponibili",
    walletHelp: "Il lavoro sul sito si paga con gli stessi crediti di tutto il resto in RepGet. Non viene scalato nulla finché non accetta un preventivo.",
    walletReserved: "{count} riservati ai backlink in corso",
    buyCredits: "Acquista crediti",
    options: {
      new: { title: "Nuovo sito web", body: "Non ha ancora un sito o un dominio? Ci parli della sua attività e di cosa deve fare il sito.", cta: "Richiedi un preventivo" },
      redesign: { title: "Redesign del sito", body: "Il suo sito ha bisogno di un vero salto di qualità? Ci dica cosa non funziona e cosa desidera.", cta: "Richiedi un preventivo" },
    },
    formTitle: { new: "Richiedi un preventivo per un nuovo sito", redesign: "Richiedi un preventivo per un redesign" },
    formHelp: "Questa richiesta di preventivo è gratuita. Il nostro team la esamina e concorda l'ambito con lei.",
    fields: {
      brief: { label: "Il suo brief", hint: "La sua attività, a chi si rivolge il sito e cosa deve ottenere." },
      existingUrl: { label: "Indirizzo del sito attuale", hint: "Il sito da ridisegnare, se esiste." },
      requirements: { label: "Requisiti", hint: "Pagine, lingue, negozio online, prenotazioni, contenuti già disponibili." },
      contactName: { label: "Il suo nome", hint: "" },
      contactEmail: { label: "Email di contatto", hint: "Dove il nostro team può contattarla per questo progetto." },
      contactPhone: { label: "Telefono", hint: "" },
    },
    optional: "facoltativo",
    submit: "Invia la richiesta",
    sending: "Invio...",
    sent: "Richiesta inviata. Le risponderemo con l'ambito e un prezzo.",
    errors: {
      brief: "Descriva il progetto in almeno 20 caratteri.",
      existingUrl: "Inserisca un indirizzo come esempio.it.",
      requirements: "Riduca questo testo a 4.000 caratteri.",
      contactName: "Inserisca il suo nome.",
      contactEmail: "Inserisca un indirizzo email valido.",
      contactPhone: "Accorci questo numero di telefono.",
    },
    fixFields: "Controlli i campi evidenziati.",
    tooManyOpen: "Ha già diverse richieste in attesa di preventivo. Attenda prima la nostra risposta.",
    sendFailed: "Non è stato possibile inviare la richiesta. Riprovi.",
    listTitle: "I suoi progetti",
    listHelp: "A che punto è ogni richiesta.",
    listEmpty: "Ancora nessun progetto. Scelga un'opzione qui sopra per inviare il suo primo brief.",
    kind: { new: "Nuovo sito web", redesign: "Redesign del sito" },
    status: {
      quote_requested: { label: "Preventivo richiesto", help: "Il nostro team sta esaminando il suo brief. Finora non è stato addebitato né ordinato nulla." },
      quoted: { label: "Preventivo pronto", help: "Controlli l'ambito e il prezzo. Pagando in crediti accetta il preventivo." },
      paid: { label: "Pagato in crediti", help: "Il suo ordine è confermato ed è nelle mani del nostro team." },
      fulfilled: { label: "Consegnato", help: "Questo progetto è stato consegnato." },
      declined: { label: "Rifiutato", help: "Non possiamo accettare questo progetto così come richiesto. Non è stato addebitato nulla." },
    },
    stages: ["Preventivo richiesto", "Preventivo pronto", "Pagato in crediti", "Consegnato"],
    stagesLabel: "Avanzamento del progetto",
    yourBrief: "Il suo brief",
    yourRequirements: "Requisiti",
    currentWebsite: "Sito attuale",
    contactLabel: "Contatto",
    scopeTitle: "Ambito concordato",
    priceLabel: "Prezzo",
    paidLabel: "Pagato",
    deliveredTitle: "Consegnato",
    declinedTitle: "Motivo",
    sentOn: "Inviato il {date}",
    accept: "Accetta e paga {price}",
    confirmTitle: "Accettare questo preventivo?",
    confirmBody: "Verranno scalati ora {price} dai suoi crediti. Ne ha {available} disponibili.",
    confirm: "Accetta e paga",
    cancel: "Annulla",
    short: "Questo costa {price} e ne ha {available} disponibili.",
    buyToPay: "Acquista crediti",
    priceChanged: "Il prezzo ora è {price}. Ricontrolli il preventivo prima di pagare.",
    cannotPay: "Questo progetto non può essere pagato ora. Ricarichi la pagina per vedere a che punto è.",
    paid: "Pagato. Il suo progetto è confermato.",
    payFailed: "Il pagamento non è andato a buon fine e non è stato scalato alcun credito. Riprovi.",
    addSiteTitle: "Ha già un sito da far crescere?",
    addSiteCta: "Aggiungi il suo sito",
    onboardingPrompt: "Non ha ancora un sito?",
    onboardingCta: "Ce lo chieda: lo creiamo noi",
    notify: {
      requestedTitle: "Preventivo per il sito richiesto",
      requestedBody: "Stiamo esaminando il suo brief. Non è stato addebitato nulla.",
      quotedTitle: "Il preventivo per il suo sito è pronto",
      quotedBody: "Il prezzo è di {credits} crediti. Controlli l'ambito e lo accetti quando è pronto.",
      paidTitle: "Progetto web pagato",
      paidBody: "{price} pagati. Il suo ordine è nelle mani del nostro team.",
      fulfilledTitle: "Il suo progetto web è stato consegnato",
      declinedTitle: "Non possiamo accettare questo progetto web",
    },
    addons: {
      new: { name: "Nuovo sito web", description: "Il nostro team crea un sito per lei. Invii un brief e concorderemo l'ambito e un prezzo in crediti." },
      redesign: { name: "Redesign del sito", description: "Il nostro team ridisegna il suo sito attuale. Invii un brief e concorderemo l'ambito e un prezzo in crediti." },
    },
  },
  de: {
    title: "Website-Projekte",
    subtitle: "Beauftragen Sie unser Team mit einer neuen Website oder einem Redesign Ihrer aktuellen. Sie sehen den vereinbarten Umfang und den Preis in Credits, bevor etwas abgebucht wird.",
    walletLabel: "Verfügbare Credits",
    walletHelp: "Website-Arbeit wird mit denselben Credits bezahlt wie alles andere in RepGet. Abgebucht wird erst, wenn Sie ein Angebot annehmen.",
    walletReserved: "{count} für laufende Backlinks reserviert",
    buyCredits: "Credits kaufen",
    options: {
      new: { title: "Neue Website", body: "Noch keine Website oder Domain? Erzählen Sie uns von Ihrem Unternehmen und was die Website leisten soll.", cta: "Angebot anfordern" },
      redesign: { title: "Website-Redesign", body: "Ihre Website braucht ein echtes Upgrade? Sagen Sie uns, was nicht funktioniert und was Sie stattdessen möchten.", cta: "Angebot anfordern" },
    },
    formTitle: { new: "Angebot für eine neue Website anfordern", redesign: "Angebot für ein Redesign anfordern" },
    formHelp: "Diese Angebotsanfrage ist kostenlos. Unser Team prüft sie und stimmt den Umfang mit Ihnen ab.",
    fields: {
      brief: { label: "Ihr Briefing", hint: "Ihr Unternehmen, für wen die Website ist und was sie erreichen soll." },
      existingUrl: { label: "Adresse der aktuellen Website", hint: "Die Website für das Redesign, falls vorhanden." },
      requirements: { label: "Anforderungen", hint: "Seiten, Sprachen, Onlineshop, Buchungen, vorhandene Inhalte." },
      contactName: { label: "Ihr Name", hint: "" },
      contactEmail: { label: "Kontakt-E-Mail", hint: "Unter der unser Team Sie zu diesem Projekt erreicht." },
      contactPhone: { label: "Telefon", hint: "" },
    },
    optional: "optional",
    submit: "Anfrage senden",
    sending: "Wird gesendet...",
    sent: "Anfrage gesendet. Wir antworten Ihnen mit Umfang und Preis.",
    errors: {
      brief: "Bitte beschreiben Sie das Projekt in mindestens 20 Zeichen.",
      existingUrl: "Geben Sie eine Adresse wie beispiel.de ein.",
      requirements: "Bitte kürzen Sie diesen Text auf 4.000 Zeichen.",
      contactName: "Bitte geben Sie Ihren Namen ein.",
      contactEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
      contactPhone: "Bitte kürzen Sie diese Telefonnummer.",
    },
    fixFields: "Bitte prüfen Sie die markierten Felder.",
    tooManyOpen: "Mehrere Ihrer Anfragen warten bereits auf ein Angebot. Bitte warten Sie zuerst auf unsere Antwort.",
    sendFailed: "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    listTitle: "Ihre Projekte",
    listHelp: "Wo jede Anfrage steht.",
    listEmpty: "Noch keine Projekte. Wählen Sie oben eine Option, um Ihr erstes Briefing zu senden.",
    kind: { new: "Neue Website", redesign: "Website-Redesign" },
    status: {
      quote_requested: { label: "Angebot angefordert", help: "Unser Team prüft Ihr Briefing. Bisher wurde nichts abgebucht und nichts bestellt." },
      quoted: { label: "Angebot bereit", help: "Prüfen Sie Umfang und Preis. Mit der Zahlung in Credits nehmen Sie das Angebot an." },
      paid: { label: "In Credits bezahlt", help: "Ihr Auftrag ist bestätigt und liegt bei unserem Team." },
      fulfilled: { label: "Geliefert", help: "Dieses Projekt wurde geliefert." },
      declined: { label: "Abgelehnt", help: "Wir können dieses Projekt so nicht übernehmen. Es wurde nichts abgebucht." },
    },
    stages: ["Angebot angefordert", "Angebot bereit", "In Credits bezahlt", "Geliefert"],
    stagesLabel: "Projektfortschritt",
    yourBrief: "Ihr Briefing",
    yourRequirements: "Anforderungen",
    currentWebsite: "Aktuelle Website",
    contactLabel: "Kontakt",
    scopeTitle: "Vereinbarter Umfang",
    priceLabel: "Preis",
    paidLabel: "Bezahlt",
    deliveredTitle: "Geliefert",
    declinedTitle: "Grund",
    sentOn: "Gesendet am {date}",
    accept: "Annehmen und {price} bezahlen",
    confirmTitle: "Dieses Angebot annehmen?",
    confirmBody: "{price} werden jetzt von Ihren Credits abgebucht. Sie haben {available} verfügbar.",
    confirm: "Annehmen und bezahlen",
    cancel: "Abbrechen",
    short: "Das kostet {price}, und Sie haben {available} verfügbar.",
    buyToPay: "Credits kaufen",
    priceChanged: "Der Preis beträgt jetzt {price}. Bitte prüfen Sie das Angebot vor dem Bezahlen erneut.",
    cannotPay: "Dieses Projekt kann gerade nicht bezahlt werden. Laden Sie die Seite neu, um den Stand zu sehen.",
    paid: "Bezahlt. Ihr Projekt ist bestätigt.",
    payFailed: "Die Zahlung konnte nicht abgeschlossen werden, und es wurden keine Credits abgebucht. Bitte versuchen Sie es erneut.",
    addSiteTitle: "Sie haben schon eine Website, die wachsen soll?",
    addSiteCta: "Website hinzufügen",
    onboardingPrompt: "Noch keine Website?",
    onboardingCta: "Lassen Sie uns eine erstellen",
    notify: {
      requestedTitle: "Website-Angebot angefordert",
      requestedBody: "Wir prüfen Ihr Briefing. Es wurde nichts abgebucht.",
      quotedTitle: "Ihr Website-Angebot ist bereit",
      quotedBody: "Der Preis beträgt {credits} Credits. Prüfen Sie den Umfang und nehmen Sie an, wenn Sie bereit sind.",
      paidTitle: "Website-Projekt bezahlt",
      paidBody: "{price} bezahlt. Ihr Auftrag liegt bei unserem Team.",
      fulfilledTitle: "Ihr Website-Projekt wurde geliefert",
      declinedTitle: "Wir können dieses Website-Projekt nicht übernehmen",
    },
    addons: {
      new: { name: "Neue Website", description: "Unser Team erstellt eine Website für Sie. Senden Sie ein Briefing, und wir vereinbaren Umfang und Preis in Credits." },
      redesign: { name: "Website-Redesign", description: "Unser Team überarbeitet Ihre aktuelle Website. Senden Sie ein Briefing, und wir vereinbaren Umfang und Preis in Credits." },
    },
  },
};
