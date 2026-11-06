import type { Locale } from "@/lib/i18n/config";

/**
 * The public /website-creation page (client's design, RepGet_Website_Final.html,
 * 2026-11-05), in five languages.
 *
 * WHERE THIS SAYS SOMETHING THE DESIGN DOES NOT. The design sells "development
 * credits" bought up front, before a brief. There is no such wallet and no
 * tariff, so the steps here are the real ones: account, brief, an agreed scope
 * with a price in ordinary credits, then the work. No price, deadline or named
 * person appears anywhere on this page; a quote sets the price per project.
 */
export type WebsiteCreationCopy = {
  metaTitle: string;
  metaDescription: string;
  hero: {
    kicker: string;
    title: string;
    titleEm: string;
    introStrong: string;
    intro: string;
    introLast: string;
    switchLabel: string;
    choiceNew: string;
    choiceRedesign: string;
    labelNew: string;
    labelRedesign: string;
    submitNew: string;
    submitRedesign: string;
    helpNew: string;
    helpRedesign: string;
    formLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    emptyEmail: string;
    invalidEmail: string;
    stepsLabel: string;
    steps: [string, string, string];
    explore: string;
    corner: string;
  };
  next: { strong: string; items: string; link: string };
  strip: { a: string; b: string; c: string; label: string; items: { title: string; body: string }[] };
  work: {
    kicker: string;
    title: string;
    titleEm: string;
    body: string;
    liveChip: string;
    realLabel: string;
    conceptLabel: string;
    openImageStudio: string;
    visit: string;
    similar: string;
    honesty: string;
    imageStudio: { sub: string; body: string };
    aurenia: { sub: string; body: string; alt: string };
    forme: { sub: string; body: string; alt: string };
  };
  process: { kicker: string; title: string; titleEm: string; body: string; steps: { index: string; title: string; body: string }[] };
  credits: {
    kicker: string;
    title: string;
    titleEm: string;
    sub: string;
    bullets: string[];
    link: string;
    demoLabel: string;
    demoBadge: string;
    demoNav: [string, string, string, string];
    demoHead: string;
    demoSub: string;
    demoStatus: string;
    demoExample: string;
    demoCreditsLabel: string;
    demoCreditsValue: string;
    demoProjectLabel: string;
    demoProjectValue: string;
    demoFoot: string;
    demoCaption: string;
  };
  included: { kicker: string; title: string; titleEm: string; body: string; items: { title: string; body: string }[] };
  faq: { kicker: string; title: string; body: string; contact: string; items: { q: string; a: string }[] };
  cta: { kicker: string; title: string; titleEm: string; body: string; formLabel: string; submit: string; noteBefore: string; noteLink: string; noteAfter: string };
};

export const WEBSITE_CREATION_COPY: Record<Locale, WebsiteCreationCopy> = {
  en: {
    metaTitle: "Website Design & Redesign by Real People",
    metaDescription: "Need a new website or a redesign of your current one? Send a brief, agree the scope and a price in credits with our team, and start from your RepGet account.",
    hero: {
      kicker: "CUSTOM WEBSITES & REDESIGNS",
      title: "Not just a website.",
      titleEm: "Something worth remembering.",
      introStrong: "Starting from scratch or ready for a complete revamp?",
      intro: "Our experienced designers and developers create beautiful new websites and transform outdated ones into something you are proud to share.",
      introLast: "Real people. Custom design. No AI-generated templates.",
      switchLabel: "What kind of website project do you need?",
      choiceNew: "Build a new website",
      choiceRedesign: "Redesign my website",
      labelNew: "NEED A NEW WEBSITE? START WITH YOUR EMAIL.",
      labelRedesign: "READY TO REVAMP YOUR CURRENT SITE? START WITH YOUR EMAIL.",
      submitNew: "Build my website",
      submitRedesign: "Redesign my website",
      helpNew: "Register with your email and send your brief from your RepGet dashboard. You see the agreed scope and the price in credits before anything is charged.",
      helpRedesign: "Register with your email, then tell our team about your current site. You see the agreed scope and the price in credits before anything is charged.",
      formLabel: "Create a RepGet account to start your website project",
      emailLabel: "Your email address",
      emailPlaceholder: "Enter your email address",
      emptyEmail: "Enter your email address to continue.",
      invalidEmail: "That does not look like an email address.",
      stepsLabel: "How your project starts",
      steps: ["Register with email", "Send your brief and agree a quote", "Our team builds or redesigns it"],
      explore: "EXPLORE DESIGN DIRECTIONS",
      corner: "DESIGNED BY PEOPLE / BUILT FOR WHAT'S NEXT",
    },
    next: { strong: "New builds. Better rebuilds.", items: "Custom design · Complete redesigns · Mobile · SEO-ready setup", link: "See how it works" },
    strip: {
      a: "Real websites.",
      b: "Real craftsmanship.",
      c: "Zero shortcuts.",
      label: "The RepGet website difference",
      items: [
        { title: "Tailored to your brand", body: "Not the same template as everyone else." },
        { title: "Designed & developed", body: "Thoughtful UX, clean layouts and a real build." },
        { title: "Built for what's next", body: "Start with a site. Grow with RepGet." },
      ],
    },
    work: {
      kicker: "MADE FOR YOUR BUSINESS",
      title: "A website that looks like",
      titleEm: "you.",
      body: "Real creative direction for businesses that need to look established. Explore a live brand website, then two very different custom design directions.",
      liveChip: "LIVE WEBSITE",
      realLabel: "Real website",
      conceptLabel: "Design concept",
      openImageStudio: "Open Image Studio's real website",
      visit: "Visit imagestudio.com",
      similar: "Start a similar project",
      honesty: "Image Studio is a real website. Aurenia Residences and Forme Objects are original design concepts illustrating possible directions, not claims of delivered client projects.",
      imageStudio: { sub: "01 / FILM & PHOTOGRAPHY", body: "A distinctive editorial presence for film production, photography and visual storytelling." },
      aurenia: { sub: "02 / HOSPITALITY", body: "Image-led storytelling, a distinctive sense of place and a clear booking journey.", alt: "Original luxury hospitality website design concept" },
      forme: { sub: "03 / ONLINE COMMERCE", body: "A polished shopping experience with strong product storytelling and effortless navigation.", alt: "Original premium ecommerce website design concept" },
    },
    process: {
      kicker: "SIMPLE FROM DAY ONE",
      title: "A fresh start.",
      titleEm: "Or a better version.",
      body: "Starting from zero or transforming a website you already own? The same experienced team guides your project from brief to launch.",
      steps: [
        { index: "01 / ACCOUNT", title: "Sign up with email", body: "Create your RepGet account for a new build or redesign. Your current website is optional." },
        { index: "02 / BRIEF", title: "Tell us your vision", body: "Share your goals and, for a redesign, your existing URL. Our team reviews the scope with you." },
        { index: "03 / QUOTE", title: "Accept a price in credits", body: "You see the agreed scope and its price. Add credits in your dashboard if you need more, then accept." },
        { index: "04 / LAUNCH", title: "We build or revamp", body: "Our specialists develop your new site or redesign your existing experience, then prepare for launch." },
      ],
    },
    credits: {
      kicker: "PAID WITH CREDITS",
      title: "Your project.",
      titleEm: "Your dashboard.",
      sub: "Everything starts in your RepGet account. Share your requirements, follow your project's status and pay with the same credits you use across RepGet.",
      bullets: [
        "Agree the project scope and its price in credits with our team before anything is charged.",
        "Pay from your RepGet credit balance. If you need more, buy a credit pack in your dashboard.",
        "Review design direction and work with real specialists through to launch.",
      ],
      link: "Create your account and get started",
      demoLabel: "Illustrative website project dashboard",
      demoBadge: "WEBSITE SERVICES · CONCEPT",
      demoNav: ["Overview", "Website projects", "Credits", "Settings"],
      demoHead: "Website project",
      demoSub: "Project overview",
      demoStatus: "Quote ready",
      demoExample: "Example status",
      demoCreditsLabel: "CREDITS",
      demoCreditsValue: "Add credits ↗",
      demoProjectLabel: "YOUR PROJECT",
      demoProjectValue: "Send brief ↗",
      demoFoot: "Keep your brief, your quote and your project's status together.",
      demoCaption: "Dashboard feature preview · Concept illustration, not a live account",
    },
    included: {
      kicker: "WHAT YOUR WEBSITE DESERVES",
      title: "A complete website.",
      titleEm: "Not a quick shortcut.",
      body: "Whether we build from the ground up or redesign your current site, our work is guided by your business, not an automated template.",
      items: [
        { title: "Custom visual direction", body: "An individual look aligned with your business, audience and positioning." },
        { title: "Responsive development", body: "Carefully built layouts designed to work across desktop, tablet and mobile." },
        { title: "Clear navigation & structure", body: "Thoughtful page architecture that helps customers understand what you offer." },
        { title: "SEO-conscious foundations", body: "Useful content structure and discoverability considerations from the start." },
        { title: "Real people to work with", body: "Human design and development, with your brief guiding the result." },
        { title: "Room to grow with RepGet", body: "Connect website growth with content, SEO, AI visibility and social marketing." },
      ],
    },
    faq: {
      kicker: "QUESTIONS, ANSWERED",
      title: "Everything you need to know.",
      body: "Every business is different. We'll help define your project before development begins.",
      contact: "Speak with our team",
      items: [
        { q: "Is this an AI-generated website?", a: "No. This service is positioned around work carried out by human web designers and developers. AI can assist with supporting tasks, but your website is not simply an automatically generated template." },
        { q: "Can I start if I don't have a website or domain?", a: "Absolutely. Create a RepGet account using your email. You can discuss domain choices and your project's requirements during briefing." },
        { q: "Can you redesign or revamp my existing website?", a: "Yes. We can review your current website, refresh its visual identity, improve navigation and mobile layouts, and rebuild pages or functionality where needed. Share your URL and goals in your brief so our team can agree the scope and its price in credits with you." },
        { q: "How do credits pay for a website?", a: "Website work is paid with the same credits as everything else in RepGet; there is no separate currency. The number required depends on the agreed scope, design complexity, pages and functionality, so each project is quoted individually. You see the price before you accept, and nothing is charged until you do." },
        { q: "Can you build an online store or a portfolio?", a: "Yes, these are common project types to discuss. Tell us what you need in your brief. The team will confirm suitability, platform choice and development scope." },
        { q: "How long does a new website or redesign take?", a: "Timing depends on complexity, content readiness, feedback and integrations, so we do not publish a fixed timeline. Ask about timing when the requirements are reviewed." },
        { q: "What happens after my website is launched?", a: "You can use RepGet's SEO, content, backlinks, AI visibility and social tools to help attract customers. Ongoing maintenance and additional development can be scoped separately." },
      ],
    },
    cta: {
      kicker: "NEW WEBSITE OR COMPLETE REDESIGN",
      title: "Build something new.",
      titleEm: "Or make it better.",
      body: "Starting without a website? We'll build it. Already have one that needs a serious upgrade? We'll redesign it. Real designers and developers, one simple starting point.",
      formLabel: "Create your RepGet account",
      submit: "Get started",
      noteBefore: "Continue to",
      noteLink: "secure RepGet registration",
      noteAfter: "No website needed to get started.",
    },
  },
  es: {
    metaTitle: "Diseño y rediseño web hecho por personas",
    metaDescription: "¿Necesita un sitio web nuevo o rediseñar el actual? Envíe un briefing y acuerde el alcance y un precio en créditos con nuestro equipo desde su cuenta.",
    hero: {
      kicker: "SITIOS WEB A MEDIDA Y REDISEÑOS",
      title: "No es solo un sitio web.",
      titleEm: "Es algo digno de recordar.",
      introStrong: "¿Empieza desde cero o está listo para una renovación completa?",
      intro: "Nuestros diseñadores y desarrolladores con experiencia crean sitios web nuevos y atractivos, y transforman los anticuados en algo que le enorgullezca compartir.",
      introLast: "Personas reales. Diseño a medida. Sin plantillas generadas por IA.",
      switchLabel: "¿Qué tipo de proyecto web necesita?",
      choiceNew: "Crear un sitio web nuevo",
      choiceRedesign: "Rediseñar mi sitio web",
      labelNew: "¿NECESITA UN SITIO WEB NUEVO? EMPIECE CON SU CORREO.",
      labelRedesign: "¿LISTO PARA RENOVAR SU SITIO ACTUAL? EMPIECE CON SU CORREO.",
      submitNew: "Crear mi sitio web",
      submitRedesign: "Rediseñar mi sitio web",
      helpNew: "Regístrese con su correo y envíe su briefing desde su panel de RepGet. Verá el alcance acordado y el precio en créditos antes de que se cobre nada.",
      helpRedesign: "Regístrese con su correo y cuéntenos sobre su sitio actual. Verá el alcance acordado y el precio en créditos antes de que se cobre nada.",
      formLabel: "Cree una cuenta de RepGet para iniciar su proyecto web",
      emailLabel: "Su dirección de correo",
      emailPlaceholder: "Introduzca su correo electrónico",
      emptyEmail: "Introduzca su correo electrónico para continuar.",
      invalidEmail: "Eso no parece una dirección de correo.",
      stepsLabel: "Cómo empieza su proyecto",
      steps: ["Regístrese con su correo", "Envíe su briefing y acuerde un presupuesto", "Nuestro equipo lo crea o rediseña"],
      explore: "EXPLORAR DIRECCIONES DE DISEÑO",
      corner: "DISEÑADO POR PERSONAS / HECHO PARA LO QUE VIENE",
    },
    next: { strong: "Sitios nuevos. Mejores versiones.", items: "Diseño a medida · Rediseños completos · Móvil · Base preparada para SEO", link: "Vea cómo funciona" },
    strip: {
      a: "Sitios reales.",
      b: "Oficio real.",
      c: "Sin atajos.",
      label: "Lo que distingue a los sitios web de RepGet",
      items: [
        { title: "A la medida de su marca", body: "No la misma plantilla que todos los demás." },
        { title: "Diseñado y desarrollado", body: "Experiencia cuidada, diseños limpios y una construcción real." },
        { title: "Preparado para lo que viene", body: "Empiece con un sitio. Crezca con RepGet." },
      ],
    },
    work: {
      kicker: "HECHO PARA SU NEGOCIO",
      title: "Un sitio web que se parece a",
      titleEm: "usted.",
      body: "Dirección creativa real para negocios que necesitan transmitir solidez. Explore un sitio de marca en vivo y dos direcciones de diseño a medida muy diferentes.",
      liveChip: "SITIO EN VIVO",
      realLabel: "Sitio real",
      conceptLabel: "Concepto de diseño",
      openImageStudio: "Abrir el sitio web real de Image Studio",
      visit: "Visitar imagestudio.com",
      similar: "Iniciar un proyecto similar",
      honesty: "Image Studio es un sitio web real. Aurenia Residences y Forme Objects son conceptos de diseño originales que ilustran posibles direcciones, no proyectos entregados a clientes.",
      imageStudio: { sub: "01 / CINE Y FOTOGRAFÍA", body: "Una presencia editorial distintiva para producción de cine, fotografía y narración visual." },
      aurenia: { sub: "02 / HOSTELERÍA", body: "Narración basada en imágenes, un sentido propio del lugar y un recorrido de reserva claro.", alt: "Concepto original de sitio web para hostelería de lujo" },
      forme: { sub: "03 / COMERCIO ONLINE", body: "Una experiencia de compra cuidada, con una historia de producto sólida y una navegación sencilla.", alt: "Concepto original de sitio web para comercio electrónico premium" },
    },
    process: {
      kicker: "SENCILLO DESDE EL PRIMER DÍA",
      title: "Un nuevo comienzo.",
      titleEm: "O una versión mejor.",
      body: "¿Empieza de cero o quiere transformar el sitio que ya tiene? El mismo equipo con experiencia guía su proyecto desde el briefing hasta el lanzamiento.",
      steps: [
        { index: "01 / CUENTA", title: "Regístrese con su correo", body: "Cree su cuenta de RepGet para un sitio nuevo o un rediseño. Su sitio actual es opcional." },
        { index: "02 / BRIEFING", title: "Cuéntenos su visión", body: "Comparta sus objetivos y, para un rediseño, su URL actual. Nuestro equipo revisa el alcance con usted." },
        { index: "03 / PRESUPUESTO", title: "Acepte un precio en créditos", body: "Verá el alcance acordado y su precio. Añada créditos en su panel si necesita más y acéptelo." },
        { index: "04 / LANZAMIENTO", title: "Creamos o renovamos", body: "Nuestros especialistas desarrollan su sitio nuevo o rediseñan el actual y lo preparan para el lanzamiento." },
      ],
    },
    credits: {
      kicker: "SE PAGA CON CRÉDITOS",
      title: "Su proyecto.",
      titleEm: "Su panel.",
      sub: "Todo empieza en su cuenta de RepGet. Comparta sus requisitos, siga el estado de su proyecto y pague con los mismos créditos que usa en todo RepGet.",
      bullets: [
        "Acuerde con nuestro equipo el alcance y su precio en créditos antes de que se cobre nada.",
        "Pague con su saldo de créditos de RepGet. Si necesita más, compre un paquete en su panel.",
        "Revise la dirección de diseño y trabaje con especialistas reales hasta el lanzamiento.",
      ],
      link: "Cree su cuenta y empiece",
      demoLabel: "Panel ilustrativo de un proyecto web",
      demoBadge: "SERVICIOS WEB · CONCEPTO",
      demoNav: ["Resumen", "Proyectos web", "Créditos", "Ajustes"],
      demoHead: "Proyecto web",
      demoSub: "Resumen del proyecto",
      demoStatus: "Presupuesto listo",
      demoExample: "Estado de ejemplo",
      demoCreditsLabel: "CRÉDITOS",
      demoCreditsValue: "Añadir créditos ↗",
      demoProjectLabel: "SU PROYECTO",
      demoProjectValue: "Enviar briefing ↗",
      demoFoot: "Tenga juntos su briefing, su presupuesto y el estado del proyecto.",
      demoCaption: "Vista previa de la función · Ilustración conceptual, no una cuenta real",
    },
    included: {
      kicker: "LO QUE SU SITIO MERECE",
      title: "Un sitio web completo.",
      titleEm: "No un atajo rápido.",
      body: "Tanto si lo creamos desde cero como si rediseñamos el actual, nuestro trabajo se guía por su negocio, no por una plantilla automática.",
      items: [
        { title: "Dirección visual a medida", body: "Una imagen propia, alineada con su negocio, su público y su posicionamiento." },
        { title: "Desarrollo adaptable", body: "Diseños construidos con cuidado para funcionar en ordenador, tableta y móvil." },
        { title: "Navegación y estructura claras", body: "Una arquitectura de páginas pensada para que los clientes entiendan lo que ofrece." },
        { title: "Bases orientadas al SEO", body: "Estructura de contenido útil y atención a la visibilidad desde el principio." },
        { title: "Personas reales con quienes trabajar", body: "Diseño y desarrollo humanos, con su briefing guiando el resultado." },
        { title: "Margen para crecer con RepGet", body: "Conecte el crecimiento del sitio con contenido, SEO, visibilidad en IA y marketing social." },
      ],
    },
    faq: {
      kicker: "PREGUNTAS Y RESPUESTAS",
      title: "Todo lo que necesita saber.",
      body: "Cada negocio es diferente. Le ayudaremos a definir su proyecto antes de que empiece el desarrollo.",
      contact: "Hable con nuestro equipo",
      items: [
        { q: "¿Es un sitio web generado por IA?", a: "No. Este servicio se basa en el trabajo de diseñadores y desarrolladores web humanos. La IA puede ayudar en tareas de apoyo, pero su sitio no es simplemente una plantilla generada automáticamente." },
        { q: "¿Puedo empezar si no tengo sitio web ni dominio?", a: "Por supuesto. Cree una cuenta de RepGet con su correo. Podrá hablar de las opciones de dominio y de los requisitos de su proyecto durante el briefing." },
        { q: "¿Pueden rediseñar o renovar mi sitio actual?", a: "Sí. Podemos revisar su sitio actual, renovar su identidad visual, mejorar la navegación y la versión móvil, y reconstruir páginas o funciones cuando haga falta. Indique su URL y sus objetivos en el briefing para que nuestro equipo acuerde con usted el alcance y su precio en créditos." },
        { q: "¿Cómo se paga un sitio web con créditos?", a: "El trabajo web se paga con los mismos créditos que todo lo demás en RepGet; no hay otra moneda. La cantidad depende del alcance acordado, la complejidad del diseño, las páginas y las funciones, por lo que cada proyecto se presupuesta por separado. Verá el precio antes de aceptar y no se cobra nada hasta que lo haga." },
        { q: "¿Pueden crear una tienda online o un portfolio?", a: "Sí, son tipos de proyecto habituales. Indique lo que necesita en su briefing. El equipo confirmará la viabilidad, la plataforma y el alcance del desarrollo." },
        { q: "¿Cuánto tarda un sitio nuevo o un rediseño?", a: "El plazo depende de la complejidad, de que el contenido esté listo, de los comentarios y de las integraciones, por lo que no publicamos un plazo fijo. Pregunte por los plazos cuando se revisen los requisitos." },
        { q: "¿Qué ocurre después del lanzamiento?", a: "Puede usar las herramientas de SEO, contenido, backlinks, visibilidad en IA y redes sociales de RepGet para atraer clientes. El mantenimiento continuo y otros desarrollos pueden definirse por separado." },
      ],
    },
    cta: {
      kicker: "SITIO WEB NUEVO O REDISEÑO COMPLETO",
      title: "Cree algo nuevo.",
      titleEm: "O mejórelo.",
      body: "¿Empieza sin sitio web? Lo creamos. ¿Ya tiene uno que necesita una mejora seria? Lo rediseñamos. Diseñadores y desarrolladores reales, un único punto de partida.",
      formLabel: "Cree su cuenta de RepGet",
      submit: "Empezar",
      noteBefore: "Continúe al",
      noteLink: "registro seguro de RepGet",
      noteAfter: "No necesita un sitio web para empezar.",
    },
  },
  fr: {
    metaTitle: "Création et refonte de site par de vraies personnes",
    metaDescription: "Besoin d'un nouveau site ou d'une refonte ? Envoyez un brief, convenez du périmètre et d'un prix en crédits avec notre équipe, depuis votre compte RepGet.",
    hero: {
      kicker: "SITES SUR MESURE ET REFONTES",
      title: "Pas seulement un site web.",
      titleEm: "Quelque chose de mémorable.",
      introStrong: "Vous partez de zéro ou vous êtes prêt pour une refonte complète ?",
      intro: "Nos designers et développeurs expérimentés créent de beaux sites et transforment les sites vieillissants en quelque chose que vous serez fier de partager.",
      introLast: "De vraies personnes. Un design sur mesure. Aucun modèle généré par IA.",
      switchLabel: "De quel type de projet avez-vous besoin ?",
      choiceNew: "Créer un nouveau site",
      choiceRedesign: "Refondre mon site",
      labelNew: "BESOIN D'UN NOUVEAU SITE ? COMMENCEZ AVEC VOTRE E-MAIL.",
      labelRedesign: "PRÊT À REFONDRE VOTRE SITE ? COMMENCEZ AVEC VOTRE E-MAIL.",
      submitNew: "Créer mon site",
      submitRedesign: "Refondre mon site",
      helpNew: "Inscrivez-vous avec votre e-mail et envoyez votre brief depuis votre tableau de bord RepGet. Vous voyez le périmètre convenu et le prix en crédits avant tout débit.",
      helpRedesign: "Inscrivez-vous avec votre e-mail et parlez-nous de votre site actuel. Vous voyez le périmètre convenu et le prix en crédits avant tout débit.",
      formLabel: "Créez un compte RepGet pour démarrer votre projet de site",
      emailLabel: "Votre adresse e-mail",
      emailPlaceholder: "Saisissez votre adresse e-mail",
      emptyEmail: "Saisissez votre adresse e-mail pour continuer.",
      invalidEmail: "Cela ne ressemble pas à une adresse e-mail.",
      stepsLabel: "Comment démarre votre projet",
      steps: ["Inscrivez-vous par e-mail", "Envoyez votre brief et convenez d'un devis", "Notre équipe le crée ou le refond"],
      explore: "DÉCOUVRIR DES DIRECTIONS DE DESIGN",
      corner: "CONÇU PAR DES PERSONNES / PENSÉ POUR LA SUITE",
    },
    next: { strong: "De nouveaux sites. De meilleures refontes.", items: "Design sur mesure · Refontes complètes · Mobile · Base prête pour le SEO", link: "Voir comment ça marche" },
    strip: {
      a: "De vrais sites.",
      b: "Un vrai savoir-faire.",
      c: "Aucun raccourci.",
      label: "Ce qui distingue les sites RepGet",
      items: [
        { title: "Adapté à votre marque", body: "Pas le même modèle que tout le monde." },
        { title: "Conçu et développé", body: "Une expérience réfléchie, des mises en page soignées, une vraie réalisation." },
        { title: "Pensé pour la suite", body: "Commencez par un site. Grandissez avec RepGet." },
      ],
    },
    work: {
      kicker: "CONÇU POUR VOTRE ACTIVITÉ",
      title: "Un site qui vous",
      titleEm: "ressemble.",
      body: "Une vraie direction créative pour les entreprises qui doivent inspirer confiance. Découvrez un site de marque en ligne, puis deux directions de design sur mesure très différentes.",
      liveChip: "SITE EN LIGNE",
      realLabel: "Site réel",
      conceptLabel: "Concept de design",
      openImageStudio: "Ouvrir le vrai site d'Image Studio",
      visit: "Visiter imagestudio.com",
      similar: "Démarrer un projet similaire",
      honesty: "Image Studio est un vrai site. Aurenia Residences et Forme Objects sont des concepts de design originaux illustrant des directions possibles, et non des projets livrés à des clients.",
      imageStudio: { sub: "01 / FILM ET PHOTOGRAPHIE", body: "Une présence éditoriale singulière pour la production de films, la photographie et le récit visuel." },
      aurenia: { sub: "02 / HÔTELLERIE", body: "Un récit porté par l'image, une vraie identité de lieu et un parcours de réservation clair.", alt: "Concept original de site web pour l'hôtellerie de luxe" },
      forme: { sub: "03 / COMMERCE EN LIGNE", body: "Une expérience d'achat soignée, un récit produit fort et une navigation sans effort.", alt: "Concept original de site de commerce en ligne haut de gamme" },
    },
    process: {
      kicker: "SIMPLE DÈS LE PREMIER JOUR",
      title: "Un nouveau départ.",
      titleEm: "Ou une meilleure version.",
      body: "Vous partez de zéro ou vous transformez un site existant ? La même équipe expérimentée accompagne votre projet du brief au lancement.",
      steps: [
        { index: "01 / COMPTE", title: "Inscrivez-vous par e-mail", body: "Créez votre compte RepGet pour un nouveau site ou une refonte. Votre site actuel est facultatif." },
        { index: "02 / BRIEF", title: "Partagez votre vision", body: "Indiquez vos objectifs et, pour une refonte, votre URL actuelle. Notre équipe examine le périmètre avec vous." },
        { index: "03 / DEVIS", title: "Acceptez un prix en crédits", body: "Vous voyez le périmètre convenu et son prix. Ajoutez des crédits dans votre tableau de bord si besoin, puis acceptez." },
        { index: "04 / LANCEMENT", title: "Nous créons ou refondons", body: "Nos spécialistes développent votre nouveau site ou refondent l'existant, puis préparent le lancement." },
      ],
    },
    credits: {
      kicker: "PAYÉ EN CRÉDITS",
      title: "Votre projet.",
      titleEm: "Votre tableau de bord.",
      sub: "Tout commence dans votre compte RepGet. Partagez vos exigences, suivez l'état de votre projet et payez avec les mêmes crédits que partout dans RepGet.",
      bullets: [
        "Convenez du périmètre et de son prix en crédits avec notre équipe avant tout débit.",
        "Payez avec votre solde de crédits RepGet. S'il en faut plus, achetez un pack dans votre tableau de bord.",
        "Validez la direction de design et travaillez avec de vrais spécialistes jusqu'au lancement.",
      ],
      link: "Créez votre compte et commencez",
      demoLabel: "Tableau de bord illustratif d'un projet de site",
      demoBadge: "SERVICES WEB · CONCEPT",
      demoNav: ["Aperçu", "Projets web", "Crédits", "Réglages"],
      demoHead: "Projet de site",
      demoSub: "Aperçu du projet",
      demoStatus: "Devis prêt",
      demoExample: "Statut d'exemple",
      demoCreditsLabel: "CRÉDITS",
      demoCreditsValue: "Ajouter des crédits ↗",
      demoProjectLabel: "VOTRE PROJET",
      demoProjectValue: "Envoyer le brief ↗",
      demoFoot: "Gardez ensemble votre brief, votre devis et l'état de votre projet.",
      demoCaption: "Aperçu de la fonctionnalité · Illustration de concept, pas un vrai compte",
    },
    included: {
      kicker: "CE QUE VOTRE SITE MÉRITE",
      title: "Un site complet.",
      titleEm: "Pas un raccourci.",
      body: "Que nous partions de zéro ou que nous refondions votre site, notre travail est guidé par votre activité, pas par un modèle automatique.",
      items: [
        { title: "Direction visuelle sur mesure", body: "Une identité propre, alignée sur votre activité, votre public et votre positionnement." },
        { title: "Développement adaptatif", body: "Des mises en page soignées, conçues pour ordinateur, tablette et mobile." },
        { title: "Navigation et structure claires", body: "Une architecture de pages qui aide vos clients à comprendre votre offre." },
        { title: "Des bases pensées pour le SEO", body: "Une structure de contenu utile et une attention à la visibilité dès le départ." },
        { title: "De vraies personnes à vos côtés", body: "Un design et un développement humains, guidés par votre brief." },
        { title: "De quoi grandir avec RepGet", body: "Reliez la croissance du site au contenu, au SEO, à la visibilité IA et au marketing social." },
      ],
    },
    faq: {
      kicker: "VOS QUESTIONS, NOS RÉPONSES",
      title: "Tout ce qu'il faut savoir.",
      body: "Chaque entreprise est différente. Nous vous aidons à définir votre projet avant le début du développement.",
      contact: "Parler à notre équipe",
      items: [
        { q: "S'agit-il d'un site généré par IA ?", a: "Non. Ce service repose sur le travail de designers et de développeurs web humains. L'IA peut aider pour des tâches de soutien, mais votre site n'est pas un simple modèle généré automatiquement." },
        { q: "Puis-je commencer sans site ni domaine ?", a: "Absolument. Créez un compte RepGet avec votre e-mail. Vous pourrez discuter du choix du domaine et des exigences de votre projet lors du brief." },
        { q: "Pouvez-vous refondre mon site actuel ?", a: "Oui. Nous pouvons examiner votre site, rafraîchir son identité visuelle, améliorer la navigation et l'affichage mobile, et reconstruire des pages ou des fonctions si nécessaire. Indiquez votre URL et vos objectifs dans votre brief pour que notre équipe convienne avec vous du périmètre et de son prix en crédits." },
        { q: "Comment payer un site avec des crédits ?", a: "Le travail sur votre site se paie avec les mêmes crédits que tout le reste dans RepGet ; il n'existe pas d'autre monnaie. Le nombre requis dépend du périmètre convenu, de la complexité du design, des pages et des fonctions : chaque projet fait donc l'objet d'un devis. Vous voyez le prix avant d'accepter, et rien n'est débité avant." },
        { q: "Pouvez-vous créer une boutique en ligne ou un portfolio ?", a: "Oui, ce sont des types de projet courants. Indiquez vos besoins dans votre brief. L'équipe confirmera la faisabilité, le choix de la plateforme et le périmètre du développement." },
        { q: "Combien de temps prend un site ou une refonte ?", a: "Les délais dépendent de la complexité, de la disponibilité des contenus, des retours et des intégrations : nous ne publions donc pas de délai fixe. Posez la question lors de l'examen des exigences." },
        { q: "Que se passe-t-il après le lancement ?", a: "Vous pouvez utiliser les outils SEO, contenu, backlinks, visibilité IA et réseaux sociaux de RepGet pour attirer des clients. La maintenance et les développements complémentaires peuvent être définis séparément." },
      ],
    },
    cta: {
      kicker: "NOUVEAU SITE OU REFONTE COMPLÈTE",
      title: "Créez du neuf.",
      titleEm: "Ou faites mieux.",
      body: "Pas encore de site ? Nous le créons. Un site qui a besoin d'une vraie remise à niveau ? Nous le refondons. De vrais designers et développeurs, un seul point de départ.",
      formLabel: "Créez votre compte RepGet",
      submit: "Commencer",
      noteBefore: "Continuez vers",
      noteLink: "l'inscription sécurisée à RepGet",
      noteAfter: "Aucun site nécessaire pour commencer.",
    },
  },
  it: {
    metaTitle: "Creazione e redesign di siti da persone vere",
    metaDescription: "Le serve un nuovo sito o il redesign di quello attuale? Invii un brief e concordi con il nostro team l'ambito e un prezzo in crediti dal suo account RepGet.",
    hero: {
      kicker: "SITI SU MISURA E REDESIGN",
      title: "Non solo un sito web.",
      titleEm: "Qualcosa da ricordare.",
      introStrong: "Parte da zero o è pronto per un rinnovamento completo?",
      intro: "I nostri designer e sviluppatori esperti creano nuovi siti curati e trasformano quelli datati in qualcosa che sarà orgoglioso di mostrare.",
      introLast: "Persone vere. Design su misura. Nessun modello generato dall'IA.",
      switchLabel: "Di che tipo di progetto web ha bisogno?",
      choiceNew: "Crea un nuovo sito",
      choiceRedesign: "Ridisegna il mio sito",
      labelNew: "LE SERVE UN NUOVO SITO? INIZI CON LA SUA EMAIL.",
      labelRedesign: "PRONTO A RINNOVARE IL SUO SITO? INIZI CON LA SUA EMAIL.",
      submitNew: "Crea il mio sito",
      submitRedesign: "Ridisegna il mio sito",
      helpNew: "Si registri con la sua email e invii il brief dalla dashboard di RepGet. Vede l'ambito concordato e il prezzo in crediti prima di qualsiasi addebito.",
      helpRedesign: "Si registri con la sua email e ci parli del suo sito attuale. Vede l'ambito concordato e il prezzo in crediti prima di qualsiasi addebito.",
      formLabel: "Crei un account RepGet per avviare il suo progetto web",
      emailLabel: "Il suo indirizzo email",
      emailPlaceholder: "Inserisca il suo indirizzo email",
      emptyEmail: "Inserisca il suo indirizzo email per continuare.",
      invalidEmail: "Non sembra un indirizzo email.",
      stepsLabel: "Come inizia il suo progetto",
      steps: ["Si registri con l'email", "Invii il brief e concordi un preventivo", "Il nostro team lo crea o lo ridisegna"],
      explore: "ESPLORA LE DIREZIONI DI DESIGN",
      corner: "PROGETTATO DA PERSONE / PENSATO PER IL FUTURO",
    },
    next: { strong: "Nuovi siti. Rifacimenti migliori.", items: "Design su misura · Redesign completi · Mobile · Base pronta per la SEO", link: "Scopra come funziona" },
    strip: {
      a: "Siti veri.",
      b: "Vero mestiere.",
      c: "Nessuna scorciatoia.",
      label: "Cosa distingue i siti RepGet",
      items: [
        { title: "Su misura per il suo marchio", body: "Non lo stesso modello di tutti gli altri." },
        { title: "Progettato e sviluppato", body: "Esperienza curata, layout puliti e una vera realizzazione." },
        { title: "Pensato per il futuro", body: "Inizi con un sito. Cresca con RepGet." },
      ],
    },
    work: {
      kicker: "FATTO PER LA SUA ATTIVITÀ",
      title: "Un sito che le",
      titleEm: "somiglia.",
      body: "Vera direzione creativa per le attività che devono trasmettere solidità. Esplori un sito di marca online e due direzioni di design su misura molto diverse.",
      liveChip: "SITO ONLINE",
      realLabel: "Sito reale",
      conceptLabel: "Concept di design",
      openImageStudio: "Apri il vero sito di Image Studio",
      visit: "Visita imagestudio.com",
      similar: "Avvia un progetto simile",
      honesty: "Image Studio è un sito reale. Aurenia Residences e Forme Objects sono concept di design originali che illustrano possibili direzioni, non progetti consegnati a clienti.",
      imageStudio: { sub: "01 / FILM E FOTOGRAFIA", body: "Una presenza editoriale distintiva per produzione video, fotografia e racconto visivo." },
      aurenia: { sub: "02 / OSPITALITÀ", body: "Racconto per immagini, un forte senso del luogo e un percorso di prenotazione chiaro.", alt: "Concept originale di sito web per l'ospitalità di lusso" },
      forme: { sub: "03 / COMMERCIO ONLINE", body: "Un'esperienza d'acquisto curata, con un forte racconto del prodotto e una navigazione semplice.", alt: "Concept originale di sito e-commerce premium" },
    },
    process: {
      kicker: "SEMPLICE DAL PRIMO GIORNO",
      title: "Un nuovo inizio.",
      titleEm: "O una versione migliore.",
      body: "Parte da zero o vuole trasformare il sito che ha già? Lo stesso team esperto guida il suo progetto dal brief al lancio.",
      steps: [
        { index: "01 / ACCOUNT", title: "Si registri con l'email", body: "Crei il suo account RepGet per un nuovo sito o un redesign. Il sito attuale è facoltativo." },
        { index: "02 / BRIEF", title: "Ci racconti la sua idea", body: "Condivida i suoi obiettivi e, per un redesign, l'URL attuale. Il nostro team esamina l'ambito con lei." },
        { index: "03 / PREVENTIVO", title: "Accetti un prezzo in crediti", body: "Vede l'ambito concordato e il suo prezzo. Se servono, aggiunga crediti dalla dashboard, poi accetti." },
        { index: "04 / LANCIO", title: "Creiamo o rinnoviamo", body: "I nostri specialisti sviluppano il nuovo sito o ridisegnano quello esistente, poi preparano il lancio." },
      ],
    },
    credits: {
      kicker: "SI PAGA CON I CREDITI",
      title: "Il suo progetto.",
      titleEm: "La sua dashboard.",
      sub: "Tutto inizia dal suo account RepGet. Condivida i requisiti, segua lo stato del progetto e paghi con gli stessi crediti che usa in tutto RepGet.",
      bullets: [
        "Concordi con il nostro team l'ambito e il suo prezzo in crediti prima di qualsiasi addebito.",
        "Paghi con il saldo crediti di RepGet. Se ne servono altri, acquisti un pacchetto dalla dashboard.",
        "Valuti la direzione di design e lavori con veri specialisti fino al lancio.",
      ],
      link: "Crei il suo account e inizi",
      demoLabel: "Dashboard illustrativa di un progetto web",
      demoBadge: "SERVIZI WEB · CONCEPT",
      demoNav: ["Panoramica", "Progetti web", "Crediti", "Impostazioni"],
      demoHead: "Progetto web",
      demoSub: "Panoramica del progetto",
      demoStatus: "Preventivo pronto",
      demoExample: "Stato di esempio",
      demoCreditsLabel: "CREDITI",
      demoCreditsValue: "Aggiungi crediti ↗",
      demoProjectLabel: "IL SUO PROGETTO",
      demoProjectValue: "Invia il brief ↗",
      demoFoot: "Tenga insieme il brief, il preventivo e lo stato del progetto.",
      demoCaption: "Anteprima della funzione · Illustrazione di concept, non un account reale",
    },
    included: {
      kicker: "CIÒ CHE IL SUO SITO MERITA",
      title: "Un sito completo.",
      titleEm: "Non una scorciatoia.",
      body: "Che partiamo da zero o ridisegniamo il suo sito, il nostro lavoro è guidato dalla sua attività, non da un modello automatico.",
      items: [
        { title: "Direzione visiva su misura", body: "Un'immagine propria, allineata alla sua attività, al suo pubblico e al suo posizionamento." },
        { title: "Sviluppo responsive", body: "Layout realizzati con cura per funzionare su desktop, tablet e mobile." },
        { title: "Navigazione e struttura chiare", body: "Un'architettura delle pagine che aiuta i clienti a capire cosa offre." },
        { title: "Basi attente alla SEO", body: "Una struttura dei contenuti utile e attenzione alla visibilità fin dall'inizio." },
        { title: "Persone vere con cui lavorare", body: "Design e sviluppo umani, con il suo brief a guidare il risultato." },
        { title: "Spazio per crescere con RepGet", body: "Colleghi la crescita del sito a contenuti, SEO, visibilità nell'IA e social marketing." },
      ],
    },
    faq: {
      kicker: "DOMANDE E RISPOSTE",
      title: "Tutto quello che serve sapere.",
      body: "Ogni attività è diversa. La aiutiamo a definire il progetto prima che inizi lo sviluppo.",
      contact: "Parli con il nostro team",
      items: [
        { q: "È un sito generato dall'IA?", a: "No. Questo servizio si basa sul lavoro di web designer e sviluppatori umani. L'IA può aiutare nelle attività di supporto, ma il suo sito non è semplicemente un modello generato automaticamente." },
        { q: "Posso iniziare senza un sito o un dominio?", a: "Certamente. Crei un account RepGet con la sua email. Potrà parlare della scelta del dominio e dei requisiti del progetto durante il brief." },
        { q: "Potete ridisegnare o rinnovare il mio sito attuale?", a: "Sì. Possiamo esaminare il suo sito, rinnovarne l'identità visiva, migliorare la navigazione e la versione mobile e ricostruire pagine o funzioni dove serve. Indichi l'URL e gli obiettivi nel brief, così il nostro team può concordare con lei l'ambito e il suo prezzo in crediti." },
        { q: "Come si paga un sito con i crediti?", a: "Il lavoro sul sito si paga con gli stessi crediti di tutto il resto in RepGet; non esiste un'altra valuta. Il numero necessario dipende dall'ambito concordato, dalla complessità del design, dalle pagine e dalle funzioni, quindi ogni progetto ha il suo preventivo. Vede il prezzo prima di accettare e non viene addebitato nulla finché non lo fa." },
        { q: "Potete creare un negozio online o un portfolio?", a: "Sì, sono tipi di progetto comuni. Indichi nel brief ciò che le serve. Il team confermerà l'idoneità, la scelta della piattaforma e l'ambito dello sviluppo." },
        { q: "Quanto tempo richiede un nuovo sito o un redesign?", a: "I tempi dipendono da complessità, disponibilità dei contenuti, feedback e integrazioni, quindi non pubblichiamo una durata fissa. Chieda dei tempi quando vengono esaminati i requisiti." },
        { q: "Cosa succede dopo il lancio?", a: "Può usare gli strumenti RepGet per SEO, contenuti, backlink, visibilità nell'IA e social per attirare clienti. La manutenzione continua e altri sviluppi possono essere definiti a parte." },
      ],
    },
    cta: {
      kicker: "NUOVO SITO O REDESIGN COMPLETO",
      title: "Crei qualcosa di nuovo.",
      titleEm: "O lo renda migliore.",
      body: "Parte senza un sito? Lo creiamo noi. Ne ha già uno che ha bisogno di un vero salto di qualità? Lo ridisegniamo. Veri designer e sviluppatori, un unico punto di partenza.",
      formLabel: "Crei il suo account RepGet",
      submit: "Inizia",
      noteBefore: "Prosegua con la",
      noteLink: "registrazione sicura a RepGet",
      noteAfter: "Non serve un sito per iniziare.",
    },
  },
  de: {
    metaTitle: "Webdesign und Redesign von echten Menschen",
    metaDescription: "Neue Website oder Redesign? Senden Sie ein Briefing und vereinbaren Sie Umfang und Preis in Credits mit unserem Team, direkt in Ihrem RepGet-Konto.",
    hero: {
      kicker: "INDIVIDUELLE WEBSITES UND REDESIGNS",
      title: "Nicht nur eine Website.",
      titleEm: "Etwas, das in Erinnerung bleibt.",
      introStrong: "Sie fangen bei null an oder wollen alles erneuern?",
      intro: "Unsere erfahrenen Designer und Entwickler gestalten neue Websites und verwandeln veraltete in etwas, das Sie gerne zeigen.",
      introLast: "Echte Menschen. Individuelles Design. Keine KI-generierten Vorlagen.",
      switchLabel: "Welche Art von Website-Projekt brauchen Sie?",
      choiceNew: "Neue Website erstellen",
      choiceRedesign: "Meine Website überarbeiten",
      labelNew: "SIE BRAUCHEN EINE NEUE WEBSITE? STARTEN SIE MIT IHRER E-MAIL.",
      labelRedesign: "BEREIT FÜR EIN REDESIGN? STARTEN SIE MIT IHRER E-MAIL.",
      submitNew: "Website erstellen lassen",
      submitRedesign: "Website überarbeiten lassen",
      helpNew: "Registrieren Sie sich mit Ihrer E-Mail und senden Sie Ihr Briefing aus Ihrem RepGet-Dashboard. Sie sehen den vereinbarten Umfang und den Preis in Credits, bevor etwas abgebucht wird.",
      helpRedesign: "Registrieren Sie sich mit Ihrer E-Mail und erzählen Sie uns von Ihrer Website. Sie sehen den vereinbarten Umfang und den Preis in Credits, bevor etwas abgebucht wird.",
      formLabel: "Erstellen Sie ein RepGet-Konto, um Ihr Website-Projekt zu starten",
      emailLabel: "Ihre E-Mail-Adresse",
      emailPlaceholder: "E-Mail-Adresse eingeben",
      emptyEmail: "Geben Sie Ihre E-Mail-Adresse ein, um fortzufahren.",
      invalidEmail: "Das sieht nicht nach einer E-Mail-Adresse aus.",
      stepsLabel: "So startet Ihr Projekt",
      steps: ["Mit E-Mail registrieren", "Briefing senden und Angebot vereinbaren", "Unser Team erstellt oder überarbeitet sie"],
      explore: "DESIGNRICHTUNGEN ENTDECKEN",
      corner: "VON MENSCHEN GESTALTET / FÜR DAS, WAS KOMMT",
    },
    next: { strong: "Neue Websites. Bessere Neuauflagen.", items: "Individuelles Design · Komplette Redesigns · Mobil · SEO-fähige Basis", link: "So funktioniert es" },
    strip: {
      a: "Echte Websites.",
      b: "Echtes Handwerk.",
      c: "Keine Abkürzungen.",
      label: "Was RepGet-Websites auszeichnet",
      items: [
        { title: "Auf Ihre Marke zugeschnitten", body: "Nicht dieselbe Vorlage wie bei allen anderen." },
        { title: "Gestaltet und entwickelt", body: "Durchdachte Nutzerführung, klare Layouts und eine echte Umsetzung." },
        { title: "Für das, was kommt", body: "Starten Sie mit einer Website. Wachsen Sie mit RepGet." },
      ],
    },
    work: {
      kicker: "FÜR IHR UNTERNEHMEN GEMACHT",
      title: "Eine Website, die zu Ihnen",
      titleEm: "passt.",
      body: "Echte kreative Leitung für Unternehmen, die etabliert wirken müssen. Entdecken Sie eine echte Marken-Website und zwei sehr unterschiedliche individuelle Designrichtungen.",
      liveChip: "LIVE-WEBSITE",
      realLabel: "Echte Website",
      conceptLabel: "Designkonzept",
      openImageStudio: "Die echte Website von Image Studio öffnen",
      visit: "imagestudio.com besuchen",
      similar: "Ähnliches Projekt starten",
      honesty: "Image Studio ist eine echte Website. Aurenia Residences und Forme Objects sind eigene Designkonzepte, die mögliche Richtungen zeigen, und keine für Kunden umgesetzten Projekte.",
      imageStudio: { sub: "01 / FILM UND FOTOGRAFIE", body: "Ein unverwechselbarer redaktioneller Auftritt für Filmproduktion, Fotografie und visuelles Erzählen." },
      aurenia: { sub: "02 / HOTELLERIE", body: "Bildstarkes Erzählen, ein eigenes Gefühl für den Ort und ein klarer Buchungsweg.", alt: "Eigenes Website-Designkonzept für Luxushotellerie" },
      forme: { sub: "03 / ONLINEHANDEL", body: "Ein gepflegtes Einkaufserlebnis mit starker Produktgeschichte und müheloser Navigation.", alt: "Eigenes Designkonzept für einen Premium-Onlineshop" },
    },
    process: {
      kicker: "EINFACH VOM ERSTEN TAG AN",
      title: "Ein Neuanfang.",
      titleEm: "Oder eine bessere Version.",
      body: "Sie fangen bei null an oder verwandeln eine bestehende Website? Dasselbe erfahrene Team begleitet Ihr Projekt vom Briefing bis zum Start.",
      steps: [
        { index: "01 / KONTO", title: "Mit E-Mail registrieren", body: "Erstellen Sie Ihr RepGet-Konto für eine neue Website oder ein Redesign. Ihre aktuelle Website ist optional." },
        { index: "02 / BRIEFING", title: "Teilen Sie Ihre Vision", body: "Nennen Sie Ihre Ziele und für ein Redesign Ihre aktuelle URL. Unser Team stimmt den Umfang mit Ihnen ab." },
        { index: "03 / ANGEBOT", title: "Preis in Credits annehmen", body: "Sie sehen den vereinbarten Umfang und seinen Preis. Fügen Sie bei Bedarf Credits im Dashboard hinzu und nehmen Sie an." },
        { index: "04 / START", title: "Wir erstellen oder überarbeiten", body: "Unsere Spezialisten entwickeln Ihre neue Website oder überarbeiten die bestehende und bereiten den Start vor." },
      ],
    },
    credits: {
      kicker: "MIT CREDITS BEZAHLT",
      title: "Ihr Projekt.",
      titleEm: "Ihr Dashboard.",
      sub: "Alles beginnt in Ihrem RepGet-Konto. Teilen Sie Ihre Anforderungen, verfolgen Sie den Projektstand und bezahlen Sie mit denselben Credits wie überall in RepGet.",
      bullets: [
        "Vereinbaren Sie Umfang und Preis in Credits mit unserem Team, bevor etwas abgebucht wird.",
        "Bezahlen Sie aus Ihrem RepGet-Guthaben. Brauchen Sie mehr, kaufen Sie im Dashboard ein Credit-Paket.",
        "Prüfen Sie die Designrichtung und arbeiten Sie bis zum Start mit echten Spezialisten.",
      ],
      link: "Konto erstellen und loslegen",
      demoLabel: "Beispielhaftes Dashboard eines Website-Projekts",
      demoBadge: "WEBSITE-SERVICES · KONZEPT",
      demoNav: ["Übersicht", "Website-Projekte", "Credits", "Einstellungen"],
      demoHead: "Website-Projekt",
      demoSub: "Projektübersicht",
      demoStatus: "Angebot bereit",
      demoExample: "Beispielstatus",
      demoCreditsLabel: "CREDITS",
      demoCreditsValue: "Credits hinzufügen ↗",
      demoProjectLabel: "IHR PROJEKT",
      demoProjectValue: "Briefing senden ↗",
      demoFoot: "Halten Sie Briefing, Angebot und Projektstand an einem Ort.",
      demoCaption: "Vorschau der Funktion · Konzeptillustration, kein echtes Konto",
    },
    included: {
      kicker: "WAS IHRE WEBSITE VERDIENT",
      title: "Eine vollständige Website.",
      titleEm: "Keine schnelle Abkürzung.",
      body: "Ob wir neu aufbauen oder Ihre aktuelle Website überarbeiten: Unsere Arbeit richtet sich nach Ihrem Unternehmen, nicht nach einer automatischen Vorlage.",
      items: [
        { title: "Individuelle visuelle Richtung", body: "Ein eigener Auftritt, abgestimmt auf Ihr Unternehmen, Ihr Publikum und Ihre Positionierung." },
        { title: "Responsive Entwicklung", body: "Sorgfältig gebaute Layouts für Desktop, Tablet und Mobilgerät." },
        { title: "Klare Navigation und Struktur", body: "Eine durchdachte Seitenstruktur, die Kunden Ihr Angebot verständlich macht." },
        { title: "SEO-bewusste Grundlagen", body: "Eine sinnvolle Inhaltsstruktur und Auffindbarkeit von Anfang an im Blick." },
        { title: "Echte Menschen als Partner", body: "Design und Entwicklung von Menschen, geleitet von Ihrem Briefing." },
        { title: "Raum zum Wachsen mit RepGet", body: "Verbinden Sie das Wachstum Ihrer Website mit Inhalten, SEO, KI-Sichtbarkeit und Social Marketing." },
      ],
    },
    faq: {
      kicker: "FRAGEN UND ANTWORTEN",
      title: "Alles, was Sie wissen müssen.",
      body: "Jedes Unternehmen ist anders. Wir helfen Ihnen, Ihr Projekt zu definieren, bevor die Entwicklung beginnt.",
      contact: "Sprechen Sie mit unserem Team",
      items: [
        { q: "Ist das eine KI-generierte Website?", a: "Nein. Dieser Service beruht auf der Arbeit menschlicher Webdesigner und Entwickler. KI kann bei unterstützenden Aufgaben helfen, aber Ihre Website ist nicht einfach eine automatisch erzeugte Vorlage." },
        { q: "Kann ich ohne Website oder Domain starten?", a: "Auf jeden Fall. Erstellen Sie ein RepGet-Konto mit Ihrer E-Mail. Domainwahl und Projektanforderungen können Sie beim Briefing besprechen." },
        { q: "Können Sie meine bestehende Website überarbeiten?", a: "Ja. Wir können Ihre Website prüfen, ihr Erscheinungsbild auffrischen, Navigation und mobile Darstellung verbessern und Seiten oder Funktionen bei Bedarf neu bauen. Nennen Sie im Briefing Ihre URL und Ihre Ziele, damit unser Team mit Ihnen Umfang und Preis in Credits vereinbaren kann." },
        { q: "Wie bezahlen Credits eine Website?", a: "Website-Arbeit wird mit denselben Credits bezahlt wie alles andere in RepGet; es gibt keine zweite Währung. Die nötige Anzahl hängt vom vereinbarten Umfang, der Designkomplexität, den Seiten und den Funktionen ab, deshalb erhält jedes Projekt ein eigenes Angebot. Sie sehen den Preis vor der Annahme, und bis dahin wird nichts abgebucht." },
        { q: "Können Sie einen Onlineshop oder ein Portfolio erstellen?", a: "Ja, das sind übliche Projektarten. Nennen Sie im Briefing, was Sie brauchen. Das Team bestätigt Eignung, Plattformwahl und Entwicklungsumfang." },
        { q: "Wie lange dauert eine neue Website oder ein Redesign?", a: "Die Dauer hängt von Komplexität, verfügbaren Inhalten, Feedback und Integrationen ab, deshalb nennen wir keine feste Zeit. Fragen Sie danach, wenn die Anforderungen geprüft werden." },
        { q: "Was passiert nach dem Start meiner Website?", a: "Sie können die RepGet-Werkzeuge für SEO, Inhalte, Backlinks, KI-Sichtbarkeit und Social Media nutzen, um Kunden zu gewinnen. Laufende Wartung und weitere Entwicklung lassen sich separat vereinbaren." },
      ],
    },
    cta: {
      kicker: "NEUE WEBSITE ODER KOMPLETTES REDESIGN",
      title: "Etwas Neues schaffen.",
      titleEm: "Oder es besser machen.",
      body: "Noch keine Website? Wir erstellen sie. Eine, die ein echtes Upgrade braucht? Wir überarbeiten sie. Echte Designer und Entwickler, ein einfacher Ausgangspunkt.",
      formLabel: "Erstellen Sie Ihr RepGet-Konto",
      submit: "Loslegen",
      noteBefore: "Weiter zur",
      noteLink: "sicheren RepGet-Registrierung",
      noteAfter: "Für den Start ist keine Website nötig.",
    },
  },
};
