import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's closing banner (client's design, 2026-11-03: "the call to
 * action banner at the end is different"), in every language.
 *
 * `{n}` is FREE_ARTICLES (lib/plans/features.ts), the number sign-up really
 * grants, so the button cannot promise more articles than the account gets.
 */

export type FinalCtaCopy = {
  kicker: string;
  titleLead: string;
  titleAccent: string;
  desc: string;
  form: {
    websiteLabel: string;
    emailLabel: string;
    websitePlaceholder: string;
    emailPlaceholder: string;
    submit: string;
    under: string;
    useEmail: string;
    useWebsite: string;
    emptyWebsite: string;
    emptyEmail: string;
    invalidWebsite: string;
    invalidEmail: string;
  };
  /** aria-label of the two buttons. */
  quickLabel: string;
  checkFree: string;
  createFree: string;
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
    websiteLabel: "Website address",
    emailLabel: "Email address",
    websitePlaceholder: "yourwebsite.com",
    emailPlaceholder: "demo@gmail.com",
    submit: "Start free trial",
    under: "Enter your website or email to get started.",
    useEmail: "Use your email instead",
    useWebsite: "Use your website instead",
    emptyWebsite: "Enter your website address.",
    emptyEmail: "Enter your email address.",
    invalidWebsite: "Enter a valid website address, such as yourwebsite.com.",
    invalidEmail: "Enter a valid email address.",
  },
  quickLabel: "Other ways to get started",
  checkFree: "Check my website for free",
  createFree: "Create {n} Articles for Free",
  points: ["Private and secure", "24/7 human support", "Search, AI & social in one place"],
  pills: ["SEO", "AI Visibility", "Social", "Backlinks"],
  panelTitle: "Everything you need to grow.",
  panelBody: "Be discovered in search and AI answers, then turn your ideas into social posts, reels and carousels for every connected channel.",
  items: [
    { title: "Discover what holds you back", body: "Start with a website audit and actionable improvements." },
    { title: "Create content for search and social", body: "Publish SEO articles, then adapt them into social posts, reels and carousels." },
    { title: "Build authority and visibility", body: "Work on backlinks and presence across AI search." },
    { title: "Let Growth AI Copilot guide you", body: "Plan and review your next actions without juggling tools." },
  ],
  sideNote: "Built for small businesses. Designed to scale with you.",
};

const es: FinalCtaCopy = {
  kicker: "Su crecimiento empieza aquí",
  titleLead: "¿Listo para conseguir más clientes?",
  titleAccent: "Hagámoslo realidad.",
  desc: "Hágase visible en Google y en la búsqueda con IA, haga crecer su presencia en redes y llegue a más clientes. Todo con RepGet.",
  form: {
    websiteLabel: "Dirección del sitio web",
    emailLabel: "Correo electrónico",
    websitePlaceholder: "susitioweb.com",
    emailPlaceholder: "demo@gmail.com",
    submit: "Empezar la prueba gratis",
    under: "Introduzca su sitio web o su correo para empezar.",
    useEmail: "Usar su correo en su lugar",
    useWebsite: "Usar su sitio web en su lugar",
    emptyWebsite: "Introduzca la dirección de su sitio web.",
    emptyEmail: "Introduzca su correo electrónico.",
    invalidWebsite: "Introduzca una dirección web válida, como susitioweb.com.",
    invalidEmail: "Introduzca un correo electrónico válido.",
  },
  quickLabel: "Otras formas de empezar",
  checkFree: "Analizar mi web gratis",
  createFree: "Cree {n} artículos gratis",
  points: ["Privado y seguro", "Soporte humano 24/7", "Búsqueda, IA y redes en un solo lugar"],
  pills: ["SEO", "Visibilidad en IA", "Redes", "Backlinks"],
  panelTitle: "Todo lo que necesita para crecer.",
  panelBody: "Hágase visible en las búsquedas y en las respuestas de la IA, y convierta sus ideas en publicaciones, reels y carruseles para cada canal conectado.",
  items: [
    { title: "Descubra qué le frena", body: "Empiece con una auditoría de su sitio web y mejoras concretas." },
    { title: "Cree contenido para búsquedas y redes", body: "Publique artículos SEO y adáptelos en publicaciones, reels y carruseles." },
    { title: "Gane autoridad y visibilidad", body: "Trabaje los backlinks y su presencia en la búsqueda con IA." },
    { title: "Deje que Growth AI Copilot le guíe", body: "Planifique y revise sus próximas acciones sin saltar entre herramientas." },
  ],
  sideNote: "Pensado para pequeñas empresas. Diseñado para crecer con usted.",
};

const fr: FinalCtaCopy = {
  kicker: "Votre croissance commence ici",
  titleLead: "Prêt à gagner plus de clients ?",
  titleAccent: "Passons à l’action.",
  desc: "Soyez visible sur Google et dans la recherche IA, développez votre présence sociale et touchez plus de clients. Le tout avec RepGet.",
  form: {
    websiteLabel: "Adresse du site web",
    emailLabel: "Adresse e-mail",
    websitePlaceholder: "votresite.com",
    emailPlaceholder: "demo@gmail.com",
    submit: "Commencer l’essai gratuit",
    under: "Saisissez votre site ou votre e-mail pour commencer.",
    useEmail: "Utiliser votre e-mail à la place",
    useWebsite: "Utiliser votre site à la place",
    emptyWebsite: "Saisissez l’adresse de votre site.",
    emptyEmail: "Saisissez votre adresse e-mail.",
    invalidWebsite: "Saisissez une adresse de site valide, par exemple votresite.com.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
  },
  quickLabel: "Autres façons de commencer",
  checkFree: "Analyser mon site gratuitement",
  createFree: "Créez {n} articles gratuitement",
  points: ["Privé et sécurisé", "Support humain 24 h/24, 7 j/7", "Recherche, IA et réseaux au même endroit"],
  pills: ["SEO", "Visibilité IA", "Réseaux", "Backlinks"],
  panelTitle: "Tout ce qu’il vous faut pour grandir.",
  panelBody: "Soyez visible dans les recherches et les réponses des IA, puis transformez vos idées en publications, reels et carrousels pour chaque canal connecté.",
  items: [
    { title: "Découvrez ce qui vous freine", body: "Commencez par un audit de votre site et des améliorations concrètes." },
    { title: "Créez du contenu pour la recherche et les réseaux", body: "Publiez des articles SEO, puis adaptez-les en publications, reels et carrousels." },
    { title: "Renforcez votre autorité et votre visibilité", body: "Travaillez vos backlinks et votre présence dans la recherche IA." },
    { title: "Laissez Growth AI Copilot vous guider", body: "Planifiez et validez vos prochaines actions sans jongler entre les outils." },
  ],
  sideNote: "Conçu pour les petites entreprises. Pensé pour grandir avec vous.",
};

const it: FinalCtaCopy = {
  kicker: "La Sua crescita inizia qui",
  titleLead: "Pronto ad avere più clienti?",
  titleAccent: "Realizziamolo insieme.",
  desc: "Si faccia trovare su Google e nella ricerca IA, faccia crescere la Sua presenza social e raggiunga più clienti. Tutto con RepGet.",
  form: {
    websiteLabel: "Indirizzo del sito",
    emailLabel: "Indirizzo email",
    websitePlaceholder: "ilsuosito.com",
    emailPlaceholder: "demo@gmail.com",
    submit: "Inizi la prova gratuita",
    under: "Inserisca il Suo sito o la Sua email per iniziare.",
    useEmail: "Usi l’email al suo posto",
    useWebsite: "Usi il sito al suo posto",
    emptyWebsite: "Inserisca l’indirizzo del Suo sito.",
    emptyEmail: "Inserisca il Suo indirizzo email.",
    invalidWebsite: "Inserisca un indirizzo valido, ad esempio ilsuosito.com.",
    invalidEmail: "Inserisca un indirizzo email valido.",
  },
  quickLabel: "Altri modi per iniziare",
  checkFree: "Controlla il mio sito gratis",
  createFree: "Crei {n} articoli gratis",
  points: ["Privato e sicuro", "Assistenza umana 24/7", "Ricerca, IA e social in un unico posto"],
  pills: ["SEO", "Visibilità IA", "Social", "Backlink"],
  panelTitle: "Tutto ciò che Le serve per crescere.",
  panelBody: "Si faccia trovare nelle ricerche e nelle risposte dell’IA, poi trasformi le Sue idee in post, reel e caroselli per ogni canale collegato.",
  items: [
    { title: "Scopra cosa La frena", body: "Inizi con un audit del sito e miglioramenti concreti." },
    { title: "Crei contenuti per la ricerca e i social", body: "Pubblichi articoli SEO, poi li trasformi in post, reel e caroselli." },
    { title: "Costruisca autorità e visibilità", body: "Lavori sui backlink e sulla presenza nella ricerca IA." },
    { title: "Si faccia guidare da Growth AI Copilot", body: "Pianifichi e riveda le prossime azioni senza destreggiarsi tra più strumenti." },
  ],
  sideNote: "Pensato per le piccole imprese. Progettato per crescere con Lei.",
};

const de: FinalCtaCopy = {
  kicker: "Ihr Wachstum beginnt hier",
  titleLead: "Bereit für mehr Kunden?",
  titleAccent: "Packen wir es an.",
  desc: "Werden Sie bei Google und in der KI-Suche gefunden, stärken Sie Ihre Social-Media-Präsenz und erreichen Sie mehr Kunden. Alles mit RepGet.",
  form: {
    websiteLabel: "Website-Adresse",
    emailLabel: "E-Mail-Adresse",
    websitePlaceholder: "ihrewebsite.de",
    emailPlaceholder: "demo@gmail.com",
    submit: "Kostenlos testen",
    under: "Geben Sie Ihre Website oder E-Mail-Adresse ein, um zu starten.",
    useEmail: "Stattdessen E-Mail verwenden",
    useWebsite: "Stattdessen Website verwenden",
    emptyWebsite: "Geben Sie Ihre Website-Adresse ein.",
    emptyEmail: "Geben Sie Ihre E-Mail-Adresse ein.",
    invalidWebsite: "Geben Sie eine gültige Website-Adresse ein, z. B. ihrewebsite.de.",
    invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
  },
  quickLabel: "Weitere Möglichkeiten zum Start",
  checkFree: "Website kostenlos prüfen",
  createFree: "{n} Artikel kostenlos erstellen",
  points: ["Privat und sicher", "Menschlicher Support rund um die Uhr", "Suche, KI & Social an einem Ort"],
  pills: ["SEO", "KI-Sichtbarkeit", "Social", "Backlinks"],
  panelTitle: "Alles, was Sie für Ihr Wachstum brauchen.",
  panelBody: "Werden Sie in Suchergebnissen und KI-Antworten gefunden und machen Sie aus Ihren Ideen Social-Posts, Reels und Karussells für jeden verbundenen Kanal.",
  items: [
    { title: "Finden Sie heraus, was Sie bremst", body: "Starten Sie mit einem Website-Audit und konkreten Verbesserungen." },
    { title: "Content für Suche und Social erstellen", body: "Veröffentlichen Sie SEO-Artikel und machen Sie daraus Social-Posts, Reels und Karussells." },
    { title: "Autorität und Sichtbarkeit aufbauen", body: "Arbeiten Sie an Backlinks und Ihrer Präsenz in der KI-Suche." },
    { title: "Lassen Sie sich vom Growth AI Copilot leiten", body: "Planen und prüfen Sie Ihre nächsten Schritte, ohne zwischen Tools zu wechseln." },
  ],
  sideNote: "Für kleine Unternehmen gemacht. Wächst mit Ihnen.",
};

const COPY: Record<Locale, FinalCtaCopy> = { en, es, fr, it, de };

export function finalCtaCopy(locale: Locale): FinalCtaCopy {
  return COPY[locale] ?? en;
}
