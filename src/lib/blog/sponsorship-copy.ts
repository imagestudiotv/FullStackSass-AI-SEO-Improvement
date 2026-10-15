import type { Locale } from "@/lib/i18n/config";

/**
 * "Get Featured in This Article" in every language the blog has (client,
 * 2026-10-15): the button and its panel, the server's answers, what Stripe's
 * checkout page shows, and the page Stripe returns to. Formal register
 * (usted / vous / Lei / Sie), like the rest of the site.
 *
 * Pages pass the panel's words for their language to the button
 * (components/blog-sponsorship.tsx, a client component), so a reader's
 * browser gets one language, never this whole table. The price is the
 * server's (lib/blog/sponsorship.ts SPONSORSHIP_CENTS, in US dollars;
 * sponsorship.test.ts keeps them equal): shown as "$99" in English and
 * "99 USD" elsewhere, where a bare "$" could be read as another dollar.
 */

export type SponsorshipPanelCopy = {
  trigger: string;
  eyebrow: string;
  title: string;
  intro: string;
  cancelled: string;
  oneTime: string;
  price: string;
  noSubscription: string;
  perArticle: string;
  /** "{price}" is the price. */
  start: string;
  approval: string;
  detailsTitle: string;
  back: string;
  email: string;
  website: string;
  websitePlaceholder: string;
  message: string;
  messagePlaceholder: string;
  opening: string;
  /** "{price}" is the price. */
  continue: string;
  secure: string;
  unavailable: string;
  /** The link, then the rest of the sentence after it. */
  contactLink: string;
  contactRest: string;
  /** The browser could not reach the server. */
  network: string;
};

export type SponsorshipErrors = {
  notConfigured: string;
  invalid: string;
  website: string;
  gone: string;
  busy: string;
  tooMany: string;
  changed: string;
  alreadyPaid: string;
  expired: string;
  notOpened: string;
  failed: string;
};

export type SponsorshipThanksCopy = {
  metaTitle: string;
  paidTitle: string;
  waitingTitle: string;
  /** "{title}" is the article's title. */
  paidWithTitle: string;
  paidWithoutTitle: string;
  /** "{email}" is the buyer's email. */
  writeTo: string;
  waitingBody: string;
  doNotPayAgain: string;
  backToArticle: string;
  backToBlog: string;
  contact: string;
};

export type SponsorshipCopy = {
  panel: SponsorshipPanelCopy;
  errors: SponsorshipErrors;
  /** What Stripe's checkout page shows: the product's name and the note above the pay button. */
  stripe: { productName: string; submitMessage: string };
  thanks: SponsorshipThanksCopy;
};

export const SPONSORSHIP_COPY: Record<Locale, SponsorshipCopy> = {
  en: {
    panel: {
      trigger: "Get Featured in This Article",
      eyebrow: "Sponsored feature opportunity",
      title: "Get Your Website Featured in This Article.",
      intro:
        "Reach readers already interested in this topic. Showcase your business with a relevant sponsored mention and website link inside this article.",
      cancelled: "Payment cancelled - you were not charged. You can start again whenever you like.",
      oneTime: "One-time payment",
      price: "$99",
      noSubscription: "No subscription",
      perArticle: "Per article placement",
      start: "Get Featured for {price}",
      approval: "Subject to editorial approval",
      detailsTitle: "Tell us what to feature",
      back: "Back",
      email: "Your email",
      website: "Your website",
      websitePlaceholder: "yourwebsite.com",
      message: "What should the mention say about your business?",
      messagePlaceholder: "A sentence or two: what you offer, and who it is for.",
      opening: "Opening secure payment…",
      continue: "Continue to payment - {price}",
      secure: "Secure payment by Stripe. Subject to editorial approval.",
      unavailable: "Online payment is not available right now.",
      contactLink: "Contact us",
      contactRest: "and we will arrange your placement.",
      network: "We could not reach the server. Check your connection and try again.",
    },
    errors: {
      notConfigured: "Online payment is not available right now. Please contact us about a placement.",
      invalid: "Enter your email, your website and what you would like mentioned.",
      website: "Enter your website's address, for example yourwebsite.com.",
      gone: "This article is no longer available.",
      busy: "We are receiving a lot of requests right now. Please try again in a few minutes.",
      tooMany: "Too many requests from you in a short time. Please try again in an hour.",
      changed: "Your details changed while we were opening the payment. Please press the button again.",
      alreadyPaid: "This request is already paid. We will be in touch at the email you gave.",
      expired: "That payment page has expired. Close this box and start again.",
      notOpened: "The payment page did not open. Please try again.",
      failed: "The payment page did not open. Please try again - you will not be charged twice.",
    },
    stripe: {
      productName: "Featured placement in a RepGet article",
      submitMessage: "One-time payment for a sponsored mention and link in this article. Subject to editorial approval.",
    },
    thanks: {
      metaTitle: "Your placement request",
      paidTitle: "Thank you - your payment is confirmed",
      waitingTitle: "We are confirming your payment",
      paidWithTitle: "Your request for a sponsored mention in {title} is with our editors. Every placement is reviewed before it is published.",
      paidWithoutTitle: "Your request for a sponsored mention is with our editors. Every placement is reviewed before it is published.",
      writeTo: "We will write to {email} about your placement.",
      waitingBody:
        "We have not received confirmation of a payment for this page yet. If you have just paid, it can take a moment: refresh this page shortly.",
      doNotPayAgain: "Please do not pay again. If something looks wrong, contact us and we will check it for you.",
      backToArticle: "Back to the article",
      backToBlog: "Back to the blog",
      contact: "Contact us",
    },
  },
  es: {
    panel: {
      trigger: "Aparezca en este artículo",
      eyebrow: "Oportunidad de mención patrocinada",
      title: "Haga que su web aparezca en este artículo.",
      intro:
        "Llegue a lectores que ya se interesan por este tema. Dé a conocer su negocio con una mención patrocinada relevante y un enlace a su web dentro de este artículo.",
      cancelled: "Pago cancelado: no se le ha cobrado nada. Puede empezar de nuevo cuando quiera.",
      oneTime: "Pago único",
      price: "99 USD",
      noSubscription: "Sin suscripción",
      perArticle: "Precio por artículo",
      start: "Conseguir la mención por {price}",
      approval: "Sujeto a aprobación editorial",
      detailsTitle: "Díganos qué debemos destacar",
      back: "Atrás",
      email: "Su correo electrónico",
      website: "Su sitio web",
      websitePlaceholder: "suweb.com",
      message: "¿Qué debería decir la mención sobre su negocio?",
      messagePlaceholder: "Una o dos frases: qué ofrece y para quién es.",
      opening: "Abriendo el pago seguro…",
      continue: "Continuar al pago - {price}",
      secure: "Pago seguro con Stripe. Sujeto a aprobación editorial.",
      unavailable: "El pago en línea no está disponible en este momento.",
      contactLink: "Contáctenos",
      contactRest: "y organizaremos su mención.",
      network: "No hemos podido conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.",
    },
    errors: {
      notConfigured: "El pago en línea no está disponible en este momento. Contáctenos para organizar una mención.",
      invalid: "Indique su correo electrónico, su sitio web y lo que desea que se mencione.",
      website: "Indique la dirección de su sitio web, por ejemplo suweb.com.",
      gone: "Este artículo ya no está disponible.",
      busy: "Estamos recibiendo muchas solicitudes en este momento. Vuelva a intentarlo en unos minutos.",
      tooMany: "Ha enviado demasiadas solicitudes en poco tiempo. Vuelva a intentarlo dentro de una hora.",
      changed: "Sus datos cambiaron mientras abríamos el pago. Pulse el botón de nuevo.",
      alreadyPaid: "Esta solicitud ya está pagada. Nos pondremos en contacto con usted en el correo que nos indicó.",
      expired: "Esa página de pago ha caducado. Cierre este cuadro y empiece de nuevo.",
      notOpened: "La página de pago no se ha abierto. Inténtelo de nuevo.",
      failed: "La página de pago no se ha abierto. Inténtelo de nuevo: no se le cobrará dos veces.",
    },
    stripe: {
      productName: "Mención destacada en un artículo de RepGet",
      submitMessage: "Pago único por una mención patrocinada y un enlace en este artículo. Sujeto a aprobación editorial.",
    },
    thanks: {
      metaTitle: "Su solicitud de mención",
      paidTitle: "Gracias: su pago está confirmado",
      waitingTitle: "Estamos confirmando su pago",
      paidWithTitle:
        "Su solicitud de una mención patrocinada en {title} ya está en manos de nuestro equipo editorial. Revisamos cada mención antes de publicarla.",
      paidWithoutTitle: "Su solicitud de una mención patrocinada ya está en manos de nuestro equipo editorial. Revisamos cada mención antes de publicarla.",
      writeTo: "Le escribiremos a {email} sobre su mención.",
      waitingBody:
        "Todavía no hemos recibido la confirmación de un pago para esta página. Si acaba de pagar, puede tardar un momento: actualice esta página en breve.",
      doNotPayAgain: "No vuelva a pagar. Si algo no parece correcto, contáctenos y lo comprobaremos.",
      backToArticle: "Volver al artículo",
      backToBlog: "Volver al blog",
      contact: "Contáctenos",
    },
  },
  fr: {
    panel: {
      trigger: "Apparaissez dans cet article",
      eyebrow: "Opportunité de mention sponsorisée",
      title: "Faites figurer votre site dans cet article.",
      intro:
        "Touchez des lecteurs déjà intéressés par ce sujet. Mettez en avant votre entreprise grâce à une mention sponsorisée pertinente et un lien vers votre site dans cet article.",
      cancelled: "Paiement annulé : rien ne vous a été facturé. Vous pouvez recommencer quand vous le souhaitez.",
      oneTime: "Paiement unique",
      price: "99 USD",
      noSubscription: "Sans abonnement",
      perArticle: "Prix par article",
      start: "Obtenir la mention pour {price}",
      approval: "Sous réserve de validation éditoriale",
      detailsTitle: "Dites-nous ce qu’il faut mettre en avant",
      back: "Retour",
      email: "Votre e-mail",
      website: "Votre site web",
      websitePlaceholder: "votresite.fr",
      message: "Que doit dire la mention à propos de votre entreprise ?",
      messagePlaceholder: "Une ou deux phrases : ce que vous proposez, et à qui cela s’adresse.",
      opening: "Ouverture du paiement sécurisé…",
      continue: "Continuer vers le paiement - {price}",
      secure: "Paiement sécurisé par Stripe. Sous réserve de validation éditoriale.",
      unavailable: "Le paiement en ligne n’est pas disponible pour le moment.",
      contactLink: "Contactez-nous",
      contactRest: "et nous organiserons votre mention.",
      network: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    },
    errors: {
      notConfigured: "Le paiement en ligne n’est pas disponible pour le moment. Contactez-nous pour une mention.",
      invalid: "Indiquez votre e-mail, votre site web et ce que vous souhaitez voir mentionné.",
      website: "Indiquez l’adresse de votre site, par exemple votresite.fr.",
      gone: "Cet article n’est plus disponible.",
      busy: "Nous recevons beaucoup de demandes en ce moment. Réessayez dans quelques minutes.",
      tooMany: "Vous avez envoyé trop de demandes en peu de temps. Réessayez dans une heure.",
      changed: "Vos informations ont changé pendant l’ouverture du paiement. Appuyez à nouveau sur le bouton.",
      alreadyPaid: "Cette demande est déjà payée. Nous vous écrirons à l’adresse e-mail indiquée.",
      expired: "Cette page de paiement a expiré. Fermez cette fenêtre et recommencez.",
      notOpened: "La page de paiement ne s’est pas ouverte. Réessayez.",
      failed: "La page de paiement ne s’est pas ouverte. Réessayez : vous ne serez pas débité deux fois.",
    },
    stripe: {
      productName: "Mention mise en avant dans un article RepGet",
      submitMessage: "Paiement unique pour une mention sponsorisée et un lien dans cet article. Sous réserve de validation éditoriale.",
    },
    thanks: {
      metaTitle: "Votre demande de mention",
      paidTitle: "Merci : votre paiement est confirmé",
      waitingTitle: "Nous confirmons votre paiement",
      paidWithTitle:
        "Votre demande de mention sponsorisée dans {title} est entre les mains de notre équipe éditoriale. Chaque mention est vérifiée avant sa publication.",
      paidWithoutTitle: "Votre demande de mention sponsorisée est entre les mains de notre équipe éditoriale. Chaque mention est vérifiée avant sa publication.",
      writeTo: "Nous vous écrirons à {email} au sujet de votre mention.",
      waitingBody:
        "Nous n’avons pas encore reçu la confirmation d’un paiement pour cette page. Si vous venez de payer, cela peut prendre un moment : actualisez la page d’ici quelques instants.",
      doNotPayAgain: "Ne payez pas une seconde fois. Si quelque chose vous semble anormal, contactez-nous et nous vérifierons.",
      backToArticle: "Retour à l’article",
      backToBlog: "Retour au blog",
      contact: "Contactez-nous",
    },
  },
  it: {
    panel: {
      trigger: "Compaia in questo articolo",
      eyebrow: "Opportunità di menzione sponsorizzata",
      title: "Faccia comparire il suo sito in questo articolo.",
      intro:
        "Raggiunga lettori già interessati a questo argomento. Presenti la sua attività con una menzione sponsorizzata pertinente e un link al suo sito all’interno di questo articolo.",
      cancelled: "Pagamento annullato: non le è stato addebitato nulla. Può ricominciare quando vuole.",
      oneTime: "Pagamento unico",
      price: "99 USD",
      noSubscription: "Nessun abbonamento",
      perArticle: "Prezzo per articolo",
      start: "Ottenere la menzione per {price}",
      approval: "Soggetto ad approvazione editoriale",
      detailsTitle: "Ci dica che cosa mettere in evidenza",
      back: "Indietro",
      email: "La sua email",
      website: "Il suo sito web",
      websitePlaceholder: "ilsuosito.it",
      message: "Che cosa dovrebbe dire la menzione sulla sua attività?",
      messagePlaceholder: "Una o due frasi: che cosa offre e a chi si rivolge.",
      opening: "Apertura del pagamento sicuro…",
      continue: "Procedere al pagamento - {price}",
      secure: "Pagamento sicuro con Stripe. Soggetto ad approvazione editoriale.",
      unavailable: "Il pagamento online non è disponibile al momento.",
      contactLink: "Ci contatti",
      contactRest: "e organizzeremo la sua menzione.",
      network: "Non è stato possibile raggiungere il server. Controlli la connessione e riprovi.",
    },
    errors: {
      notConfigured: "Il pagamento online non è disponibile al momento. Ci contatti per una menzione.",
      invalid: "Indichi la sua email, il suo sito web e che cosa desidera che venga menzionato.",
      website: "Indichi l’indirizzo del suo sito, ad esempio ilsuosito.it.",
      gone: "Questo articolo non è più disponibile.",
      busy: "Stiamo ricevendo molte richieste in questo momento. Riprovi tra qualche minuto.",
      tooMany: "Ha inviato troppe richieste in poco tempo. Riprovi tra un’ora.",
      changed: "I suoi dati sono cambiati mentre aprivamo il pagamento. Prema di nuovo il pulsante.",
      alreadyPaid: "Questa richiesta è già stata pagata. La contatteremo all’indirizzo email che ci ha indicato.",
      expired: "Quella pagina di pagamento è scaduta. Chiuda questo riquadro e ricominci.",
      notOpened: "La pagina di pagamento non si è aperta. Riprovi.",
      failed: "La pagina di pagamento non si è aperta. Riprovi: non riceverà un doppio addebito.",
    },
    stripe: {
      productName: "Menzione in un articolo di RepGet",
      submitMessage: "Pagamento unico per una menzione sponsorizzata e un link in questo articolo. Soggetto ad approvazione editoriale.",
    },
    thanks: {
      metaTitle: "La sua richiesta di menzione",
      paidTitle: "Grazie: il suo pagamento è confermato",
      waitingTitle: "Stiamo confermando il suo pagamento",
      paidWithTitle:
        "La sua richiesta di una menzione sponsorizzata in {title} è ora nelle mani della nostra redazione. Ogni menzione viene verificata prima della pubblicazione.",
      paidWithoutTitle:
        "La sua richiesta di una menzione sponsorizzata è ora nelle mani della nostra redazione. Ogni menzione viene verificata prima della pubblicazione.",
      writeTo: "Le scriveremo a {email} riguardo alla sua menzione.",
      waitingBody:
        "Non abbiamo ancora ricevuto la conferma di un pagamento per questa pagina. Se ha appena pagato, può volerci un momento: aggiorni la pagina tra poco.",
      doNotPayAgain: "Non paghi di nuovo. Se qualcosa non le sembra corretto, ci contatti e verificheremo.",
      backToArticle: "Torni all’articolo",
      backToBlog: "Torni al blog",
      contact: "Ci contatti",
    },
  },
  de: {
    panel: {
      trigger: "Erscheinen Sie in diesem Artikel",
      eyebrow: "Gesponserte Erwähnung",
      title: "Lassen Sie Ihre Website in diesem Artikel erscheinen.",
      intro:
        "Erreichen Sie Leser, die sich bereits für dieses Thema interessieren. Präsentieren Sie Ihr Unternehmen mit einer passenden gesponserten Erwähnung und einem Link zu Ihrer Website in diesem Artikel.",
      cancelled: "Zahlung abgebrochen – Ihnen wurde nichts berechnet. Sie können jederzeit neu beginnen.",
      oneTime: "Einmalige Zahlung",
      price: "99 USD",
      noSubscription: "Kein Abo",
      perArticle: "Preis pro Artikel",
      start: "Erwähnung für {price} sichern",
      approval: "Vorbehaltlich redaktioneller Freigabe",
      detailsTitle: "Sagen Sie uns, was wir hervorheben sollen",
      back: "Zurück",
      email: "Ihre E-Mail-Adresse",
      website: "Ihre Website",
      websitePlaceholder: "ihre-website.de",
      message: "Was soll die Erwähnung über Ihr Unternehmen sagen?",
      messagePlaceholder: "Ein, zwei Sätze: was Sie anbieten und für wen.",
      opening: "Sichere Zahlung wird geöffnet…",
      continue: "Weiter zur Zahlung - {price}",
      secure: "Sichere Zahlung über Stripe. Vorbehaltlich redaktioneller Freigabe.",
      unavailable: "Die Online-Zahlung ist derzeit nicht verfügbar.",
      contactLink: "Kontaktieren Sie uns",
      contactRest: "und wir organisieren Ihre Erwähnung.",
      network: "Der Server war nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    },
    errors: {
      notConfigured: "Die Online-Zahlung ist derzeit nicht verfügbar. Kontaktieren Sie uns für eine Erwähnung.",
      invalid: "Geben Sie Ihre E-Mail-Adresse, Ihre Website und den gewünschten Inhalt der Erwähnung an.",
      website: "Geben Sie die Adresse Ihrer Website an, zum Beispiel ihre-website.de.",
      gone: "Dieser Artikel ist nicht mehr verfügbar.",
      busy: "Wir erhalten gerade sehr viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.",
      tooMany: "Sie haben in kurzer Zeit zu viele Anfragen gesendet. Bitte versuchen Sie es in einer Stunde erneut.",
      changed: "Ihre Angaben haben sich geändert, während wir die Zahlung geöffnet haben. Bitte klicken Sie erneut auf die Schaltfläche.",
      alreadyPaid: "Diese Anfrage ist bereits bezahlt. Wir melden uns unter der angegebenen E-Mail-Adresse.",
      expired: "Diese Zahlungsseite ist abgelaufen. Schließen Sie dieses Fenster und beginnen Sie neu.",
      notOpened: "Die Zahlungsseite wurde nicht geöffnet. Bitte versuchen Sie es erneut.",
      failed: "Die Zahlungsseite wurde nicht geöffnet. Bitte versuchen Sie es erneut – Ihnen wird nichts doppelt berechnet.",
    },
    stripe: {
      productName: "Erwähnung in einem RepGet-Artikel",
      submitMessage: "Einmalige Zahlung für eine gesponserte Erwähnung und einen Link in diesem Artikel. Vorbehaltlich redaktioneller Freigabe.",
    },
    thanks: {
      metaTitle: "Ihre Anfrage für eine Erwähnung",
      paidTitle: "Vielen Dank – Ihre Zahlung ist bestätigt",
      waitingTitle: "Wir bestätigen Ihre Zahlung",
      paidWithTitle: "Ihre Anfrage für eine gesponserte Erwähnung in {title} liegt bei unserer Redaktion. Jede Erwähnung wird vor der Veröffentlichung geprüft.",
      paidWithoutTitle: "Ihre Anfrage für eine gesponserte Erwähnung liegt bei unserer Redaktion. Jede Erwähnung wird vor der Veröffentlichung geprüft.",
      writeTo: "Wir schreiben Ihnen an {email} zu Ihrer Erwähnung.",
      waitingBody:
        "Wir haben für diese Seite noch keine Zahlungsbestätigung erhalten. Wenn Sie gerade bezahlt haben, kann das einen Moment dauern: Laden Sie die Seite gleich neu.",
      doNotPayAgain: "Bitte zahlen Sie nicht erneut. Wenn etwas nicht stimmt, kontaktieren Sie uns und wir prüfen es.",
      backToArticle: "Zurück zum Artikel",
      backToBlog: "Zurück zum Blog",
      contact: "Kontakt",
    },
  },
};
