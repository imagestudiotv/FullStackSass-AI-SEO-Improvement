import { emailButton, emailFallback, emailLayout, emailNote, emailText, escapeHtml } from "@/lib/email/layout";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { FREE_ARTICLES } from "@/lib/plans/features";

/**
 * The lifecycle emails' words and templates (docs/emails.md), in the five
 * languages the app speaks - formal address throughout (usted / vous / Lei /
 * Sie), the same vocabulary as the dashboard ("free articles", "Billing",
 * "plan" / "forfait" / "piano" / "Tarif").
 *
 * KEPT AS DATA. Every sentence is a template with {placeholders} filled by
 * format(), never a function, so lifecycle-copy.test.ts can check that each
 * language has every sentence and the same placeholders - a translation that
 * dropped {date} would otherwise ship a promise with no date in it.
 *
 * NO NUMBER IS WRITTEN HERE. Every figure in these emails - a date, a plan's
 * name, a view count, a credit balance - comes from the caller, read from the
 * database at send time; a metric that is zero or unknown is left out rather
 * than shown.
 *
 * Every email has ONE button, to the page in the app where the reader acts on
 * it, and the same link written out under it for clients that strip buttons.
 */

export const LIFECYCLE_KINDS = [
  "welcome",
  "setup_reminder",
  "trial_started",
  "trial_ending",
  "trial_ended",
  "plan_started",
  "payment_failed",
  "cancellation_confirmed",
  "article_published",
  "article_failed",
  "video_views",
  "referral_reward",
  "weekly_summary",
] as const;

export type LifecycleKind = (typeof LIFECYCLE_KINDS)[number];

/**
 * Whether a kind is always sent. Essential: the account, money, the free
 * period and things that went wrong - what a person would be upset NOT to
 * be told. Everything else is "tips and reports", which a person can turn
 * off (Settings, or the link in each one). Decided here, per kind, rather
 * than by each caller, so no caller can label a report essential.
 */
export const ESSENTIAL: Record<LifecycleKind, boolean> = {
  welcome: true,
  setup_reminder: false,
  trial_started: true,
  trial_ending: true,
  trial_ended: true,
  plan_started: true,
  payment_failed: true,
  cancellation_confirmed: true,
  article_published: false,
  article_failed: true,
  video_views: false,
  referral_reward: true,
  weekly_summary: false,
};

/** What each email says about itself, by kind. */
export type LifecycleEmail =
  | { kind: "welcome"; invited: boolean }
  | { kind: "setup_reminder" }
  | { kind: "trial_started"; websiteId: string; domain: string; plan: string; endsOn: Date; provider: "stripe" | "paypal" }
  | { kind: "trial_ending"; websiteId: string; domain: string; plan: string; endsOn: Date }
  | { kind: "trial_ended"; websiteId: string; domain: string }
  | { kind: "plan_started"; websiteId: string; domain: string; plan: string }
  | { kind: "payment_failed"; websiteId: string; domain: string; plan: string }
  | {
      kind: "cancellation_confirmed";
      websiteId: string;
      domain: string;
      plan: string;
      /** The day access ends; null when it already has. */
      endsOn: Date | null;
      /** Cancelled during the free period: nothing was ever charged. */
      trial: boolean;
    }
  | { kind: "article_published"; websiteId: string; articleId: string; domain: string; title: string; url: string }
  | { kind: "article_failed"; websiteId: string; articleId: string; domain: string; title: string; error: string | null }
  | { kind: "video_views"; websiteId: string; domain: string; title: string; views: number }
  | { kind: "referral_reward"; credits: number }
  | {
      kind: "weekly_summary";
      /** Each figure only when it is above zero; the caller leaves the others out. */
      articlesPublished?: number;
      liveArticles?: number;
      socialPosts?: number;
      videosPosted?: number;
      credits?: number;
    };

type Copy = {
  greeting: string;
  greetingNamed: string;
  signOff: string;
  fallback: string;
  /** Under an essential email. */
  noteEssential: string;
  /** Under a tips-and-reports email; followed by the unsubscribe link. */
  noteTips: string;
  unsubscribe: string;
  welcome: { subject: string; heading: string; preheader: string; intro: string; next: string; nextInvited: string; button: string };
  setup_reminder: { subject: string; heading: string; preheader: string; body: string; button: string };
  trial_started: {
    subject: string;
    heading: string;
    preheader: string;
    intro: string;
    /** By card: the plan starts after the last free article, or on the date. */
    card: string;
    /** Through PayPal: the plan starts on the date, or earlier from Billing. */
    paypal: string;
    cancel: string;
    button: string;
  };
  trial_ending: { subject: string; heading: string; preheader: string; body: string; cancel: string; button: string };
  trial_ended: { subject: string; heading: string; preheader: string; body: string; button: string };
  plan_started: { subject: string; heading: string; preheader: string; body: string; next: string; button: string };
  payment_failed: { subject: string; heading: string; preheader: string; body: string; next: string; button: string };
  cancellation_confirmed: {
    subject: string;
    heading: string;
    preheader: string;
    paid: string;
    ended: string;
    trial: string;
    comeBack: string;
    button: string;
  };
  article_published: { subject: string; heading: string; preheader: string; body: string; live: string; button: string };
  article_failed: { subject: string; heading: string; preheader: string; body: string; details: string; next: string; button: string };
  video_views: { subject: string; heading: string; preheader: string; body: string; button: string };
  referral_reward: { subject: string; heading: string; preheader: string; body: string; button: string };
  weekly_summary: {
    subject: string;
    heading: string;
    preheader: string;
    intro: string;
    articlesPublished: string;
    liveArticles: string;
    socialPosts: string;
    videosPosted: string;
    credits: string;
    button: string;
  };
};

export const LIFECYCLE_COPY: Record<Locale, Copy> = {
  en: {
    greeting: "Hello,",
    greetingNamed: "Hello {name},",
    signOff: "The RepGet team",
    fallback: "Or paste this link into your browser:",
    noteEssential: "You are receiving this email because it concerns your RepGet account.",
    noteTips: "You are receiving tips and reports because you have a RepGet account. Emails about billing and anything that goes wrong are always sent.",
    unsubscribe: "Unsubscribe from tips and reports",
    welcome: {
      subject: "Welcome to RepGet",
      heading: "Welcome to RepGet",
      preheader: "Your account is ready.",
      intro: "Your RepGet account is ready. RepGet plans, writes and publishes articles that bring your website visitors from Google and AI search.",
      next: "The next step is to add your website. It takes a few minutes, and RepGet then suggests what to write first.",
      nextInvited: "The websites shared with you are on your dashboard.",
      button: "Open RepGet",
    },
    setup_reminder: {
      subject: "Your website is not added yet",
      heading: "Add your website to get started",
      preheader: "It takes a few minutes.",
      body: "You created your RepGet account a little while ago, but no website has been added yet. Add it now: RepGet checks it and plans your first articles.",
      button: "Add your website",
    },
    trial_started: {
      subject: "Your free articles have started",
      heading: "Your free articles have started",
      preheader: "{count} free articles for {domain}.",
      intro: "Your {count} free articles for {domain} are ready to be written.",
      card: "Your {plan} plan starts, and is first charged, when the last free article is written or on {date}, whichever comes first.",
      paypal: "Your {plan} plan starts, and is first charged, on {date}. You can start it earlier in Billing.",
      cancel: "If you cancel in Billing before then, you pay nothing.",
      button: "Write your first article",
    },
    trial_ending: {
      subject: "Your free period ends tomorrow",
      heading: "Your free period ends tomorrow",
      preheader: "Your {plan} plan for {domain} starts on {date}.",
      body: "The free period for {domain} ends on {date}. Your {plan} plan then starts and the first payment is taken.",
      cancel: "To change plan or cancel, open Billing before then.",
      button: "Open Billing",
    },
    trial_ended: {
      subject: "Your free period has ended",
      heading: "Your free period has ended",
      preheader: "Choose a plan to keep writing for {domain}.",
      body: "The free period for {domain} has ended without a plan starting. Choose a plan in Billing to keep writing articles for it.",
      button: "Choose a plan",
    },
    plan_started: {
      subject: "Welcome to your {plan} plan",
      heading: "Welcome to your {plan} plan",
      preheader: "Your plan for {domain} is active.",
      body: "Thank you. Your first payment went through and your {plan} plan for {domain} is now active.",
      next: "Everything in your plan is available from today.",
      button: "Open your website",
    },
    payment_failed: {
      subject: "Your payment did not go through",
      heading: "Your payment did not go through",
      preheader: "Please update your payment method for {domain}.",
      body: "We could not take the payment for your {plan} plan for {domain}.",
      next: "Please check or update your payment method in Billing so your plan carries on.",
      button: "Update payment",
    },
    cancellation_confirmed: {
      subject: "Your cancellation is confirmed",
      heading: "Your cancellation is confirmed",
      preheader: "Your {plan} plan for {domain} is cancelled.",
      paid: "Your {plan} plan for {domain} is cancelled. You keep everything in it until {date}, and you will not be charged again.",
      ended: "Your {plan} plan for {domain} is cancelled and has ended. You will not be charged again.",
      trial: "Your free period for {domain} is cancelled: your plan will not start and nothing will be charged. Your free articles stay available until {date}.",
      comeBack: "If you change your mind, you can choose a plan again in Billing at any time.",
      button: "Open Billing",
    },
    article_published: {
      subject: "Your article is live: {title}",
      heading: "Your article is live",
      preheader: "{title} is now live on {domain}.",
      body: "\"{title}\" is now live on {domain}.",
      live: "Read it on your website:",
      button: "Open the article",
    },
    article_failed: {
      subject: "An article could not be published",
      heading: "An article could not be published",
      preheader: "{title} is not live on {domain}.",
      body: "\"{title}\" could not be published to {domain}, so it is not live yet.",
      details: "What the website answered: {error}",
      next: "Open the article to see what happened and publish it again.",
      button: "See what happened",
    },
    video_views: {
      subject: "Your video passed {views} views",
      heading: "{views} views",
      preheader: "{title} on {domain} is taking off.",
      body: "Your video \"{title}\" for {domain} has passed {views} views.",
      button: "See the results",
    },
    referral_reward: {
      subject: "You earned {credits} credits",
      heading: "You earned {credits} credits",
      preheader: "Someone you referred paid for their first month.",
      body: "Someone you referred paid for their first month, so {credits} credits were added to your account. Thank you.",
      button: "See your referrals",
    },
    weekly_summary: {
      subject: "Your week on RepGet",
      heading: "Your week on RepGet",
      preheader: "What RepGet did for you in the last 7 days.",
      intro: "Here is what happened in the last 7 days:",
      articlesPublished: "Articles published: {count}",
      liveArticles: "Articles live in total: {count}",
      socialPosts: "Social posts published: {count}",
      videosPosted: "Videos posted: {count}",
      credits: "Credit balance: {count}",
      button: "Open your dashboard",
    },
  },
  es: {
    greeting: "Hola:",
    greetingNamed: "Hola, {name}:",
    signOff: "El equipo de RepGet",
    fallback: "O pegue este enlace en su navegador:",
    noteEssential: "Recibe este correo porque se refiere a su cuenta de RepGet.",
    noteTips: "Recibe consejos e informes porque tiene una cuenta de RepGet. Los correos sobre facturación y sobre cualquier problema se envían siempre.",
    unsubscribe: "Dejar de recibir consejos e informes",
    welcome: {
      subject: "Bienvenido a RepGet",
      heading: "Bienvenido a RepGet",
      preheader: "Su cuenta está lista.",
      intro: "Su cuenta de RepGet está lista. RepGet planifica, escribe y publica artículos que atraen visitas a su sitio web desde Google y la búsqueda con IA.",
      next: "El siguiente paso es añadir su sitio web. Se tarda unos minutos y después RepGet le sugiere qué escribir primero.",
      nextInvited: "Los sitios web compartidos con usted están en su panel.",
      button: "Abrir RepGet",
    },
    setup_reminder: {
      subject: "Aún no ha añadido su sitio web",
      heading: "Añada su sitio web para empezar",
      preheader: "Se tarda unos minutos.",
      body: "Creó su cuenta de RepGet hace un rato, pero todavía no ha añadido ningún sitio web. Añádalo ahora: RepGet lo revisa y planifica sus primeros artículos.",
      button: "Añadir su sitio web",
    },
    trial_started: {
      subject: "Sus artículos gratis han empezado",
      heading: "Sus artículos gratis han empezado",
      preheader: "{count} artículos gratis para {domain}.",
      intro: "Sus {count} artículos gratis para {domain} están listos para escribirse.",
      card: "Su plan {plan} empieza, y se cobra por primera vez, cuando se escriba el último artículo gratis o el {date}, lo que ocurra antes.",
      paypal: "Su plan {plan} empieza, y se cobra por primera vez, el {date}. Puede empezarlo antes en Facturación.",
      cancel: "Si cancela en Facturación antes de esa fecha, no paga nada.",
      button: "Escribir su primer artículo",
    },
    trial_ending: {
      subject: "Su periodo gratuito termina mañana",
      heading: "Su periodo gratuito termina mañana",
      preheader: "Su plan {plan} para {domain} empieza el {date}.",
      body: "El periodo gratuito de {domain} termina el {date}. Entonces empieza su plan {plan} y se cobra el primer pago.",
      cancel: "Para cambiar de plan o cancelar, abra Facturación antes de esa fecha.",
      button: "Abrir Facturación",
    },
    trial_ended: {
      subject: "Su periodo gratuito ha terminado",
      heading: "Su periodo gratuito ha terminado",
      preheader: "Elija un plan para seguir escribiendo para {domain}.",
      body: "El periodo gratuito de {domain} ha terminado sin que empiece ningún plan. Elija un plan en Facturación para seguir escribiendo artículos para este sitio.",
      button: "Elegir un plan",
    },
    plan_started: {
      subject: "Bienvenido a su plan {plan}",
      heading: "Bienvenido a su plan {plan}",
      preheader: "Su plan para {domain} está activo.",
      body: "Gracias. Su primer pago se ha realizado y su plan {plan} para {domain} ya está activo.",
      next: "Todo lo incluido en su plan está disponible desde hoy.",
      button: "Abrir su sitio web",
    },
    payment_failed: {
      subject: "Su pago no se ha podido realizar",
      heading: "Su pago no se ha podido realizar",
      preheader: "Actualice su método de pago para {domain}.",
      body: "No hemos podido cobrar el pago de su plan {plan} para {domain}.",
      next: "Revise o actualice su método de pago en Facturación para que su plan continúe.",
      button: "Actualizar el pago",
    },
    cancellation_confirmed: {
      subject: "Su cancelación está confirmada",
      heading: "Su cancelación está confirmada",
      preheader: "Su plan {plan} para {domain} está cancelado.",
      paid: "Su plan {plan} para {domain} está cancelado. Conserva todo lo incluido hasta el {date} y no se le volverá a cobrar.",
      ended: "Su plan {plan} para {domain} está cancelado y ha terminado. No se le volverá a cobrar.",
      trial: "Su periodo gratuito de {domain} está cancelado: su plan no empezará y no se cobrará nada. Sus artículos gratis siguen disponibles hasta el {date}.",
      comeBack: "Si cambia de opinión, puede volver a elegir un plan en Facturación en cualquier momento.",
      button: "Abrir Facturación",
    },
    article_published: {
      subject: "Su artículo está publicado: {title}",
      heading: "Su artículo está publicado",
      preheader: "{title} ya está publicado en {domain}.",
      body: "«{title}» ya está publicado en {domain}.",
      live: "Léalo en su sitio web:",
      button: "Abrir el artículo",
    },
    article_failed: {
      subject: "No se ha podido publicar un artículo",
      heading: "No se ha podido publicar un artículo",
      preheader: "{title} no está publicado en {domain}.",
      body: "«{title}» no se ha podido publicar en {domain}, así que todavía no está en línea.",
      details: "Lo que respondió el sitio web: {error}",
      next: "Abra el artículo para ver qué ha pasado y vuelva a publicarlo.",
      button: "Ver qué ha pasado",
    },
    video_views: {
      subject: "Su vídeo ha superado las {views} visualizaciones",
      heading: "{views} visualizaciones",
      preheader: "{title} en {domain} está despegando.",
      body: "Su vídeo «{title}» para {domain} ha superado las {views} visualizaciones.",
      button: "Ver los resultados",
    },
    referral_reward: {
      subject: "Ha ganado {credits} créditos",
      heading: "Ha ganado {credits} créditos",
      preheader: "Alguien a quien recomendó ha pagado su primer mes.",
      body: "Alguien a quien recomendó ha pagado su primer mes, así que se han añadido {credits} créditos a su cuenta. Gracias.",
      button: "Ver sus recomendaciones",
    },
    weekly_summary: {
      subject: "Su semana en RepGet",
      heading: "Su semana en RepGet",
      preheader: "Lo que RepGet ha hecho por usted en los últimos 7 días.",
      intro: "Esto es lo que ha pasado en los últimos 7 días:",
      articlesPublished: "Artículos publicados: {count}",
      liveArticles: "Artículos publicados en total: {count}",
      socialPosts: "Publicaciones en redes sociales: {count}",
      videosPosted: "Vídeos publicados: {count}",
      credits: "Saldo de créditos: {count}",
      button: "Abrir su panel",
    },
  },
  fr: {
    greeting: "Bonjour,",
    greetingNamed: "Bonjour {name},",
    signOff: "L’équipe RepGet",
    fallback: "Ou collez ce lien dans votre navigateur :",
    noteEssential: "Vous recevez cet e-mail parce qu’il concerne votre compte RepGet.",
    noteTips: "Vous recevez des conseils et des bilans parce que vous avez un compte RepGet. Les e-mails sur la facturation et sur tout problème sont toujours envoyés.",
    unsubscribe: "Ne plus recevoir les conseils et les bilans",
    welcome: {
      subject: "Bienvenue sur RepGet",
      heading: "Bienvenue sur RepGet",
      preheader: "Votre compte est prêt.",
      intro: "Votre compte RepGet est prêt. RepGet planifie, rédige et publie des articles qui amènent des visiteurs sur votre site depuis Google et la recherche par IA.",
      next: "L’étape suivante consiste à ajouter votre site. Cela prend quelques minutes, puis RepGet vous suggère quoi écrire en premier.",
      nextInvited: "Les sites partagés avec vous se trouvent sur votre tableau de bord.",
      button: "Ouvrir RepGet",
    },
    setup_reminder: {
      subject: "Votre site n’est pas encore ajouté",
      heading: "Ajoutez votre site pour commencer",
      preheader: "Cela prend quelques minutes.",
      body: "Vous avez créé votre compte RepGet il y a peu, mais aucun site n’a encore été ajouté. Ajoutez-le maintenant : RepGet l’analyse et planifie vos premiers articles.",
      button: "Ajouter votre site",
    },
    trial_started: {
      subject: "Vos articles gratuits ont commencé",
      heading: "Vos articles gratuits ont commencé",
      preheader: "{count} articles gratuits pour {domain}.",
      intro: "Vos {count} articles gratuits pour {domain} sont prêts à être rédigés.",
      card: "Votre forfait {plan} démarre, et est facturé pour la première fois, lorsque le dernier article gratuit est rédigé ou le {date}, selon ce qui arrive en premier.",
      paypal: "Votre forfait {plan} démarre, et est facturé pour la première fois, le {date}. Vous pouvez le démarrer plus tôt dans Facturation.",
      cancel: "Si vous annulez dans Facturation avant cette date, vous ne payez rien.",
      button: "Rédiger votre premier article",
    },
    trial_ending: {
      subject: "Votre période gratuite se termine demain",
      heading: "Votre période gratuite se termine demain",
      preheader: "Votre forfait {plan} pour {domain} démarre le {date}.",
      body: "La période gratuite de {domain} se termine le {date}. Votre forfait {plan} démarre alors et le premier paiement est prélevé.",
      cancel: "Pour changer de forfait ou annuler, ouvrez Facturation avant cette date.",
      button: "Ouvrir Facturation",
    },
    trial_ended: {
      subject: "Votre période gratuite est terminée",
      heading: "Votre période gratuite est terminée",
      preheader: "Choisissez un forfait pour continuer à écrire pour {domain}.",
      body: "La période gratuite de {domain} est terminée sans qu’aucun forfait n’ait démarré. Choisissez un forfait dans Facturation pour continuer à rédiger des articles pour ce site.",
      button: "Choisir un forfait",
    },
    plan_started: {
      subject: "Bienvenue dans votre forfait {plan}",
      heading: "Bienvenue dans votre forfait {plan}",
      preheader: "Votre forfait pour {domain} est actif.",
      body: "Merci. Votre premier paiement a été effectué et votre forfait {plan} pour {domain} est désormais actif.",
      next: "Tout ce que comprend votre forfait est disponible dès aujourd’hui.",
      button: "Ouvrir votre site",
    },
    payment_failed: {
      subject: "Votre paiement n’a pas abouti",
      heading: "Votre paiement n’a pas abouti",
      preheader: "Veuillez mettre à jour votre moyen de paiement pour {domain}.",
      body: "Nous n’avons pas pu prélever le paiement de votre forfait {plan} pour {domain}.",
      next: "Veuillez vérifier ou mettre à jour votre moyen de paiement dans Facturation pour que votre forfait continue.",
      button: "Mettre à jour le paiement",
    },
    cancellation_confirmed: {
      subject: "Votre résiliation est confirmée",
      heading: "Votre résiliation est confirmée",
      preheader: "Votre forfait {plan} pour {domain} est résilié.",
      paid: "Votre forfait {plan} pour {domain} est résilié. Vous gardez tout ce qu’il comprend jusqu’au {date}, et vous ne serez plus facturé.",
      ended: "Votre forfait {plan} pour {domain} est résilié et a pris fin. Vous ne serez plus facturé.",
      trial: "Votre période gratuite pour {domain} est annulée : votre forfait ne démarrera pas et rien ne sera facturé. Vos articles gratuits restent disponibles jusqu’au {date}.",
      comeBack: "Si vous changez d’avis, vous pouvez à tout moment choisir à nouveau un forfait dans Facturation.",
      button: "Ouvrir Facturation",
    },
    article_published: {
      subject: "Votre article est en ligne : {title}",
      heading: "Votre article est en ligne",
      preheader: "{title} est maintenant en ligne sur {domain}.",
      body: "« {title} » est maintenant en ligne sur {domain}.",
      live: "Lisez-le sur votre site :",
      button: "Ouvrir l’article",
    },
    article_failed: {
      subject: "Un article n’a pas pu être publié",
      heading: "Un article n’a pas pu être publié",
      preheader: "{title} n’est pas en ligne sur {domain}.",
      body: "« {title} » n’a pas pu être publié sur {domain} : il n’est donc pas encore en ligne.",
      details: "Réponse du site : {error}",
      next: "Ouvrez l’article pour voir ce qui s’est passé et publiez-le à nouveau.",
      button: "Voir ce qui s’est passé",
    },
    video_views: {
      subject: "Votre vidéo a dépassé {views} vues",
      heading: "{views} vues",
      preheader: "{title} sur {domain} décolle.",
      body: "Votre vidéo « {title} » pour {domain} a dépassé {views} vues.",
      button: "Voir les résultats",
    },
    referral_reward: {
      subject: "Vous avez gagné {credits} crédits",
      heading: "Vous avez gagné {credits} crédits",
      preheader: "Une personne que vous avez parrainée a payé son premier mois.",
      body: "Une personne que vous avez parrainée a payé son premier mois : {credits} crédits ont donc été ajoutés à votre compte. Merci.",
      button: "Voir vos parrainages",
    },
    weekly_summary: {
      subject: "Votre semaine sur RepGet",
      heading: "Votre semaine sur RepGet",
      preheader: "Ce que RepGet a fait pour vous ces 7 derniers jours.",
      intro: "Voici ce qui s’est passé ces 7 derniers jours :",
      articlesPublished: "Articles publiés : {count}",
      liveArticles: "Articles en ligne au total : {count}",
      socialPosts: "Publications sur les réseaux sociaux : {count}",
      videosPosted: "Vidéos publiées : {count}",
      credits: "Solde de crédits : {count}",
      button: "Ouvrir votre tableau de bord",
    },
  },
  it: {
    greeting: "Buongiorno,",
    greetingNamed: "Buongiorno {name},",
    signOff: "Il team di RepGet",
    fallback: "Oppure incolli questo link nel Suo browser:",
    noteEssential: "Riceve questa email perché riguarda il Suo account RepGet.",
    noteTips: "Riceve consigli e resoconti perché ha un account RepGet. Le email sulla fatturazione e su qualsiasi problema vengono sempre inviate.",
    unsubscribe: "Non ricevere più consigli e resoconti",
    welcome: {
      subject: "Benvenuto in RepGet",
      heading: "Benvenuto in RepGet",
      preheader: "Il Suo account è pronto.",
      intro: "Il Suo account RepGet è pronto. RepGet pianifica, scrive e pubblica articoli che portano visitatori al Suo sito da Google e dalla ricerca con l’IA.",
      next: "Il prossimo passo è aggiungere il Suo sito. Bastano pochi minuti, poi RepGet Le suggerisce cosa scrivere per primo.",
      nextInvited: "I siti condivisi con Lei si trovano nella Sua dashboard.",
      button: "Apri RepGet",
    },
    setup_reminder: {
      subject: "Il Suo sito non è ancora stato aggiunto",
      heading: "Aggiunga il Suo sito per iniziare",
      preheader: "Bastano pochi minuti.",
      body: "Ha creato il Suo account RepGet poco fa, ma non ha ancora aggiunto nessun sito. Lo aggiunga ora: RepGet lo analizza e pianifica i Suoi primi articoli.",
      button: "Aggiungi il Suo sito",
    },
    trial_started: {
      subject: "I Suoi articoli gratuiti sono iniziati",
      heading: "I Suoi articoli gratuiti sono iniziati",
      preheader: "{count} articoli gratuiti per {domain}.",
      intro: "I Suoi {count} articoli gratuiti per {domain} sono pronti per essere scritti.",
      card: "Il Suo piano {plan} inizia, e viene addebitato per la prima volta, quando viene scritto l’ultimo articolo gratuito oppure il {date}, a seconda di quale avviene prima.",
      paypal: "Il Suo piano {plan} inizia, e viene addebitato per la prima volta, il {date}. Può avviarlo prima in Fatturazione.",
      cancel: "Se annulla in Fatturazione prima di quella data, non paga nulla.",
      button: "Scrivi il primo articolo",
    },
    trial_ending: {
      subject: "Il Suo periodo gratuito termina domani",
      heading: "Il Suo periodo gratuito termina domani",
      preheader: "Il Suo piano {plan} per {domain} inizia il {date}.",
      body: "Il periodo gratuito di {domain} termina il {date}. Poi inizia il Suo piano {plan} e viene addebitato il primo pagamento.",
      cancel: "Per cambiare piano o annullare, apra Fatturazione prima di quella data.",
      button: "Apri Fatturazione",
    },
    trial_ended: {
      subject: "Il Suo periodo gratuito è terminato",
      heading: "Il Suo periodo gratuito è terminato",
      preheader: "Scelga un piano per continuare a scrivere per {domain}.",
      body: "Il periodo gratuito di {domain} è terminato senza che sia iniziato un piano. Scelga un piano in Fatturazione per continuare a scrivere articoli per questo sito.",
      button: "Scegli un piano",
    },
    plan_started: {
      subject: "Benvenuto nel Suo piano {plan}",
      heading: "Benvenuto nel Suo piano {plan}",
      preheader: "Il Suo piano per {domain} è attivo.",
      body: "Grazie. Il Suo primo pagamento è andato a buon fine e il Suo piano {plan} per {domain} è ora attivo.",
      next: "Tutto ciò che è incluso nel Suo piano è disponibile da oggi.",
      button: "Apri il Suo sito",
    },
    payment_failed: {
      subject: "Il Suo pagamento non è andato a buon fine",
      heading: "Il Suo pagamento non è andato a buon fine",
      preheader: "Aggiorni il Suo metodo di pagamento per {domain}.",
      body: "Non siamo riusciti a riscuotere il pagamento del Suo piano {plan} per {domain}.",
      next: "Controlli o aggiorni il Suo metodo di pagamento in Fatturazione, così il Suo piano continua.",
      button: "Aggiorna il pagamento",
    },
    cancellation_confirmed: {
      subject: "La Sua disdetta è confermata",
      heading: "La Sua disdetta è confermata",
      preheader: "Il Suo piano {plan} per {domain} è disdetto.",
      paid: "Il Suo piano {plan} per {domain} è disdetto. Mantiene tutto ciò che include fino al {date} e non Le verrà addebitato altro.",
      ended: "Il Suo piano {plan} per {domain} è disdetto ed è terminato. Non Le verrà addebitato altro.",
      trial: "Il Suo periodo gratuito per {domain} è annullato: il piano non inizierà e non verrà addebitato nulla. I Suoi articoli gratuiti restano disponibili fino al {date}.",
      comeBack: "Se cambia idea, può scegliere di nuovo un piano in Fatturazione in qualsiasi momento.",
      button: "Apri Fatturazione",
    },
    article_published: {
      subject: "Il Suo articolo è online: {title}",
      heading: "Il Suo articolo è online",
      preheader: "{title} è ora online su {domain}.",
      body: "«{title}» è ora online su {domain}.",
      live: "Lo legga sul Suo sito:",
      button: "Apri l’articolo",
    },
    article_failed: {
      subject: "Non è stato possibile pubblicare un articolo",
      heading: "Non è stato possibile pubblicare un articolo",
      preheader: "{title} non è online su {domain}.",
      body: "Non è stato possibile pubblicare «{title}» su {domain}, quindi non è ancora online.",
      details: "La risposta del sito: {error}",
      next: "Apra l’articolo per vedere cosa è successo e lo pubblichi di nuovo.",
      button: "Vedi cosa è successo",
    },
    video_views: {
      subject: "Il Suo video ha superato {views} visualizzazioni",
      heading: "{views} visualizzazioni",
      preheader: "{title} su {domain} sta decollando.",
      body: "Il Suo video «{title}» per {domain} ha superato {views} visualizzazioni.",
      button: "Vedi i risultati",
    },
    referral_reward: {
      subject: "Ha guadagnato {credits} crediti",
      heading: "Ha guadagnato {credits} crediti",
      preheader: "Una persona che ha invitato ha pagato il primo mese.",
      body: "Una persona che ha invitato ha pagato il primo mese, quindi sono stati aggiunti {credits} crediti al Suo account. Grazie.",
      button: "Vedi i Suoi inviti",
    },
    weekly_summary: {
      subject: "La Sua settimana su RepGet",
      heading: "La Sua settimana su RepGet",
      preheader: "Cosa ha fatto RepGet per Lei negli ultimi 7 giorni.",
      intro: "Ecco cosa è successo negli ultimi 7 giorni:",
      articlesPublished: "Articoli pubblicati: {count}",
      liveArticles: "Articoli online in totale: {count}",
      socialPosts: "Post pubblicati sui social: {count}",
      videosPosted: "Video pubblicati: {count}",
      credits: "Saldo crediti: {count}",
      button: "Apri la Sua dashboard",
    },
  },
  de: {
    greeting: "Guten Tag,",
    greetingNamed: "Guten Tag {name},",
    signOff: "Ihr RepGet-Team",
    fallback: "Oder fügen Sie diesen Link in Ihren Browser ein:",
    noteEssential: "Sie erhalten diese E-Mail, weil sie Ihr RepGet-Konto betrifft.",
    noteTips: "Sie erhalten Tipps und Berichte, weil Sie ein RepGet-Konto haben. E-Mails zur Abrechnung und zu Problemen werden immer gesendet.",
    unsubscribe: "Tipps und Berichte abbestellen",
    welcome: {
      subject: "Willkommen bei RepGet",
      heading: "Willkommen bei RepGet",
      preheader: "Ihr Konto ist bereit.",
      intro: "Ihr RepGet-Konto ist bereit. RepGet plant, schreibt und veröffentlicht Artikel, die Ihrer Website Besucher aus Google und der KI-Suche bringen.",
      next: "Im nächsten Schritt fügen Sie Ihre Website hinzu. Das dauert nur wenige Minuten, danach schlägt RepGet vor, was Sie zuerst schreiben.",
      nextInvited: "Die Websites, die mit Ihnen geteilt wurden, finden Sie in Ihrem Dashboard.",
      button: "RepGet öffnen",
    },
    setup_reminder: {
      subject: "Ihre Website ist noch nicht hinzugefügt",
      heading: "Fügen Sie Ihre Website hinzu",
      preheader: "Das dauert nur wenige Minuten.",
      body: "Sie haben Ihr RepGet-Konto vor Kurzem erstellt, aber noch keine Website hinzugefügt. Fügen Sie sie jetzt hinzu: RepGet prüft sie und plant Ihre ersten Artikel.",
      button: "Website hinzufügen",
    },
    trial_started: {
      subject: "Ihre kostenlosen Artikel haben begonnen",
      heading: "Ihre kostenlosen Artikel haben begonnen",
      preheader: "{count} kostenlose Artikel für {domain}.",
      intro: "Ihre {count} kostenlosen Artikel für {domain} können jetzt geschrieben werden.",
      card: "Ihr Tarif {plan} beginnt und wird zum ersten Mal abgerechnet, sobald der letzte kostenlose Artikel geschrieben ist oder am {date}, je nachdem, was zuerst eintritt.",
      paypal: "Ihr Tarif {plan} beginnt und wird zum ersten Mal abgerechnet am {date}. Sie können ihn unter Abrechnung früher starten.",
      cancel: "Wenn Sie vorher unter Abrechnung kündigen, zahlen Sie nichts.",
      button: "Ersten Artikel schreiben",
    },
    trial_ending: {
      subject: "Ihr kostenloser Zeitraum endet morgen",
      heading: "Ihr kostenloser Zeitraum endet morgen",
      preheader: "Ihr Tarif {plan} für {domain} beginnt am {date}.",
      body: "Der kostenlose Zeitraum für {domain} endet am {date}. Danach beginnt Ihr Tarif {plan} und die erste Zahlung wird eingezogen.",
      cancel: "Um den Tarif zu wechseln oder zu kündigen, öffnen Sie vorher die Abrechnung.",
      button: "Abrechnung öffnen",
    },
    trial_ended: {
      subject: "Ihr kostenloser Zeitraum ist beendet",
      heading: "Ihr kostenloser Zeitraum ist beendet",
      preheader: "Wählen Sie einen Tarif, um weiter für {domain} zu schreiben.",
      body: "Der kostenlose Zeitraum für {domain} ist beendet, ohne dass ein Tarif begonnen hat. Wählen Sie unter Abrechnung einen Tarif, um weiter Artikel für diese Website zu schreiben.",
      button: "Tarif wählen",
    },
    plan_started: {
      subject: "Willkommen in Ihrem Tarif {plan}",
      heading: "Willkommen in Ihrem Tarif {plan}",
      preheader: "Ihr Tarif für {domain} ist aktiv.",
      body: "Vielen Dank. Ihre erste Zahlung ist eingegangen und Ihr Tarif {plan} für {domain} ist jetzt aktiv.",
      next: "Alles, was Ihr Tarif enthält, steht Ihnen ab heute zur Verfügung.",
      button: "Website öffnen",
    },
    payment_failed: {
      subject: "Ihre Zahlung ist fehlgeschlagen",
      heading: "Ihre Zahlung ist fehlgeschlagen",
      preheader: "Bitte aktualisieren Sie Ihre Zahlungsmethode für {domain}.",
      body: "Wir konnten die Zahlung für Ihren Tarif {plan} für {domain} nicht einziehen.",
      next: "Bitte prüfen oder aktualisieren Sie Ihre Zahlungsmethode unter Abrechnung, damit Ihr Tarif weiterläuft.",
      button: "Zahlung aktualisieren",
    },
    cancellation_confirmed: {
      subject: "Ihre Kündigung ist bestätigt",
      heading: "Ihre Kündigung ist bestätigt",
      preheader: "Ihr Tarif {plan} für {domain} ist gekündigt.",
      paid: "Ihr Tarif {plan} für {domain} ist gekündigt. Sie behalten alle Leistungen bis zum {date}, und es wird nichts mehr abgerechnet.",
      ended: "Ihr Tarif {plan} für {domain} ist gekündigt und beendet. Es wird nichts mehr abgerechnet.",
      trial: "Ihr kostenloser Zeitraum für {domain} ist gekündigt: Ihr Tarif beginnt nicht und es wird nichts abgerechnet. Ihre kostenlosen Artikel bleiben bis zum {date} verfügbar.",
      comeBack: "Wenn Sie es sich anders überlegen, können Sie jederzeit unter Abrechnung wieder einen Tarif wählen.",
      button: "Abrechnung öffnen",
    },
    article_published: {
      subject: "Ihr Artikel ist online: {title}",
      heading: "Ihr Artikel ist online",
      preheader: "{title} ist jetzt auf {domain} online.",
      body: "„{title}“ ist jetzt auf {domain} online.",
      live: "Lesen Sie ihn auf Ihrer Website:",
      button: "Artikel öffnen",
    },
    article_failed: {
      subject: "Ein Artikel konnte nicht veröffentlicht werden",
      heading: "Ein Artikel konnte nicht veröffentlicht werden",
      preheader: "{title} ist auf {domain} nicht online.",
      body: "„{title}“ konnte nicht auf {domain} veröffentlicht werden und ist daher noch nicht online.",
      details: "Antwort der Website: {error}",
      next: "Öffnen Sie den Artikel, um zu sehen, was passiert ist, und veröffentlichen Sie ihn erneut.",
      button: "Details ansehen",
    },
    video_views: {
      subject: "Ihr Video hat {views} Aufrufe überschritten",
      heading: "{views} Aufrufe",
      preheader: "{title} auf {domain} hebt ab.",
      body: "Ihr Video „{title}“ für {domain} hat {views} Aufrufe überschritten.",
      button: "Ergebnisse ansehen",
    },
    referral_reward: {
      subject: "Sie haben {credits} Credits verdient",
      heading: "Sie haben {credits} Credits verdient",
      preheader: "Eine von Ihnen empfohlene Person hat ihren ersten Monat bezahlt.",
      body: "Eine von Ihnen empfohlene Person hat ihren ersten Monat bezahlt, daher wurden Ihrem Konto {credits} Credits gutgeschrieben. Vielen Dank.",
      button: "Empfehlungen ansehen",
    },
    weekly_summary: {
      subject: "Ihre Woche bei RepGet",
      heading: "Ihre Woche bei RepGet",
      preheader: "Was RepGet in den letzten 7 Tagen für Sie getan hat.",
      intro: "Das ist in den letzten 7 Tagen passiert:",
      articlesPublished: "Veröffentlichte Artikel: {count}",
      liveArticles: "Artikel online insgesamt: {count}",
      socialPosts: "Veröffentlichte Social-Media-Beiträge: {count}",
      videosPosted: "Veröffentlichte Videos: {count}",
      credits: "Credit-Guthaben: {count}",
      button: "Dashboard öffnen",
    },
  },
};

export type LifecycleContext = {
  locale: Locale;
  /** The recipient's name, for the greeting; null for "Hello,". */
  name: string | null;
  /** The app's absolute address, no trailing slash (siteUrl()). */
  appUrl: string;
  /** The signed unsubscribe page; null for an essential email. */
  unsubscribeUrl: string | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/** What one email is made of, before it is laid out as HTML and as text. */
type Parts = {
  subject: string;
  heading: string;
  preheader: string;
  paragraphs: string[];
  /** Label: value lines, shown as a list (the weekly summary). */
  facts?: string[];
  /** A link written out in the body (an article's live address). */
  link?: { label: string; href: string };
  button: { label: string; path: string };
};

/** A long date in the reader's language, read the same everywhere (UTC). */
function longDate(value: Date, locale: Locale): string {
  return formatDate(value, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** An error message is the website's own words, cut to a sentence or two. */
function shortError(error: string): string {
  const flat = error.replace(/\s+/g, " ").trim();
  return flat.length > 200 ? `${flat.slice(0, 199)}…` : flat;
}

function parts(email: LifecycleEmail, locale: Locale): Parts {
  const copy = LIFECYCLE_COPY[locale];
  const billing = (websiteId: string) => `/billing?site=${encodeURIComponent(websiteId)}`;
  switch (email.kind) {
    case "welcome": {
      const c = copy.welcome;
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: c.preheader,
        paragraphs: [c.intro, email.invited ? c.nextInvited : c.next],
        // /onboarding routes to the next step, and sends someone invited to a shared site to the dashboard.
        button: { label: c.button, path: email.invited ? "/dashboard" : "/onboarding" },
      };
    }
    case "setup_reminder": {
      const c = copy.setup_reminder;
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: c.preheader,
        paragraphs: [c.body],
        button: { label: c.button, path: "/onboarding" },
      };
    }
    case "trial_started": {
      const c = copy.trial_started;
      const values = { count: FREE_ARTICLES, domain: email.domain, plan: email.plan, date: longDate(email.endsOn, locale) };
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [
          format(c.intro, values),
          format(email.provider === "paypal" ? c.paypal : c.card, values),
          c.cancel,
        ],
        button: { label: c.button, path: `/websites/${email.websiteId}` },
      };
    }
    case "trial_ending": {
      const c = copy.trial_ending;
      const values = { domain: email.domain, plan: email.plan, date: longDate(email.endsOn, locale) };
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values), c.cancel],
        button: { label: c.button, path: billing(email.websiteId) },
      };
    }
    case "trial_ended": {
      const c = copy.trial_ended;
      const values = { domain: email.domain };
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values)],
        button: { label: c.button, path: billing(email.websiteId) },
      };
    }
    case "plan_started": {
      const c = copy.plan_started;
      const values = { domain: email.domain, plan: email.plan };
      return {
        subject: format(c.subject, values),
        heading: format(c.heading, values),
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values), c.next],
        button: { label: c.button, path: `/websites/${email.websiteId}` },
      };
    }
    case "payment_failed": {
      const c = copy.payment_failed;
      const values = { domain: email.domain, plan: email.plan };
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values), c.next],
        button: { label: c.button, path: billing(email.websiteId) },
      };
    }
    case "cancellation_confirmed": {
      const c = copy.cancellation_confirmed;
      const values = { domain: email.domain, plan: email.plan, date: email.endsOn ? longDate(email.endsOn, locale) : "" };
      const sentence = email.endsOn ? (email.trial ? c.trial : c.paid) : c.ended;
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(sentence, values), c.comeBack],
        button: { label: c.button, path: billing(email.websiteId) },
      };
    }
    case "article_published": {
      const c = copy.article_published;
      const values = { domain: email.domain, title: email.title };
      return {
        subject: format(c.subject, values),
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values)],
        link: { label: c.live, href: email.url },
        button: { label: c.button, path: `/websites/${email.websiteId}/articles/${email.articleId}` },
      };
    }
    case "article_failed": {
      const c = copy.article_failed;
      const values = { domain: email.domain, title: email.title, error: email.error ? shortError(email.error) : "" };
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values), ...(email.error ? [format(c.details, values)] : []), c.next],
        button: { label: c.button, path: `/websites/${email.websiteId}/articles/${email.articleId}` },
      };
    }
    case "video_views": {
      const c = copy.video_views;
      const values = { domain: email.domain, title: email.title, views: formatNumber(email.views, locale) };
      return {
        subject: format(c.subject, values),
        heading: format(c.heading, values),
        preheader: format(c.preheader, values),
        paragraphs: [format(c.body, values)],
        button: { label: c.button, path: `/websites/${email.websiteId}/videos?tab=posted` },
      };
    }
    case "referral_reward": {
      const c = copy.referral_reward;
      const values = { credits: formatNumber(email.credits, locale) };
      return {
        subject: format(c.subject, values),
        heading: format(c.heading, values),
        preheader: c.preheader,
        paragraphs: [format(c.body, values)],
        button: { label: c.button, path: "/settings#referral" },
      };
    }
    case "weekly_summary": {
      const c = copy.weekly_summary;
      const line = (template: string, value: number | undefined) =>
        value !== undefined && value > 0 ? [format(template, { count: formatNumber(value, locale) })] : [];
      return {
        subject: c.subject,
        heading: c.heading,
        preheader: c.preheader,
        paragraphs: [c.intro],
        facts: [
          ...line(c.articlesPublished, email.articlesPublished),
          ...line(c.liveArticles, email.liveArticles),
          ...line(c.socialPosts, email.socialPosts),
          ...line(c.videosPosted, email.videosPosted),
          ...line(c.credits, email.credits),
        ],
        button: { label: c.button, path: "/dashboard" },
      };
    }
  }
}

/**
 * One email, as HTML and plain text, in the reader's language: greeting, the
 * body, the one button (and its link written out), the sign-off, and the note
 * that says why it was sent - with the unsubscribe link when it can be
 * unsubscribed from.
 */
export function renderLifecycleEmail(email: LifecycleEmail, context: LifecycleContext): RenderedEmail {
  const copy = LIFECYCLE_COPY[context.locale];
  const part = parts(email, context.locale);
  const href = `${context.appUrl}${part.button.path}`;
  const greeting = context.name ? format(copy.greetingNamed, { name: context.name }) : copy.greeting;
  const note = ESSENTIAL[email.kind] || !context.unsubscribeUrl ? copy.noteEssential : copy.noteTips;

  const html = emailLayout({
    lang: context.locale,
    heading: part.heading,
    preheader: part.preheader,
    body: [
      emailText(escapeHtml(greeting)),
      ...part.paragraphs.map((paragraph) => emailText(escapeHtml(paragraph))),
      part.facts?.length ? emailText(part.facts.map((fact) => `&bull; ${escapeHtml(fact)}`).join("<br>")) : "",
      part.link
        ? emailText(
            `${escapeHtml(part.link.label)}<br><a href="${escapeHtml(part.link.href)}" style="color:#3f3f46;word-break:break-all;">${escapeHtml(part.link.href)}</a>`,
          )
        : "",
      emailButton(href, part.button.label),
      emailText(escapeHtml(copy.signOff)),
      emailFallback(href, copy.fallback),
      emailNote(
        context.unsubscribeUrl && !ESSENTIAL[email.kind]
          ? `${escapeHtml(note)} <a href="${escapeHtml(context.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(copy.unsubscribe)}</a>`
          : escapeHtml(note),
      ),
    ].join(""),
  });

  const text = [
    greeting,
    ...part.paragraphs,
    ...(part.facts?.length ? [part.facts.map((fact) => `- ${fact}`).join("\n")] : []),
    ...(part.link ? [`${part.link.label}\n${part.link.href}`] : []),
    `${part.button.label}:\n${href}`,
    copy.signOff,
    "--",
    context.unsubscribeUrl && !ESSENTIAL[email.kind] ? `${note}\n${copy.unsubscribe}: ${context.unsubscribeUrl}` : note,
  ].join("\n\n");

  return { subject: part.subject, html, text };
}
