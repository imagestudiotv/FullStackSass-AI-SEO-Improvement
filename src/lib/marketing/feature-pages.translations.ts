import type { Locale } from "@/lib/i18n/config";

import type { FeaturePage } from "./feature-pages";

/**
 * /backlinks and /rank-on-chatgpt in Spanish, French, Italian and German
 * (client, 2026-10-13: pages must show in the visitor's language). The same
 * claims as the English copy in feature-pages.ts, sentence for sentence:
 * change one, change all five.
 *
 * Paths are the English ones; the page turns them into the visitor's
 * language where that page exists (localePath). The example articles are
 * real English articles, so their titles and descriptions stay English and
 * "Read the article" says so.
 */

type Translated = Exclude<Locale, "en">;

export type FeatureTranslation = {
  backlinks: FeaturePage;
  chatgpt: FeaturePage;
  /** Who Image Studio is, in a few words. */
  about: string;
  category: string;
  backlinksImageAlt: string;
  chatgptImageAlt: string;
  chatgptHighlights: string[];
};

export const FEATURE_TRANSLATIONS: Record<Translated, FeatureTranslation> = {
  es: {
    about: "un estudio de vídeo y fotografía de bodas en Italia",
    category: "Bodas",
    backlinksImageAlt: "Una pareja saliendo de su ceremonia de boda en el Castello di Rossino, en Italia, con los invitados a ambos lados.",
    chatgptImageAlt: "Invitados y la pareja compartiendo un momento natural, sin posar, en un banquete de boda en Italia.",
    chatgptHighlights: [
      "Títulos que son las preguntas que hace la gente: «Why Do We Feel Awkward in Wedding Photos?»",
      "Una comparación directa: «Candid vs Posed vs Guided Wedding Photos: What’s the Difference?»",
      "Ocho consejos numerados, cada uno una respuesta clara por sí solo",
      "Un ejemplo real del trabajo del propio estudio: «Julia & Mihail in Rome»",
      "Una sección de preguntas frecuentes cerca del final",
    ],
    backlinks: {
      path: "/backlinks",
      metaTitle: "Backlinks desde webs de negocios reales",
      metaDescription:
        "RepGet coloca enlaces a su web en artículos nuevos de negocios afines. Enlaces follow, comprobados en la página publicada y con créditos en todos los planes.",
      eyebrow: "Backlinks",
      title: "Backlinks desde webs de negocios reales,",
      accent: "sin enviar un solo correo.",
      intro:
        "RepGet coloca enlaces a su web dentro de artículos nuevos publicados en las webs de otros negocios de un sector relacionado. Cada enlace aparece en su panel y se comprueba en la página publicada.",
      primaryCta: "Cree 3 artículos gratis",
      secondaryCta: { label: "Ver precios", href: "/pricing" },
      benefitsTitle: "Lo que obtiene",
      benefits: [
        {
          title: "Dentro de artículos reales",
          body: "Su enlace está en el cuerpo de un artículo escrito para los propios lectores de la web anfitriona. Nunca en una página de enlaces, nunca escondido en un pie de página.",
        },
        {
          title: "De un sector relacionado",
          body: "Los enlaces vienen de negocios de un sector relacionado con el suyo, nunca de webs sin relación.",
        },
        {
          title: "Enlaces follow",
          body: "Cada enlace de un socio se envía como un enlace normal y follow que los buscadores pueden tener en cuenta. Si un anfitrión lo cambia, la siguiente comprobación lo señala.",
        },
        {
          title: "Créditos incluidos en su plan",
          body: "Todos los planes incluyen créditos cada mes, y alojar artículos para otros le hace ganar más. Un enlace solo gasta sus créditos cuando se verifica que está publicado.",
        },
      ],
      compare: {
        title: "Conseguir enlaces por su cuenta y con RepGet",
        without: {
          label: "Por su cuenta",
          points: [
            "Escribir a propietarios de webs que casi nunca responden",
            "Pagar por enlace o intercambiar favores uno a uno",
            "Enlaces en páginas escritas solo para contener enlaces",
            "Ninguna forma sencilla de saber si un enlace sigue ahí",
          ],
        },
        with: {
          label: "Con RepGet",
          points: [
            "Sin contactar a nadie: los enlaces se colocan por usted",
            "Créditos incluidos en su plan",
            "Enlaces dentro de artículos nuevos, escritos para lectores reales",
            "Cada enlace en una lista y comprobado en la página publicada",
          ],
        },
      },
      stepsTitle: "Tres pasos hasta su primer backlink",
      steps: [
        {
          title: "Elija sus páginas importantes",
          body: "Indíquenos qué páginas de su web deben recibir enlaces y cuáles importan más. RepGet puede sugerirlas a partir de su sitemap.",
        },
        {
          title: "Nosotros colocamos los enlaces",
          body: "El equipo de RepGet coloca cada enlace a mano, dentro de un artículo en la web de un negocio relacionado. Cada artículo se revisa antes de publicarse.",
        },
        {
          title: "Siga cada enlace",
          body: "Su página de Backlinks muestra cada enlace: el artículo que lo contiene, la web en la que está y su estado, desde la búsqueda de una web hasta su publicación.",
        },
      ],
      example: {
        eyebrow: "Un ejemplo real",
        title: "Este es el tipo de artículo en el que va un enlace",
        body: "Los enlaces de los socios se colocan dentro de artículos como este: escritos para un negocio real, para sus propios lectores, y publicados en su propia web.",
        readLabel: "Leer el artículo (en inglés)",
        daLabel: "Domain Authority",
        placedLabel: "Enlace de socio en este artículo",
      },
      table: {
        title: "Comparativa",
        columns: ["Por su cuenta", "Una agencia", "RepGet"],
        rows: [
          { label: "Su tiempo", cells: ["Horas de contactos cada mes", "Preparar encargos y revisar informes", "Elegir sus páginas una vez"] },
          { label: "Dónde aparecen los enlaces", cells: ["Donde acepte el propietario de una web", "Depende de la agencia", "Dentro de artículos nuevos en webs de negocios relacionados"] },
          { label: "Ver cada enlace", cells: ["Su propia hoja de cálculo", "Un informe mensual", "Su panel, comprobado en la página publicada"] },
          { label: "Cómo paga", cells: ["Por enlace, o con su tiempo", "Una cuota mensual", "Créditos incluidos en su plan"] },
        ],
      },
      related: { label: "Cómo funcionan los créditos para enlaces", href: "/backlink-exchange" },
      faqTitle: "Preguntas sobre backlinks",
      faq: [
        {
          question: "¿Qué es un backlink y por qué importa?",
          answer:
            "Un backlink es un enlace desde otra web hacia la suya. Los buscadores y los asistentes de IA interpretan los enlaces desde webs relevantes como una señal de que otros avalan sus páginas, lo que ayuda a que se posicionen y se citen.",
        },
        {
          question: "¿De dónde vienen los enlaces?",
          answer:
            "De las webs de otros clientes de RepGet de un sector relacionado con el suyo. Cada enlace se coloca dentro de un artículo nuevo en su web, escrito para sus lectores.",
        },
        {
          question: "¿Tengo que alojar artículos de otros?",
          answer:
            "Así funciona la red: su web puede llevar un enlace a otro cliente, igual que las webs de otros clientes enlazan a la suya, y alojar le hace ganar créditos. Usted decide en los ajustes cómo participa su web.",
        },
        {
          question: "¿Los enlaces son follow?",
          answer:
            "Sí. RepGet envía cada enlace de socio como un enlace normal y follow. La comprobación periódica de la página publicada señala cualquier enlace que un anfitrión haya cambiado.",
        },
        {
          question: "¿Qué pasa si se elimina un enlace?",
          answer: "Las comprobaciones siguen buscándolo. Si un enlace desaparece definitivamente, avísenos y le devolvemos el crédito.",
        },
        {
          question: "¿Cuántos backlinks recibiré?",
          answer:
            "Depende de los créditos de su plan y de cuántos negocios relacionados estén publicando en ese momento. Su página de Backlinks muestra cada enlace a medida que llega.",
        },
      ],
      closingTitle: "Consiga sus primeros backlinks sin enviar un correo",
      closingBody: "Empiece con tres artículos gratis y vea su panel por sí mismo.",
      ui: { published: "Publicado", minRead: "{n} min de lectura", compared: "Comparación", newTab: "(se abre en una pestaña nueva)" },
    },
    chatgpt: {
      path: "/rank-on-chatgpt",
      metaTitle: "Cómo lograr que ChatGPT recomiende su negocio",
      metaDescription:
        "Consiga que ChatGPT y otros asistentes de IA encuentren y nombren su negocio: revisión de rastreadores, artículos útiles, enlaces afines y seguimiento.",
      eyebrow: "Búsqueda con IA",
      title: "Consiga que ChatGPT",
      accent: "recomiende su negocio.",
      intro:
        "Hoy la gente pregunta a los asistentes de IA qué negocio elegir. RepGet comprueba que los asistentes puedan leer su web, publica artículos claros que responden a las preguntas de sus clientes, consigue menciones en webs relacionadas y sigue si su negocio aparece nombrado.",
      primaryCta: "Cree 3 artículos gratis",
      secondaryCta: { label: "Hacer la auditoría gratuita", href: "/audit" },
      benefitsTitle: "Cómo le ayuda RepGet a que le nombren",
      benefits: [
        {
          title: "Rastreadores de IA con acceso",
          body: "La auditoría lee su robots.txt y muestra si los rastreadores de ChatGPT, Claude, Perplexity y Gemini pueden leer su web. Bloquearlos sin querer es frecuente.",
        },
        {
          title: "Respuestas a preguntas reales",
          body: "Los artículos se planifican a partir de lo que sus clientes buscan de verdad y se escriben en su idioma, con títulos claros, un índice y tablas comparativas cuando ayudan.",
        },
        {
          title: "Menciones en webs relacionadas",
          body: "Los enlaces de negocios de un sector relacionado, dentro de artículos reales, muestran a los asistentes que otros le avalan.",
        },
        {
          title: "Seguimiento de su visibilidad en la IA",
          body: "Añada las preguntas que sus clientes harían a un asistente, 20 en Grow y 50 en Scale, y vea si su negocio aparece nombrado y en qué lugar de la respuesta.",
        },
      ],
      compare: {
        title: "La búsqueda con IA sin RepGet y con RepGet",
        without: {
          label: "Sin RepGet",
          points: [
            "No sabe si los asistentes le mencionan",
            "Un rastreador de IA bloqueado pasa desapercibido",
            "Páginas que nunca responden directamente a la pregunta",
            "Pocas webs hablan de usted",
          ],
        },
        with: {
          label: "Con RepGet",
          points: [
            "Las preguntas que sigue muestran dónde le nombran",
            "La auditoría señala un rastreador de IA bloqueado",
            "Artículos que responden a las preguntas con palabras sencillas",
            "Enlaces desde artículos de negocios relacionados",
          ],
        },
      },
      stepsTitle: "Tres pasos para que le nombren",
      steps: [
        {
          title: "Haga la auditoría gratuita",
          body: "Comprueba qué rastreadores de IA pueden leer su web y los aspectos técnicos básicos en los que se apoyan tanto Google como los asistentes. No necesita cuenta.",
        },
        {
          title: "Publique respuestas cada mes",
          body: "RepGet planifica, escribe y publica artículos en su web a través de WordPress, Shopify o Ghost, con el calendario que usted elija.",
        },
        {
          title: "Siga su visibilidad en la IA",
          body: "Las preguntas que sigue se vuelven a hacer con el tiempo, para que vea cuándo su negocio empieza a aparecer nombrado.",
        },
      ],
      example: {
        eyebrow: "Un ejemplo real",
        title: "Un artículo escrito para ser citado",
        body: "Publicado en la propia web del negocio. Fíjese en cómo está construido:",
        readLabel: "Leer el artículo (en inglés)",
        daLabel: "Domain Authority",
        placedLabel: "Enlace de socio en este artículo",
      },
      table: null,
      related: { label: "Lea nuestra guía (en inglés): How to Get Mentioned in ChatGPT", href: "/blog/get-mentioned-in-chatgpt" },
      faqTitle: "Preguntas sobre la búsqueda con IA",
      faq: [
        {
          question: "¿Pueden garantizar que ChatGPT recomiende mi negocio?",
          answer:
            "Nadie puede: los asistentes deciden por sí mismos y sus respuestas cambian. RepGet mejora lo que pueden encontrar y citar sobre usted, y le muestra, pregunta a pregunta, si le nombran.",
        },
        {
          question: "¿Cómo eligen los asistentes de IA qué negocios mencionar?",
          answer:
            "Se basan en lo que pueden leer: su propia web, artículos que responden a la pregunta y lo que otras webs dicen de usted. Ayudan tanto las páginas claras y concretas como las menciones en webs relevantes.",
        },
        {
          question: "¿Cómo funciona el seguimiento?",
          answer:
            "RepGet hace a un asistente de IA cada pregunta que usted sigue, como lo haría un cliente, y registra qué negocios nombra la respuesta y en qué orden. Cuando una comprobación no se puede completar, no se registra nada, así que un fallo nunca parece una ausencia.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "Los asistentes actualizan lo que saben a su propio ritmo, así que piense en semanas y meses, no en días. Seguir las mismas preguntas a lo largo del tiempo muestra el cambio.",
        },
        {
          question: "¿Tengo que cambiar mi web?",
          answer:
            "Normalmente no. La auditoría señala lo que bloquee a los rastreadores de IA, y los artículos se publican en su web actual a través de WordPress, Shopify o Ghost.",
        },
      ],
      closingTitle: "Descubra qué dicen los asistentes de IA sobre su negocio",
      closingBody: "Empiece con tres artículos gratis o haga primero la auditoría gratuita.",
      ui: { published: "Publicado", minRead: "{n} min de lectura", compared: "Comparación", newTab: "(se abre en una pestaña nueva)" },
    },
  },

  fr: {
    about: "un studio de vidéo et de photographie de mariage en Italie",
    category: "Mariage",
    backlinksImageAlt: "Un couple quittant sa cérémonie de mariage au Castello di Rossino, en Italie, entre deux rangées d’invités.",
    chatgptImageAlt: "Les invités et le couple partageant un moment naturel, sans pose, lors d’une réception de mariage en Italie.",
    chatgptHighlights: [
      "Des intertitres qui sont les questions que les gens se posent : « Why Do We Feel Awkward in Wedding Photos? »",
      "Une comparaison directe : « Candid vs Posed vs Guided Wedding Photos: What’s the Difference? »",
      "Huit conseils numérotés, chacun étant à lui seul une réponse claire",
      "Un exemple réel tiré du travail du studio : « Julia & Mihail in Rome »",
      "Une section de questions fréquentes vers la fin",
    ],
    backlinks: {
      path: "/backlinks",
      metaTitle: "Des backlinks depuis de vrais sites d’entreprises",
      metaDescription:
        "RepGet place des liens vers votre site dans de nouveaux articles d’entreprises proches. Liens follow, vérifiés en ligne, crédits inclus dans chaque formule.",
      eyebrow: "Backlinks",
      title: "Des backlinks depuis de vrais sites d’entreprises,",
      accent: "sans un seul e-mail de prospection.",
      intro:
        "RepGet place des liens vers votre site dans de nouveaux articles publiés sur les sites d’autres entreprises d’un secteur proche. Chaque lien figure dans votre tableau de bord et est vérifié sur la page en ligne.",
      primaryCta: "Créez 3 articles gratuitement",
      secondaryCta: { label: "Voir les tarifs", href: "/pricing" },
      benefitsTitle: "Ce que vous obtenez",
      benefits: [
        {
          title: "Dans de vrais articles",
          body: "Votre lien se trouve dans le corps d’un article écrit pour les lecteurs du site hôte. Jamais sur une page de liens, jamais caché dans un pied de page.",
        },
        {
          title: "D’un secteur proche",
          body: "Les liens viennent d’entreprises d’un secteur proche du vôtre, jamais de sites sans rapport.",
        },
        {
          title: "Des liens follow",
          body: "Chaque lien partenaire est envoyé comme un lien normal, en follow, que les moteurs de recherche peuvent prendre en compte. Si un hôte le modifie, la vérification suivante le signale.",
        },
        {
          title: "Des crédits inclus dans votre formule",
          body: "Chaque formule inclut des crédits chaque mois, et héberger des articles pour d’autres vous en fait gagner davantage. Un lien n’utilise ses crédits qu’une fois vérifié en ligne.",
        },
      ],
      compare: {
        title: "Le netlinking seul, et avec RepGet",
        without: {
          label: "Seul",
          points: [
            "Écrire à des propriétaires de sites qui répondent rarement",
            "Payer chaque lien, ou échanger des services un par un",
            "Des liens sur des pages écrites uniquement pour porter des liens",
            "Aucun moyen simple de savoir si un lien est toujours là",
          ],
        },
        with: {
          label: "Avec RepGet",
          points: [
            "Aucune prospection : les liens sont placés pour vous",
            "Des crédits inclus dans votre formule",
            "Des liens dans de nouveaux articles, écrits pour de vrais lecteurs",
            "Chaque lien listé, et vérifié sur la page en ligne",
          ],
        },
      },
      stepsTitle: "Trois étapes vers votre premier backlink",
      steps: [
        {
          title: "Choisissez vos pages importantes",
          body: "Indiquez-nous quelles pages de votre site doivent recevoir des liens, et lesquelles comptent le plus. RepGet peut vous les suggérer à partir de votre sitemap.",
        },
        {
          title: "Nous plaçons les liens",
          body: "L’équipe RepGet place chaque lien à la main, dans un article sur le site d’une entreprise d’un secteur proche. Chaque article est relu avant sa mise en ligne.",
        },
        {
          title: "Suivez chaque lien",
          body: "Votre page Backlinks liste chaque lien : l’article qui le porte, le site où il se trouve et son statut, de la recherche d’un site jusqu’à la mise en ligne.",
        },
      ],
      example: {
        eyebrow: "Un exemple réel",
        title: "Voici le type d’article qui accueille un lien",
        body: "Les liens partenaires sont placés dans des articles comme celui-ci : écrits pour une vraie entreprise, pour ses propres lecteurs, et publiés sur son propre site.",
        readLabel: "Lire l’article (en anglais)",
        daLabel: "Domain Authority",
        placedLabel: "Lien partenaire dans cet article",
      },
      table: {
        title: "Comparatif",
        columns: ["Seul", "Une agence", "RepGet"],
        rows: [
          { label: "Votre temps", cells: ["Des heures de prospection chaque mois", "Briefer et relire des rapports", "Choisir vos pages une seule fois"] },
          { label: "Où apparaissent les liens", cells: ["Là où un propriétaire de site accepte", "Selon l’agence", "Dans de nouveaux articles sur les sites d’entreprises de secteurs proches"] },
          { label: "Voir chaque lien", cells: ["Votre propre tableur", "Un rapport mensuel", "Votre tableau de bord, vérifié sur la page en ligne"] },
          { label: "Comment vous payez", cells: ["Au lien, ou avec votre temps", "Un forfait mensuel", "Des crédits inclus dans votre formule"] },
        ],
      },
      related: { label: "Comment fonctionnent les crédits pour les liens", href: "/backlink-exchange" },
      faqTitle: "Questions sur les backlinks",
      faq: [
        {
          question: "Qu’est-ce qu’un backlink, et pourquoi est-ce important ?",
          answer:
            "Un backlink est un lien d’un autre site vers le vôtre. Les moteurs de recherche et les assistants d’IA voient les liens venant de sites pertinents comme le signe que d’autres recommandent vos pages, ce qui les aide à se positionner et à être citées.",
        },
        {
          question: "D’où viennent les liens ?",
          answer:
            "Des sites d’autres clients RepGet d’un secteur proche du vôtre. Chaque lien est placé dans un nouvel article sur leur site, écrit pour leurs lecteurs.",
        },
        {
          question: "Dois-je héberger des articles pour d’autres ?",
          answer:
            "C’est ainsi que fonctionne le réseau : votre site peut porter un lien vers un autre client, comme les leurs portent des liens vers vous, et héberger vous fait gagner des crédits. Vous décidez dans les réglages comment votre site participe.",
        },
        {
          question: "Les liens sont-ils en follow ?",
          answer:
            "Oui. RepGet envoie chaque lien partenaire comme un lien normal, en follow. La vérification régulière de la page en ligne signale tout lien modifié par un hôte.",
        },
        {
          question: "Que se passe-t-il si un lien est supprimé ?",
          answer: "Les vérifications continuent de le chercher. Si un lien a définitivement disparu, prévenez-nous et votre crédit vous est rendu.",
        },
        {
          question: "Combien de backlinks vais-je obtenir ?",
          answer:
            "Cela dépend des crédits de votre formule et du nombre d’entreprises de secteurs proches qui publient à ce moment-là. Votre page Backlinks affiche chaque lien dès qu’il arrive.",
        },
      ],
      closingTitle: "Obtenez vos premiers backlinks sans envoyer un e-mail",
      closingBody: "Commencez avec trois articles gratuits, et découvrez votre tableau de bord par vous-même.",
      ui: { published: "Publié", minRead: "{n} min de lecture", compared: "Comparaison", newTab: "(s’ouvre dans un nouvel onglet)" },
    },
    chatgpt: {
      path: "/rank-on-chatgpt",
      metaTitle: "Comment apparaître dans ChatGPT et être recommandé",
      metaDescription:
        "Aidez ChatGPT et les assistants d’IA à trouver et citer votre entreprise : vérification des robots d’IA, articles utiles, liens de sites proches et suivi.",
      eyebrow: "Recherche IA",
      title: "Faites recommander votre entreprise",
      accent: "par ChatGPT.",
      intro:
        "Aujourd’hui, on demande aux assistants d’IA quelle entreprise choisir. RepGet vérifie que les assistants peuvent lire votre site, publie des articles clairs qui répondent aux questions de vos clients, obtient des mentions sur des sites proches et suit si votre entreprise est citée.",
      primaryCta: "Créez 3 articles gratuitement",
      secondaryCta: { label: "Lancer l’audit gratuit", href: "/audit" },
      benefitsTitle: "Comment RepGet vous aide à être cité",
      benefits: [
        {
          title: "Les robots d’IA autorisés",
          body: "L’audit lit votre robots.txt et indique si les robots de ChatGPT, Claude, Perplexity et Gemini peuvent lire votre site. Les bloquer par erreur est courant.",
        },
        {
          title: "Des réponses à de vraies questions",
          body: "Les articles sont planifiés à partir de ce que vos clients recherchent réellement, écrits dans votre langue, avec des intertitres clairs, un sommaire et des tableaux comparatifs quand ils sont utiles.",
        },
        {
          title: "Des mentions sur des sites proches",
          body: "Des liens d’entreprises d’un secteur proche, dans de vrais articles, montrent aux assistants que d’autres vous recommandent.",
        },
        {
          title: "Le suivi de votre visibilité dans l’IA",
          body: "Ajoutez les questions que vos clients poseraient à un assistant, 20 avec Grow et 50 avec Scale, et voyez si votre entreprise est citée, et à quel endroit de la réponse.",
        },
      ],
      compare: {
        title: "La recherche IA sans RepGet, et avec",
        without: {
          label: "Sans RepGet",
          points: [
            "Vous ne savez pas si les assistants vous mentionnent",
            "Un robot d’IA bloqué passe inaperçu",
            "Des pages qui ne répondent jamais directement à la question",
            "Peu d’autres sites parlent de vous",
          ],
        },
        with: {
          label: "Avec RepGet",
          points: [
            "Les questions suivies montrent où vous êtes cité",
            "L’audit signale un robot d’IA bloqué",
            "Des articles qui répondent aux questions avec des mots simples",
            "Des liens depuis les articles d’entreprises proches",
          ],
        },
      },
      stepsTitle: "Trois étapes pour être cité",
      steps: [
        {
          title: "Lancez l’audit gratuit",
          body: "Il vérifie quels robots d’IA peuvent lire votre site, ainsi que les bases techniques sur lesquelles s’appuient Google comme les assistants. Aucun compte nécessaire.",
        },
        {
          title: "Publiez des réponses chaque mois",
          body: "RepGet planifie, rédige et publie des articles sur votre site via WordPress, Shopify ou Ghost, selon le calendrier que vous fixez.",
        },
        {
          title: "Suivez votre visibilité dans l’IA",
          body: "Les questions que vous suivez sont reposées au fil du temps, pour que vous voyiez quand votre entreprise commence à être citée.",
        },
      ],
      example: {
        eyebrow: "Un exemple réel",
        title: "Un article écrit pour être cité",
        body: "Publié sur le site de l'entreprise. Voyez comment il est construit :",
        readLabel: "Lire l’article (en anglais)",
        daLabel: "Domain Authority",
        placedLabel: "Lien partenaire dans cet article",
      },
      table: null,
      related: { label: "Lire notre guide (en anglais) : How to Get Mentioned in ChatGPT", href: "/blog/get-mentioned-in-chatgpt" },
      faqTitle: "Questions sur la recherche IA",
      faq: [
        {
          question: "Pouvez-vous garantir que ChatGPT recommandera mon entreprise ?",
          answer:
            "Personne ne le peut : les assistants décident eux-mêmes, et leurs réponses changent. RepGet améliore ce qu’ils peuvent trouver et citer à votre sujet, et vous montre, question par question, si vous êtes cité.",
        },
        {
          question: "Comment les assistants d’IA choisissent-ils les entreprises à mentionner ?",
          answer:
            "Ils s’appuient sur ce qu’ils peuvent lire : votre propre site, des articles qui répondent à la question et ce que d’autres sites disent de vous. Des pages claires et précises comme des mentions sur des sites pertinents y contribuent.",
        },
        {
          question: "Comment fonctionne le suivi ?",
          answer:
            "RepGet pose à un assistant d’IA chaque question que vous suivez, comme le ferait un client, et enregistre les entreprises citées dans la réponse et leur ordre. Quand une vérification ne peut pas aboutir, rien n’est enregistré : un échec ne passe jamais pour une absence.",
        },
        {
          question: "Combien de temps cela prend-il ?",
          answer:
            "Les assistants mettent à jour leurs connaissances à leur propre rythme : comptez en semaines et en mois, pas en jours. Suivre les mêmes questions dans le temps montre l’évolution.",
        },
        {
          question: "Dois-je modifier mon site ?",
          answer:
            "En général, non. L’audit signale ce qui bloque les robots d’IA, et les articles sont publiés sur votre site existant via WordPress, Shopify ou Ghost.",
        },
      ],
      closingTitle: "Découvrez ce que les assistants d’IA disent de votre entreprise",
      closingBody: "Commencez avec trois articles gratuits, ou lancez d’abord l’audit gratuit.",
      ui: { published: "Publié", minRead: "{n} min de lecture", compared: "Comparaison", newTab: "(s’ouvre dans un nouvel onglet)" },
    },
  },

  it: {
    about: "uno studio di video e fotografia di matrimonio in Italia",
    category: "Matrimonio",
    backlinksImageAlt: "Una coppia esce dalla cerimonia di nozze al Castello di Rossino, in Italia, tra gli invitati ai due lati.",
    chatgptImageAlt: "Gli invitati e gli sposi condividono un momento naturale, non in posa, durante un ricevimento di nozze in Italia.",
    chatgptHighlights: [
      "Titoli che sono le domande che le persone si fanno: «Why Do We Feel Awkward in Wedding Photos?»",
      "Un confronto diretto: «Candid vs Posed vs Guided Wedding Photos: What’s the Difference?»",
      "Otto consigli numerati, ognuno una risposta chiara di per sé",
      "Un esempio reale dal lavoro dello studio: «Julia & Mihail in Rome»",
      "Una sezione di domande frequenti verso la fine",
    ],
    backlinks: {
      path: "/backlinks",
      metaTitle: "Backlink da siti di aziende reali",
      metaDescription:
        "RepGet inserisce link al suo sito in nuovi articoli di aziende di settori affini. Link follow, verificati sulla pagina online, crediti inclusi in ogni piano.",
      eyebrow: "Backlink",
      title: "Backlink da siti di aziende reali,",
      accent: "senza inviare una sola email.",
      intro:
        "RepGet inserisce link al suo sito in nuovi articoli pubblicati sui siti di altre aziende di un settore affine. Ogni link compare nella sua dashboard e viene verificato sulla pagina online.",
      primaryCta: "Crei 3 articoli gratis",
      secondaryCta: { label: "Vedi i prezzi", href: "/pricing" },
      benefitsTitle: "Cosa ottiene",
      benefits: [
        {
          title: "Dentro articoli veri",
          body: "Il suo link si trova nel corpo di un articolo scritto per i lettori del sito che lo ospita. Mai in una pagina di link, mai nascosto nel footer.",
        },
        {
          title: "Da un settore affine",
          body: "I link arrivano da aziende di un settore affine al suo, mai da siti senza alcun legame.",
        },
        {
          title: "Link follow",
          body: "Ogni link dei partner viene inviato come un normale link follow, che i motori di ricerca possono considerare. Se chi lo ospita lo modifica, il controllo successivo lo segnala.",
        },
        {
          title: "Crediti inclusi nel piano",
          body: "Ogni piano include crediti ogni mese, e ospitare articoli per altri gliene fa guadagnare altri. Un link usa i suoi crediti solo quando è verificato online.",
        },
      ],
      compare: {
        title: "Link building da soli e con RepGet",
        without: {
          label: "Da soli",
          points: [
            "Scrivere a proprietari di siti che rispondono di rado",
            "Pagare ogni link, o scambiare favori uno alla volta",
            "Link su pagine scritte solo per contenere link",
            "Nessun modo semplice per sapere se un link c’è ancora",
          ],
        },
        with: {
          label: "Con RepGet",
          points: [
            "Nessun contatto da gestire: i link vengono inseriti per lei",
            "Crediti inclusi nel piano",
            "Link dentro nuovi articoli, scritti per lettori veri",
            "Ogni link elencato e verificato sulla pagina online",
          ],
        },
      },
      stepsTitle: "Tre passi per il suo primo backlink",
      steps: [
        {
          title: "Scelga le pagine importanti",
          body: "Ci indichi quali pagine del suo sito devono ricevere link e quali contano di più. RepGet può suggerirle a partire dalla sitemap.",
        },
        {
          title: "Noi inseriamo i link",
          body: "Il team di RepGet inserisce ogni link a mano, dentro un articolo sul sito di un’azienda di un settore affine. Ogni articolo viene revisionato prima di essere pubblicato.",
        },
        {
          title: "Segua ogni link",
          body: "La pagina Backlink elenca ogni link: l’articolo che lo contiene, il sito su cui si trova e il suo stato, dalla ricerca di un sito fino alla pubblicazione.",
        },
      ],
      example: {
        eyebrow: "Un esempio reale",
        title: "Ecco il tipo di articolo in cui va un link",
        body: "I link dei partner vengono inseriti in articoli come questo: scritti per un’azienda reale, per i suoi lettori, e pubblicati sul suo sito.",
        readLabel: "Leggi l’articolo (in inglese)",
        daLabel: "Domain Authority",
        placedLabel: "Link partner in questo articolo",
      },
      table: {
        title: "Il confronto",
        columns: ["Da soli", "Un’agenzia", "RepGet"],
        rows: [
          { label: "Il suo tempo", cells: ["Ore di contatti ogni mese", "Brief e revisione dei report", "Scegliere le pagine una volta sola"] },
          { label: "Dove compaiono i link", cells: ["Dove accetta il proprietario di un sito", "Dipende dall’agenzia", "Dentro nuovi articoli sui siti di aziende affini"] },
          { label: "Vedere ogni link", cells: ["Un suo foglio di calcolo", "Un report mensile", "La sua dashboard, verificata sulla pagina online"] },
          { label: "Come paga", cells: ["A link, o con il suo tempo", "Un canone mensile", "Crediti inclusi nel piano"] },
        ],
      },
      related: { label: "Come funzionano i crediti per i link", href: "/backlink-exchange" },
      faqTitle: "Domande sui backlink",
      faq: [
        {
          question: "Che cos’è un backlink e perché è importante?",
          answer:
            "Un backlink è un link da un altro sito al suo. I motori di ricerca e gli assistenti AI leggono i link da siti pertinenti come un segno che altri garantiscono per le sue pagine, e questo le aiuta a posizionarsi e a essere citate.",
        },
        {
          question: "Da dove arrivano i link?",
          answer:
            "Dai siti di altri clienti RepGet di un settore affine al suo. Ogni link viene inserito in un nuovo articolo sul loro sito, scritto per i loro lettori.",
        },
        {
          question: "Devo ospitare articoli di altri?",
          answer:
            "È così che funziona la rete: il suo sito può contenere un link a un altro cliente, così come i loro siti contengono link al suo, e ospitare le fa guadagnare crediti. Decide lei nelle impostazioni come partecipa il suo sito.",
        },
        {
          question: "I link sono follow?",
          answer:
            "Sì. RepGet invia ogni link partner come un normale link follow. Il controllo periodico della pagina online segnala qualsiasi link modificato da chi lo ospita.",
        },
        {
          question: "Cosa succede se un link viene rimosso?",
          answer: "I controlli continuano a cercarlo. Se un link è sparito definitivamente, ce lo segnali e il credito le viene restituito.",
        },
        {
          question: "Quanti backlink otterrò?",
          answer:
            "Dipende dai crediti del suo piano e da quante aziende affini stanno pubblicando in quel momento. La pagina Backlink mostra ogni link appena arriva.",
        },
      ],
      closingTitle: "Ottenga i primi backlink senza inviare un’email",
      closingBody: "Inizi con tre articoli gratuiti e veda la dashboard con i suoi occhi.",
      ui: { published: "Pubblicato", minRead: "{n} min di lettura", compared: "Confronto", newTab: "(si apre in una nuova scheda)" },
    },
    chatgpt: {
      path: "/rank-on-chatgpt",
      metaTitle: "Come far consigliare la sua attività da ChatGPT",
      metaDescription:
        "RepGet aiuta ChatGPT e altri assistenti AI a trovare e nominare la sua attività: controllo dei crawler AI, articoli su domande reali, link e monitoraggio.",
      eyebrow: "Ricerca AI",
      title: "Faccia consigliare la sua attività",
      accent: "da ChatGPT.",
      intro:
        "Oggi le persone chiedono agli assistenti AI quale attività scegliere. RepGet verifica che gli assistenti possano leggere il suo sito, pubblica articoli chiari che rispondono alle domande dei suoi clienti, ottiene menzioni su siti affini e controlla se la sua attività viene nominata.",
      primaryCta: "Crei 3 articoli gratis",
      secondaryCta: { label: "Avvia l’audit gratuito", href: "/audit" },
      benefitsTitle: "Come RepGet la aiuta a essere nominato",
      benefits: [
        {
          title: "Crawler AI ammessi",
          body: "L’audit legge il suo robots.txt e mostra se i crawler di ChatGPT, Claude, Perplexity e Gemini possono leggere il suo sito. Bloccarli per errore è frequente.",
        },
        {
          title: "Risposte a domande reali",
          body: "Gli articoli sono pianificati a partire da ciò che i suoi clienti cercano davvero, scritti nella sua lingua, con titoli chiari, un indice e tabelle di confronto quando servono.",
        },
        {
          title: "Menzioni su siti affini",
          body: "I link da aziende di un settore affine, dentro articoli veri, mostrano agli assistenti che altri garantiscono per lei.",
        },
        {
          title: "Monitoraggio della visibilità nell’AI",
          body: "Aggiunga le domande che i suoi clienti farebbero a un assistente, 20 con Grow e 50 con Scale, e veda se la sua attività viene nominata e in quale punto della risposta.",
        },
      ],
      compare: {
        title: "La ricerca AI senza RepGet e con RepGet",
        without: {
          label: "Senza RepGet",
          points: [
            "Non sa se gli assistenti la menzionano",
            "Un crawler AI bloccato passa inosservato",
            "Pagine che non rispondono mai direttamente alla domanda",
            "Pochi altri siti parlano di lei",
          ],
        },
        with: {
          label: "Con RepGet",
          points: [
            "Le domande monitorate mostrano dove viene nominato",
            "L’audit segnala un crawler AI bloccato",
            "Articoli che rispondono alle domande con parole semplici",
            "Link dagli articoli di aziende affini",
          ],
        },
      },
      stepsTitle: "Tre passi per essere nominati",
      steps: [
        {
          title: "Avvii l’audit gratuito",
          body: "Controlla quali crawler AI possono leggere il suo sito e le basi tecniche su cui si appoggiano sia Google sia gli assistenti. Non serve un account.",
        },
        {
          title: "Pubblichi risposte ogni mese",
          body: "RepGet pianifica, scrive e pubblica articoli sul suo sito tramite WordPress, Shopify o Ghost, secondo il calendario che sceglie lei.",
        },
        {
          title: "Monitori la sua visibilità nell’AI",
          body: "Le domande che monitora vengono ripetute nel tempo, così può vedere quando la sua attività inizia a essere nominata.",
        },
      ],
      example: {
        eyebrow: "Un esempio reale",
        title: "Un articolo scritto per essere citato",
        body: "Pubblicato sul sito dell’azienda. Noti come è costruito:",
        readLabel: "Leggi l’articolo (in inglese)",
        daLabel: "Domain Authority",
        placedLabel: "Link partner in questo articolo",
      },
      table: null,
      related: { label: "Legga la nostra guida (in inglese): How to Get Mentioned in ChatGPT", href: "/blog/get-mentioned-in-chatgpt" },
      faqTitle: "Domande sulla ricerca AI",
      faq: [
        {
          question: "Potete garantire che ChatGPT consiglierà la mia attività?",
          answer:
            "Nessuno può farlo: gli assistenti decidono da soli e le loro risposte cambiano. RepGet migliora ciò che possono trovare e citare su di lei e le mostra, domanda per domanda, se viene nominato.",
        },
        {
          question: "Come scelgono gli assistenti AI quali attività menzionare?",
          answer:
            "Si basano su ciò che possono leggere: il suo sito, articoli che rispondono alla domanda e ciò che altri siti dicono di lei. Aiutano sia pagine chiare e specifiche sia menzioni su siti pertinenti.",
        },
        {
          question: "Come funziona il monitoraggio?",
          answer:
            "RepGet pone a un assistente AI ogni domanda che lei monitora, come farebbe un cliente, e registra quali attività vengono nominate nella risposta e in che ordine. Quando un controllo non può essere completato non viene registrato nulla, così un errore non sembra mai un’assenza.",
        },
        {
          question: "Quanto tempo ci vuole?",
          answer:
            "Gli assistenti aggiornano ciò che sanno con i loro tempi: ragioni in settimane e mesi, non in giorni. Monitorare le stesse domande nel tempo mostra il cambiamento.",
        },
        {
          question: "Devo modificare il mio sito?",
          answer:
            "Di solito no. L’audit segnala ciò che blocca i crawler AI e gli articoli vengono pubblicati sul suo sito attuale tramite WordPress, Shopify o Ghost.",
        },
      ],
      closingTitle: "Scopra cosa dicono gli assistenti AI della sua attività",
      closingBody: "Inizi con tre articoli gratuiti, oppure avvii prima l’audit gratuito.",
      ui: { published: "Pubblicato", minRead: "{n} min di lettura", compared: "Confronto", newTab: "(si apre in una nuova scheda)" },
    },
  },

  de: {
    about: "ein Studio für Hochzeitsfilme und -fotografie in Italien",
    category: "Hochzeit",
    backlinksImageAlt: "Ein Paar verlässt seine Trauung im Castello di Rossino in Italien, die Gäste stehen zu beiden Seiten.",
    chatgptImageAlt: "Gäste und das Brautpaar teilen einen natürlichen, ungestellten Moment bei einer Hochzeitsfeier in Italien.",
    chatgptHighlights: [
      "Überschriften, die die Fragen der Leute sind: „Why Do We Feel Awkward in Wedding Photos?“",
      "Ein direkter Vergleich: „Candid vs Posed vs Guided Wedding Photos: What’s the Difference?“",
      "Acht nummerierte Tipps, jeder für sich eine klare Antwort",
      "Ein echtes Beispiel aus der Arbeit des Studios: „Julia & Mihail in Rome“",
      "Ein Abschnitt mit häufigen Fragen gegen Ende",
    ],
    backlinks: {
      path: "/backlinks",
      metaTitle: "Backlinks von echten Unternehmenswebsites",
      metaDescription:
        "RepGet platziert Links zu Ihrer Website in neuen Artikeln auf Websites verwandter Branchen. Follow-Links, live geprüft, mit Credits in jedem Tarif.",
      eyebrow: "Backlinks",
      title: "Backlinks von echten Unternehmenswebsites,",
      accent: "ohne eine einzige Outreach-E-Mail.",
      intro:
        "RepGet platziert Links zu Ihrer Website in neuen Artikeln, die auf den Websites anderer Unternehmen aus einer verwandten Branche erscheinen. Jeder Link steht in Ihrem Dashboard und wird auf der Live-Seite geprüft.",
      primaryCta: "3 Artikel kostenlos erstellen",
      secondaryCta: { label: "Preise ansehen", href: "/pricing" },
      benefitsTitle: "Was Sie bekommen",
      benefits: [
        {
          title: "In echten Artikeln",
          body: "Ihr Link steht im Text eines Artikels, der für die Leser des Gastgebers geschrieben ist. Nie auf einer Linkseite, nie versteckt im Footer.",
        },
        {
          title: "Aus einer verwandten Branche",
          body: "Die Links kommen von Unternehmen aus einer Branche, die mit Ihrer verwandt ist, nie von themenfremden Websites.",
        },
        {
          title: "Follow-Links",
          body: "Jeder Partnerlink wird als normaler Follow-Link gesetzt, den Suchmaschinen werten können. Ändert ein Gastgeber ihn, meldet es die nächste Prüfung.",
        },
        {
          title: "Credits sind im Tarif enthalten",
          body: "Jeder Tarif enthält jeden Monat Credits, und wer Artikel für andere hostet, verdient weitere. Ein Link verbraucht seine Credits erst, wenn er live bestätigt ist.",
        },
      ],
      compare: {
        title: "Linkaufbau allein und mit RepGet",
        without: {
          label: "Allein",
          points: [
            "Website-Betreiber anschreiben, die selten antworten",
            "Für jeden Link zahlen oder Gefallen einzeln tauschen",
            "Links auf Seiten, die nur für Links geschrieben wurden",
            "Kein einfacher Weg zu prüfen, ob ein Link noch da ist",
          ],
        },
        with: {
          label: "Mit RepGet",
          points: [
            "Kein Outreach: Die Links werden für Sie platziert",
            "Credits sind in Ihrem Tarif enthalten",
            "Links in neuen Artikeln, geschrieben für echte Leser",
            "Jeder Link aufgelistet und auf der Live-Seite geprüft",
          ],
        },
      },
      stepsTitle: "In drei Schritten zum ersten Backlink",
      steps: [
        {
          title: "Wählen Sie Ihre wichtigen Seiten",
          body: "Sagen Sie uns, welche Seiten Ihrer Website Links bekommen sollen und welche am wichtigsten sind. RepGet kann sie anhand Ihrer Sitemap vorschlagen.",
        },
        {
          title: "Wir platzieren die Links",
          body: "Das RepGet-Team platziert jeden Link von Hand in einem Artikel auf der Website eines Unternehmens aus einer verwandten Branche. Jeder Artikel wird vor der Veröffentlichung geprüft.",
        },
        {
          title: "Verfolgen Sie jeden Link",
          body: "Ihre Backlinks-Seite listet jeden Link auf: den Artikel, der ihn enthält, die Website, auf der er steht, und seinen Status, von der Suche nach einer Website bis zur Veröffentlichung.",
        },
      ],
      example: {
        eyebrow: "Ein echtes Beispiel",
        title: "In solchen Artikeln stehen die Links",
        body: "Partnerlinks werden in Artikeln wie diesem platziert: für ein echtes Unternehmen geschrieben, für dessen eigene Leser, und auf dessen eigener Website veröffentlicht.",
        readLabel: "Artikel lesen (auf Englisch)",
        daLabel: "Domain Authority",
        placedLabel: "Partnerlink in diesem Artikel",
      },
      table: {
        title: "Der Vergleich",
        columns: ["Allein", "Eine Agentur", "RepGet"],
        rows: [
          { label: "Ihre Zeit", cells: ["Jeden Monat Stunden für Outreach", "Briefings und Berichte prüfen", "Einmal Ihre Seiten auswählen"] },
          { label: "Wo Links erscheinen", cells: ["Wo ein Website-Betreiber zustimmt", "Hängt von der Agentur ab", "In neuen Artikeln auf Websites verwandter Unternehmen"] },
          { label: "Jeden Link sehen", cells: ["Ihre eigene Tabelle", "Ein Monatsbericht", "Ihr Dashboard, auf der Live-Seite geprüft"] },
          { label: "Wie Sie bezahlen", cells: ["Pro Link oder mit Ihrer Zeit", "Eine monatliche Gebühr", "Credits in Ihrem Tarif enthalten"] },
        ],
      },
      related: { label: "So funktionieren Credits für Links", href: "/backlink-exchange" },
      faqTitle: "Fragen zu Backlinks",
      faq: [
        {
          question: "Was ist ein Backlink und warum ist er wichtig?",
          answer:
            "Ein Backlink ist ein Link von einer anderen Website auf Ihre. Suchmaschinen und KI-Assistenten werten Links von relevanten Websites als Zeichen, dass andere für Ihre Seiten bürgen. Das hilft diesen Seiten, zu ranken und zitiert zu werden.",
        },
        {
          question: "Woher kommen die Links?",
          answer:
            "Von den Websites anderer RepGet-Kunden aus einer Branche, die mit Ihrer verwandt ist. Jeder Link wird in einem neuen Artikel auf deren Website platziert, geschrieben für deren Leser.",
        },
        {
          question: "Muss ich Artikel für andere hosten?",
          answer:
            "So funktioniert das Netzwerk: Ihre Website kann einen Link zu einem anderen Kunden tragen, so wie deren Websites Links zu Ihnen tragen, und das Hosten bringt Ihnen Credits. Wie Ihre Website teilnimmt, entscheiden Sie in den Einstellungen.",
        },
        {
          question: "Sind die Links follow?",
          answer:
            "Ja. RepGet setzt jeden Partnerlink als normalen Follow-Link. Die regelmäßige Prüfung der Live-Seite meldet jeden Link, den ein Gastgeber verändert hat.",
        },
        {
          question: "Was passiert, wenn ein Link entfernt wird?",
          answer: "Die Prüfungen suchen weiter nach ihm. Ist ein Link endgültig verschwunden, sagen Sie uns Bescheid, und Sie bekommen Ihren Credit zurück.",
        },
        {
          question: "Wie viele Backlinks bekomme ich?",
          answer:
            "Das hängt von den Credits Ihres Tarifs ab und davon, wie viele verwandte Unternehmen gerade veröffentlichen. Ihre Backlinks-Seite zeigt jeden Link, sobald er da ist.",
        },
      ],
      closingTitle: "Ihre ersten Backlinks, ohne eine E-Mail zu schreiben",
      closingBody: "Starten Sie mit drei kostenlosen Artikeln und sehen Sie sich Ihr Dashboard selbst an.",
      ui: { published: "Veröffentlicht", minRead: "{n} Min. Lesezeit", compared: "Verglichen", newTab: "(öffnet in einem neuen Tab)" },
    },
    chatgpt: {
      path: "/rank-on-chatgpt",
      metaTitle: "So erscheinen Sie in ChatGPT und werden empfohlen",
      metaDescription:
        "RepGet hilft ChatGPT und anderen KI-Assistenten, Ihr Unternehmen zu finden und zu nennen: KI-Crawler-Check, Artikel zu echten Fragen, Links und Tracking.",
      eyebrow: "KI-Suche",
      title: "Lassen Sie Ihr Unternehmen",
      accent: "von ChatGPT empfehlen.",
      intro:
        "Heute fragen Menschen KI-Assistenten, welches Unternehmen sie wählen sollen. RepGet prüft, ob Assistenten Ihre Website lesen können, veröffentlicht klare Artikel, die die Fragen Ihrer Kunden beantworten, sorgt für Erwähnungen auf verwandten Websites und verfolgt, ob Ihr Unternehmen genannt wird.",
      primaryCta: "3 Artikel kostenlos erstellen",
      secondaryCta: { label: "Kostenloses Audit starten", href: "/audit" },
      benefitsTitle: "Wie RepGet Ihnen hilft, genannt zu werden",
      benefits: [
        {
          title: "KI-Crawler zugelassen",
          body: "Das Audit liest Ihre robots.txt und zeigt, ob die Crawler von ChatGPT, Claude, Perplexity und Gemini Ihre Website lesen dürfen. Sie versehentlich zu blockieren, ist häufig.",
        },
        {
          title: "Antworten auf echte Fragen",
          body: "Die Artikel werden danach geplant, wonach Ihre Kunden tatsächlich suchen, und in Ihrer Sprache geschrieben, mit klaren Überschriften, einem Inhaltsverzeichnis und Vergleichstabellen, wo sie helfen.",
        },
        {
          title: "Erwähnungen auf verwandten Websites",
          body: "Links von Unternehmen aus einer verwandten Branche, in echten Artikeln, zeigen Assistenten, dass andere für Sie bürgen.",
        },
        {
          title: "Tracking der KI-Sichtbarkeit",
          body: "Fügen Sie die Fragen hinzu, die Ihre Kunden einem Assistenten stellen würden, 20 im Grow- und 50 im Scale-Tarif, und sehen Sie, ob Ihr Unternehmen genannt wird und an welcher Stelle der Antwort.",
        },
      ],
      compare: {
        title: "KI-Suche ohne RepGet und mit RepGet",
        without: {
          label: "Ohne RepGet",
          points: [
            "Sie wissen nicht, ob Assistenten Sie erwähnen",
            "Ein blockierter KI-Crawler bleibt unbemerkt",
            "Seiten, die die Frage nie direkt beantworten",
            "Nur wenige andere Websites sprechen über Sie",
          ],
        },
        with: {
          label: "Mit RepGet",
          points: [
            "Verfolgte Fragen zeigen, wo Sie genannt werden",
            "Das Audit meldet einen blockierten KI-Crawler",
            "Artikel, die Fragen in einfachen Worten beantworten",
            "Links aus Artikeln verwandter Unternehmen",
          ],
        },
      },
      stepsTitle: "In drei Schritten genannt werden",
      steps: [
        {
          title: "Starten Sie das kostenlose Audit",
          body: "Es prüft, welche KI-Crawler Ihre Website lesen dürfen, und die technischen Grundlagen, auf die sich Google und Assistenten verlassen. Kein Konto nötig.",
        },
        {
          title: "Veröffentlichen Sie jeden Monat Antworten",
          body: "RepGet plant, schreibt und veröffentlicht Artikel auf Ihrer Website über WordPress, Shopify oder Ghost, nach dem Zeitplan, den Sie festlegen.",
        },
        {
          title: "Verfolgen Sie Ihre KI-Sichtbarkeit",
          body: "Die Fragen, die Sie verfolgen, werden im Lauf der Zeit erneut gestellt. So sehen Sie, wann Ihr Unternehmen genannt wird.",
        },
      ],
      example: {
        eyebrow: "Ein echtes Beispiel",
        title: "Ein Artikel, geschrieben, um zitiert zu werden",
        body: "Auf der eigenen Website des Unternehmens veröffentlicht. Achten Sie auf den Aufbau:",
        readLabel: "Artikel lesen (auf Englisch)",
        daLabel: "Domain Authority",
        placedLabel: "Partnerlink in diesem Artikel",
      },
      table: null,
      related: { label: "Unser Leitfaden (auf Englisch): How to Get Mentioned in ChatGPT", href: "/blog/get-mentioned-in-chatgpt" },
      faqTitle: "Fragen zur KI-Suche",
      faq: [
        {
          question: "Können Sie garantieren, dass ChatGPT mein Unternehmen empfiehlt?",
          answer:
            "Das kann niemand: Assistenten entscheiden selbst, und ihre Antworten ändern sich. RepGet verbessert, was sie über Sie finden und zitieren können, und zeigt Ihnen Frage für Frage, ob Sie genannt werden.",
        },
        {
          question: "Wie wählen KI-Assistenten aus, welche Unternehmen sie nennen?",
          answer:
            "Sie stützen sich auf das, was sie lesen können: Ihre eigene Website, Artikel, die die Frage beantworten, und was andere Websites über Sie sagen. Klare, konkrete Seiten helfen ebenso wie Erwähnungen auf relevanten Websites.",
        },
        {
          question: "Wie funktioniert das Tracking?",
          answer:
            "RepGet stellt einem KI-Assistenten jede Frage, die Sie verfolgen, so wie es ein Kunde tun würde, und erfasst, welche Unternehmen die Antwort nennt und in welcher Reihenfolge. Kann eine Prüfung nicht abgeschlossen werden, wird nichts erfasst. So sieht ein Fehler nie wie ein Fehlen aus.",
        },
        {
          question: "Wie lange dauert es?",
          answer:
            "Assistenten aktualisieren ihr Wissen in ihrem eigenen Tempo. Rechnen Sie also in Wochen und Monaten, nicht in Tagen. Wer dieselben Fragen über die Zeit verfolgt, sieht die Veränderung.",
        },
        {
          question: "Muss ich meine Website ändern?",
          answer:
            "Meist nicht. Das Audit zeigt, was KI-Crawler blockiert, und die Artikel werden über WordPress, Shopify oder Ghost auf Ihrer bestehenden Website veröffentlicht.",
        },
      ],
      closingTitle: "Finden Sie heraus, was KI-Assistenten über Ihr Unternehmen sagen",
      closingBody: "Starten Sie mit drei kostenlosen Artikeln oder zuerst mit dem kostenlosen Audit.",
      ui: { published: "Veröffentlicht", minRead: "{n} Min. Lesezeit", compared: "Verglichen", newTab: "(öffnet in einem neuen Tab)" },
    },
  },
};
