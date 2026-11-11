import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's closing banner (client's design cta.html, 2026-11-11), in
 * every language. It replaces the 2026-11-03 banner, whose field looked the
 * same as the hero's: here the visitor first picks one of two ways to start
 * (the free website check or the free trial), then fills one field.
 *
 * Each way has its own button and its own line under the field, for a website
 * and for an email. The trial's button reads as the hero's does (hero.ts
 * `startTrial`).
 */

/** One of the two tabs: its label, its button and the line under the field. */
export type StartWayCopy = {
  tab: string;
  submit: string;
  submitEmail: string;
  hint: string;
  hintEmail: string;
};

export type FinalCtaCopy = {
  kicker: string;
  titleLead: string;
  titleAccent: string;
  desc: string;
  form: {
    /** The line above the two tabs. */
    startLabel: string;
    /** aria-label of the two tabs. */
    tabsLabel: string;
    audit: StartWayCopy;
    trial: StartWayCopy;
    websiteLabel: string;
    emailLabel: string;
    websitePlaceholder: string;
    emailPlaceholder: string;
    useEmail: string;
    useWebsite: string;
    emptyWebsite: string;
    emptyEmail: string;
    invalidWebsite: string;
    invalidEmail: string;
  };
  points: string[];
  pills: string[];
  panelTitle: string;
  panelBody: string;
  items: { title: string; body: string }[];
  sideNote: string;
};

const en: FinalCtaCopy = {
  kicker: "Your growth starts here",
  titleLead: "Ready for more customers?",
  titleAccent: "Let's make it happen.",
  desc: "Get discovered on Google and AI search, grow your social presence, and reach more customers. All with RepGet.",
  form: {
    startLabel: "Choose how you want to start",
    tabsLabel: "Free ways to start with RepGet",
    audit: {
      tab: "Check my website",
      submit: "Check my website free",
      submitEmail: "Continue with email",
      hint: "Enter your website to get your free check.",
      hintEmail: "We'll ask for your website in the next step.",
    },
    trial: {
      tab: "Start free trial",
      submit: "Start free trial",
      submitEmail: "Start free trial",
      hint: "Enter your website to start your free trial.",
      hintEmail: "Enter your email to start your free trial.",
    },
    websiteLabel: "Website address",
    emailLabel: "Email address",
    websitePlaceholder: "yourwebsite.com",
    emailPlaceholder: "you@yourcompany.com",
    useEmail: "Use your email instead",
    useWebsite: "Use website instead",
    emptyWebsite: "Please enter your website.",
    emptyEmail: "Please enter your email.",
    invalidWebsite: "Please enter a valid website, such as yourwebsite.com.",
    invalidEmail: "Please enter a valid email address.",
  },
  points: ["Free to get started", "Private and secure", "24/7 human support"],
  pills: ["SEO", "AI Visibility", "Social", "Backlinks"],
  panelTitle: "Everything you need to grow.",
  panelBody: "Be discovered in search and AI answers, then turn your ideas into content that works across every channel.",
  items: [
    { title: "Discover what's holding you back", body: "Find opportunities with a website audit and actionable suggestions." },
    { title: "Create content for search and social", body: "Publish SEO articles, then turn them into posts, reels and carousels." },
    { title: "Build authority and visibility", body: "Grow your presence with backlinks and AI search visibility tools." },
    { title: "Let Growth AI Copilot guide you", body: "Plan your next steps and take action with the right tools." },
  ],
  sideNote: "Built for small businesses. Designed to scale with you.",
};

const es: FinalCtaCopy = {
  kicker: "Su crecimiento empieza aquí",
  titleLead: "¿Listo para conseguir más clientes?",
  titleAccent: "Hagámoslo realidad.",
  desc: "Hágase visible en Google y en la búsqueda con IA, haga crecer su presencia en redes y llegue a más clientes. Todo con RepGet.",
  form: {
    startLabel: "Elija cómo quiere empezar",
    tabsLabel: "Formas gratuitas de empezar con RepGet",
    audit: {
      tab: "Analizar mi web",
      submit: "Analizar mi web gratis",
      submitEmail: "Continuar con el correo",
      hint: "Introduzca su sitio web para recibir su análisis gratuito.",
      hintEmail: "Le pediremos su sitio web en el siguiente paso.",
    },
    trial: {
      tab: "Empezar la prueba gratis",
      submit: "Empezar la prueba gratis",
      submitEmail: "Empezar la prueba gratis",
      hint: "Introduzca su sitio web para empezar su prueba gratuita.",
      hintEmail: "Introduzca su correo para empezar su prueba gratuita.",
    },
    websiteLabel: "Dirección del sitio web",
    emailLabel: "Correo electrónico",
    websitePlaceholder: "susitioweb.com",
    emailPlaceholder: "you@yourcompany.com",
    useEmail: "Usar su correo en su lugar",
    useWebsite: "Usar su sitio web en su lugar",
    emptyWebsite: "Introduzca la dirección de su sitio web.",
    emptyEmail: "Introduzca su correo electrónico.",
    invalidWebsite: "Introduzca una dirección web válida, como susitioweb.com.",
    invalidEmail: "Introduzca un correo electrónico válido.",
  },
  points: ["Gratis para empezar", "Privado y seguro", "Soporte humano 24/7"],
  pills: ["SEO", "Visibilidad en IA", "Redes", "Backlinks"],
  panelTitle: "Todo lo que necesita para crecer.",
  panelBody: "Hágase visible en las búsquedas y en las respuestas de la IA, y convierta sus ideas en contenido que funciona en todos los canales.",
  items: [
    { title: "Descubra qué le frena", body: "Encuentre oportunidades con una auditoría de su sitio web y sugerencias concretas." },
    { title: "Cree contenido para búsquedas y redes", body: "Publique artículos SEO y conviértalos en publicaciones, reels y carruseles." },
    { title: "Gane autoridad y visibilidad", body: "Aumente su presencia con backlinks y herramientas de visibilidad en la búsqueda con IA." },
    { title: "Deje que Growth AI Copilot le guíe", body: "Planifique sus próximos pasos y actúe con las herramientas adecuadas." },
  ],
  sideNote: "Pensado para pequeñas empresas. Diseñado para crecer con usted.",
};

const fr: FinalCtaCopy = {
  kicker: "Votre croissance commence ici",
  titleLead: "Prêt à gagner plus de clients ?",
  titleAccent: "Passons à l’action.",
  desc: "Soyez visible sur Google et dans la recherche IA, développez votre présence sociale et touchez plus de clients. Le tout avec RepGet.",
  form: {
    startLabel: "Choisissez comment commencer",
    tabsLabel: "Façons gratuites de commencer avec RepGet",
    audit: {
      tab: "Analyser mon site",
      submit: "Analyser mon site gratuitement",
      submitEmail: "Continuer avec l’e-mail",
      hint: "Saisissez votre site pour obtenir votre analyse gratuite.",
      hintEmail: "Nous vous demanderons votre site à l’étape suivante.",
    },
    trial: {
      tab: "Commencer l’essai gratuit",
      submit: "Commencer l’essai gratuit",
      submitEmail: "Commencer l’essai gratuit",
      hint: "Saisissez votre site pour commencer votre essai gratuit.",
      hintEmail: "Saisissez votre e-mail pour commencer votre essai gratuit.",
    },
    websiteLabel: "Adresse du site web",
    emailLabel: "Adresse e-mail",
    websitePlaceholder: "votresite.com",
    emailPlaceholder: "you@yourcompany.com",
    useEmail: "Utiliser votre e-mail à la place",
    useWebsite: "Utiliser votre site à la place",
    emptyWebsite: "Saisissez l’adresse de votre site.",
    emptyEmail: "Saisissez votre adresse e-mail.",
    invalidWebsite: "Saisissez une adresse de site valide, par exemple votresite.com.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
  },
  points: ["Gratuit pour commencer", "Privé et sécurisé", "Support humain 24 h/24, 7 j/7"],
  pills: ["SEO", "Visibilité IA", "Réseaux", "Backlinks"],
  panelTitle: "Tout ce qu’il vous faut pour grandir.",
  panelBody: "Soyez visible dans les recherches et les réponses des IA, puis transformez vos idées en contenus efficaces sur tous vos canaux.",
  items: [
    { title: "Découvrez ce qui vous freine", body: "Trouvez des opportunités grâce à un audit de votre site et à des suggestions concrètes." },
    { title: "Créez du contenu pour la recherche et les réseaux", body: "Publiez des articles SEO, puis transformez-les en publications, reels et carrousels." },
    { title: "Renforcez votre autorité et votre visibilité", body: "Développez votre présence grâce aux backlinks et aux outils de visibilité dans la recherche IA." },
    { title: "Laissez Growth AI Copilot vous guider", body: "Planifiez vos prochaines étapes et passez à l’action avec les bons outils." },
  ],
  sideNote: "Conçu pour les petites entreprises. Pensé pour grandir avec vous.",
};

const it: FinalCtaCopy = {
  kicker: "La Sua crescita inizia qui",
  titleLead: "Pronto ad avere più clienti?",
  titleAccent: "Realizziamolo insieme.",
  desc: "Si faccia trovare su Google e nella ricerca IA, faccia crescere la Sua presenza social e raggiunga più clienti. Tutto con RepGet.",
  form: {
    startLabel: "Scelga come vuole iniziare",
    tabsLabel: "Modi gratuiti per iniziare con RepGet",
    audit: {
      tab: "Controlla il mio sito",
      submit: "Controlla il mio sito gratis",
      submitEmail: "Continui con l’email",
      hint: "Inserisca il Suo sito per ricevere il controllo gratuito.",
      hintEmail: "Le chiederemo il Suo sito nel passaggio successivo.",
    },
    trial: {
      tab: "Inizi la prova gratuita",
      submit: "Inizi la prova gratuita",
      submitEmail: "Inizi la prova gratuita",
      hint: "Inserisca il Suo sito per iniziare la prova gratuita.",
      hintEmail: "Inserisca la Sua email per iniziare la prova gratuita.",
    },
    websiteLabel: "Indirizzo del sito",
    emailLabel: "Indirizzo email",
    websitePlaceholder: "ilsuosito.com",
    emailPlaceholder: "you@yourcompany.com",
    useEmail: "Usi l’email al suo posto",
    useWebsite: "Usi il sito al suo posto",
    emptyWebsite: "Inserisca l’indirizzo del Suo sito.",
    emptyEmail: "Inserisca il Suo indirizzo email.",
    invalidWebsite: "Inserisca un indirizzo valido, ad esempio ilsuosito.com.",
    invalidEmail: "Inserisca un indirizzo email valido.",
  },
  points: ["Gratis per iniziare", "Privato e sicuro", "Assistenza umana 24/7"],
  pills: ["SEO", "Visibilità IA", "Social", "Backlink"],
  panelTitle: "Tutto ciò che Le serve per crescere.",
  panelBody: "Si faccia trovare nelle ricerche e nelle risposte dell’IA, poi trasformi le Sue idee in contenuti efficaci su ogni canale.",
  items: [
    { title: "Scopra cosa La frena", body: "Trovi opportunità con un audit del sito e suggerimenti concreti." },
    { title: "Crei contenuti per la ricerca e i social", body: "Pubblichi articoli SEO, poi li trasformi in post, reel e caroselli." },
    { title: "Costruisca autorità e visibilità", body: "Accresca la Sua presenza con backlink e strumenti per la visibilità nella ricerca IA." },
    { title: "Si faccia guidare da Growth AI Copilot", body: "Pianifichi i prossimi passi e agisca con gli strumenti giusti." },
  ],
  sideNote: "Pensato per le piccole imprese. Progettato per crescere con Lei.",
};

const de: FinalCtaCopy = {
  kicker: "Ihr Wachstum beginnt hier",
  titleLead: "Bereit für mehr Kunden?",
  titleAccent: "Packen wir es an.",
  desc: "Werden Sie bei Google und in der KI-Suche gefunden, stärken Sie Ihre Social-Media-Präsenz und erreichen Sie mehr Kunden. Alles mit RepGet.",
  form: {
    startLabel: "Wählen Sie, wie Sie starten möchten",
    tabsLabel: "Kostenlose Wege, mit RepGet zu starten",
    audit: {
      tab: "Website prüfen",
      submit: "Website kostenlos prüfen",
      submitEmail: "Mit E-Mail fortfahren",
      hint: "Geben Sie Ihre Website ein, um Ihren kostenlosen Check zu erhalten.",
      hintEmail: "Nach Ihrer Website fragen wir im nächsten Schritt.",
    },
    trial: {
      tab: "Kostenlos testen",
      submit: "Kostenlos testen",
      submitEmail: "Kostenlos testen",
      hint: "Geben Sie Ihre Website ein, um Ihren kostenlosen Test zu starten.",
      hintEmail: "Geben Sie Ihre E-Mail-Adresse ein, um Ihren kostenlosen Test zu starten.",
    },
    websiteLabel: "Website-Adresse",
    emailLabel: "E-Mail-Adresse",
    websitePlaceholder: "ihrewebsite.de",
    emailPlaceholder: "you@yourcompany.com",
    useEmail: "Stattdessen E-Mail verwenden",
    useWebsite: "Stattdessen Website verwenden",
    emptyWebsite: "Geben Sie Ihre Website-Adresse ein.",
    emptyEmail: "Geben Sie Ihre E-Mail-Adresse ein.",
    invalidWebsite: "Geben Sie eine gültige Website-Adresse ein, z. B. ihrewebsite.de.",
    invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
  },
  points: ["Kostenlos starten", "Privat und sicher", "Menschlicher Support rund um die Uhr"],
  pills: ["SEO", "KI-Sichtbarkeit", "Social", "Backlinks"],
  panelTitle: "Alles, was Sie für Ihr Wachstum brauchen.",
  panelBody: "Werden Sie in Suchergebnissen und KI-Antworten gefunden und machen Sie aus Ihren Ideen Inhalte, die auf jedem Kanal funktionieren.",
  items: [
    { title: "Finden Sie heraus, was Sie bremst", body: "Entdecken Sie Chancen mit einem Website-Audit und konkreten Vorschlägen." },
    { title: "Content für Suche und Social erstellen", body: "Veröffentlichen Sie SEO-Artikel und machen Sie daraus Posts, Reels und Karussells." },
    { title: "Autorität und Sichtbarkeit aufbauen", body: "Stärken Sie Ihre Präsenz mit Backlinks und Tools für Sichtbarkeit in der KI-Suche." },
    { title: "Lassen Sie sich vom Growth AI Copilot leiten", body: "Planen Sie Ihre nächsten Schritte und handeln Sie mit den richtigen Tools." },
  ],
  sideNote: "Für kleine Unternehmen gemacht. Wächst mit Ihnen.",
};

const COPY: Record<Locale, FinalCtaCopy> = { en, es, fr, it, de };

export function finalCtaCopy(locale: Locale): FinalCtaCopy {
  return COPY[locale] ?? en;
}
