import type { Locale } from "@/lib/i18n/config";
import type { BlogFormat } from "@/lib/tools/blog-writer-shared";
import type { ToolUsePath } from "@/lib/tools/free-tools";

/**
 * The free AI Blog Writer (owner, 2026-11-27, repget-blog-writer-free-preview.html)
 * in every language. English follows the mockup's wording; the writing
 * samples are the mockup's, word for word, and translated for the other
 * languages. Its own file: lib/i18n/messages.ts is shared by every page.
 */

export type BlogSample = {
  title: string;
  credit: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

export type BlogWriterCopy = {
  /** For search results (70-158 characters). */
  metaDescription: string;
  /** "← All free tools". */
  backLink: string;
  /** Under the h1. */
  description: string;
  samplesTitle: string;
  formats: Record<BlogFormat, string>;
  form: {
    title: string;
    topicLabel: string;
    topicPlaceholder: string;
    formatLabel: string;
    notesLabel: string;
    notesPlaceholder: string;
    submit: string;
    writing: string;
    hint: string;
    copyBrief: string;
    saved: string;
    copied: string;
    copyFallback: string;
  };
  result: {
    /** The label above the opening: how it was written. */
    methods: Record<ToolUsePath, string>;
    heading: string;
    editLabel: string;
    copyOpening: string;
    cta: string;
    ctaHint: string;
    replaceConfirm: string;
    /** When the AI writer could not answer and the template did. */
    fallbackNote: string;
  };
  sampleLabel: string;
  /** The sign-up prompt after an opening. */
  prompt: { title: string; body: string; button: string; dismiss: string };
  footer: { name: string; explore: string };
  /** The template's closing line, per format. */
  closings: Record<BlogFormat, string>;
  samples: Record<BlogFormat, BlogSample>;
  explainer: { heading: string; body: string }[];
};

const EN: BlogWriterCopy = {
  metaDescription: "Free AI blog writer: turn your customers' question and your own advice into an editable article title and opening. No signup needed.",
  backLink: "← All free tools",
  description: "Get an editable opening for your own article before you sign up.",
  samplesTitle: "Explore writing samples",
  formats: { guide: "How-to guide", comparison: "Comparison", checklist: "Checklist" },
  form: {
    title: "Your article brief",
    topicLabel: "What are your customers asking?",
    topicPlaceholder: "How much time should we leave for wedding portraits on Lake Como?",
    formatLabel: "Article format",
    notesLabel: "In one sentence, what would you tell the reader?",
    notesPlaceholder: "We work backwards from the aperitivo and include the walk to the boat in the portrait window.",
    submit: "Write my opening",
    writing: "Writing your opening…",
    hint: "We use the AI built into your browser when it has one. If not, RepGet writes the opening, and a simple template steps in when neither can. Only the opening is written here.",
    copyBrief: "Copy my brief",
    saved: "Saved on this device",
    copied: "Copied",
    copyFallback: "Use your device's Copy command.",
  },
  result: {
    methods: { on_device: "On-device AI opening", server: "AI opening by RepGet", template: "Template-assisted opening" },
    heading: "Your article opening",
    editLabel: "Your article opening, editable",
    copyOpening: "Copy opening",
    cta: "Write the full article in RepGet",
    ctaHint: "Copy your opening to continue in the RepGet editor.",
    replaceConfirm: "Replace your edited opening?",
    fallbackNote: "Our AI writer is not available right now, so this opening follows a template. Edit it freely.",
  },
  sampleLabel: "Complete writing sample",
  prompt: {
    title: "Sign up free to get the full article",
    body: "This is only the opening. In RepGet, the same brief becomes a complete article you can edit and publish.",
    button: "Sign up free",
    dismiss: "Not now",
  },
  footer: { name: "RepGet · AI Blog Writer", explore: "Explore free tools" },
  closings: {
    guide: "The easiest way to put that advice to work is to try it on one real example. Pick the next decision in front of you, apply the same rule and see what changes.",
    comparison: "Use that point to compare the options side by side. What would each choice mean in practice, and which trade-off would you be willing to live with?",
    checklist: "Keep that point at the top of your checklist. Before you move on, identify who will handle it and what you will look for to confirm it is done.",
  },
  samples: {
    guide: {
      title: "How to plan Lake Como wedding portraits around the aperitivo",
      credit: "Image Studio / Wedding photography · imagestudio.com",
      intro:
        "Start with the photograph you would hate to miss. For some couples, it is the two of them on a wooden boat. For others, it is a grandfather raising his glass at the aperitivo. Both belong on the timeline. The order in which you plan them matters.",
      sections: [
        {
          heading: "Choose your return time first",
          body: "Ask your planner when guests will gather for drinks and when everyone will move to dinner. Choose the part you want to be there for. If it is the first toast, write that down as a fixed appointment before choosing a pier or a portrait location.",
        },
        {
          heading: "Count the time outside the photograph",
          body: "Walk from the ceremony exit to the boarding point in the shoes you will wear. Then ask the boat operator about boarding, turning and docking. A short ride can fit on paper while the walk back through the gardens quietly consumes the rest of the break.",
        },
        {
          heading: "Give the plan a shorter version",
          body: "Choose a second location within sight of the reception. If speeches run late, you can take portraits on the terrace and still hear the toast. Put both locations on the planner’s copy of the schedule so nobody needs to interrupt you for a decision.",
        },
      ],
    },
    comparison: {
      title: "Whole beans or ground coffee for your first filter brewer?",
      credit: "Coffee roaster / Buying guide",
      intro:
        "A bag of whole beans gives you a choice to make every morning. A bag ground at the roastery lets you make that choice once. Which one suits you depends on the equipment on your counter and how much of the brewing process you enjoy.",
      sections: [
        {
          heading: "Choose ground coffee if your setup is simple",
          body: "Tell the roaster which brewer you own and ask them to grind a small bag for it. At home, keep your dose and water amount consistent for the first few cups. You can learn what the coffee tastes like before deciding whether you enjoy adjusting the recipe.",
        },
        {
          heading: "Choose whole beans if you like to experiment",
          body: "A grinder lets you change one setting between brews. Try two cups from the same bag with the same dose and water. Change the grind slightly for the second cup and taste them side by side. That quick comparison teaches you more about your preference than a long list of tasting notes.",
        },
        {
          heading: "Make the decision at the counter",
          body: "If you already have an adjustable grinder, buy whole beans and ask the roaster for a starting setting. If your kitchen has only a kettle and a filter brewer, ask for a small bag ground for that brewer. You can make a good first cup with either setup.",
        },
      ],
    },
    checklist: {
      title: "A first-run checklist for a reporting dashboard",
      credit: "Software company / Customer onboarding",
      intro:
        "Before inviting the whole team, ask one person to use the dashboard to answer one real question. “What did we sell last week?” is a better first test than a tour of every chart. Use the checklist below while you watch them work.",
      sections: [
        {
          heading: "1. Pick a number someone can verify",
          body: "Choose a completed period and a figure the team already trusts. Write down the source, date range and time zone. If the dashboard shows a different total, those three details give you somewhere to start.",
        },
        {
          heading: "2. Connect the smallest useful data source",
          body: "Import the source that answers the first question. Leave the other connections for later. Check that dates, currency and refunds are handled the way the person reading the report expects.",
        },
        {
          heading: "3. Ask a teammate to find the answer",
          body: "Give them the original question and stop explaining the interface. Notice the first label they hesitate over. Rename that label or adjust the default date range, then repeat the test with a second teammate.",
        },
        {
          heading: "4. Save the view that worked",
          body: "Give the report a name people will recognise, such as “Last week’s sales”. Send a link to that view and ask the recipient to reply with the figure they see. Their reply tells you whether the handoff worked.",
        },
      ],
    },
  },
  explainer: [
    {
      heading: "Start from what you already know",
      body: "The best articles answer a question your customers really ask, with advice only you can give. Write both down in a sentence each and the opening follows from them, in your words rather than generic filler.",
    },
    {
      heading: "From an opening to a full article",
      body: "This free tool writes the title and the first paragraph. In RepGet, the same brief becomes a complete article you can edit, schedule and publish to your website.",
    },
  ],
};

const ES: BlogWriterCopy = {
  metaDescription: "Redactor de blog con IA gratis: convierta la pregunta de sus clientes y su propio consejo en un título y una introducción editables. Sin registro.",
  backLink: "← Todas las herramientas gratis",
  description: "Obtenga una introducción editable para su propio artículo antes de registrarse.",
  samplesTitle: "Explore ejemplos de redacción",
  formats: { guide: "Guía práctica", comparison: "Comparativa", checklist: "Lista de control" },
  form: {
    title: "El encargo de su artículo",
    topicLabel: "¿Qué preguntan sus clientes?",
    topicPlaceholder: "¿Cuánto tiempo debemos dejar para los retratos de boda en el lago de Como?",
    formatLabel: "Formato del artículo",
    notesLabel: "En una frase, ¿qué le diría al lector?",
    notesPlaceholder: "Planificamos hacia atrás desde el aperitivo e incluimos el paseo hasta el barco en el tiempo de los retratos.",
    submit: "Escribir mi introducción",
    writing: "Escribiendo su introducción…",
    hint: "Usamos la IA integrada en su navegador si la tiene. Si no, RepGet escribe la introducción, y una plantilla sencilla la sustituye cuando ninguna de las dos puede. Aquí solo se escribe la introducción.",
    copyBrief: "Copiar mi encargo",
    saved: "Guardado en este dispositivo",
    copied: "Copiado",
    copyFallback: "Use la función Copiar de su dispositivo.",
  },
  result: {
    methods: { on_device: "Introducción con la IA del dispositivo", server: "Introducción con IA de RepGet", template: "Introducción con plantilla" },
    heading: "La introducción de su artículo",
    editLabel: "La introducción de su artículo, editable",
    copyOpening: "Copiar introducción",
    cta: "Escribir el artículo completo en RepGet",
    ctaHint: "Copie su introducción para continuar en el editor de RepGet.",
    replaceConfirm: "¿Sustituir la introducción que ha editado?",
    fallbackNote: "Nuestro redactor con IA no está disponible ahora, así que esta introducción sigue una plantilla. Edítela a su gusto.",
  },
  sampleLabel: "Ejemplo de redacción completo",
  prompt: {
    title: "Regístrese gratis para obtener el artículo completo",
    body: "Esto es solo la introducción. En RepGet, el mismo encargo se convierte en un artículo completo que puede editar y publicar.",
    button: "Registrarse gratis",
    dismiss: "Ahora no",
  },
  footer: { name: "RepGet · Redactor de blog con IA", explore: "Explorar herramientas gratis" },
  closings: {
    guide: "La forma más sencilla de aplicar ese consejo es probarlo con un ejemplo real. Elija la próxima decisión que tenga delante, aplique la misma regla y observe qué cambia.",
    comparison: "Use ese punto para comparar las opciones una al lado de la otra. ¿Qué supondría cada opción en la práctica y con qué inconveniente estaría dispuesto a convivir?",
    checklist: "Mantenga ese punto al principio de su lista de control. Antes de seguir, decida quién se encargará de él y qué comprobará para confirmar que está hecho.",
  },
  samples: {
    guide: {
      title: "Cómo planificar los retratos de boda en el lago de Como en torno al aperitivo",
      credit: "Image Studio / Fotografía de bodas · imagestudio.com",
      intro:
        "Empiece por la fotografía que no le gustaría perderse. Para algunas parejas, son los dos en una barca de madera. Para otras, es un abuelo levantando su copa en el aperitivo. Las dos caben en el programa. El orden en que las planifique importa.",
      sections: [
        {
          heading: "Elija primero la hora de regreso",
          body: "Pregunte a su organizador cuándo se reunirán los invitados para tomar algo y cuándo pasarán todos a la cena. Elija el momento en el que quiere estar presente. Si es el primer brindis, anótelo como una cita fija antes de elegir un embarcadero o un lugar para los retratos.",
        },
        {
          heading: "Cuente el tiempo que queda fuera de la foto",
          body: "Recorra el camino desde la salida de la ceremonia hasta el punto de embarque con los zapatos que llevará. Después pregunte al barquero por el embarque, el giro y el atraque. Un paseo corto puede encajar sobre el papel mientras la vuelta por los jardines se come en silencio el resto de la pausa.",
        },
        {
          heading: "Prepare una versión más corta del plan",
          body: "Elija un segundo lugar a la vista del banquete. Si los discursos se alargan, puede hacer los retratos en la terraza y seguir oyendo el brindis. Anote los dos lugares en la copia del programa del organizador para que nadie tenga que interrumpirle para tomar una decisión.",
        },
      ],
    },
    comparison: {
      title: "¿Café en grano o molido para su primera cafetera de filtro?",
      credit: "Tostador de café / Guía de compra",
      intro:
        "Una bolsa de café en grano le obliga a decidir cada mañana. Una bolsa molida en el tostadero le permite decidir una sola vez. Cuál le conviene depende del equipo que tenga en la encimera y de cuánto disfrute del proceso de preparación.",
      sections: [
        {
          heading: "Elija café molido si su equipo es sencillo",
          body: "Diga al tostador qué cafetera tiene y pídale que le muela una bolsa pequeña para ella. En casa, mantenga la dosis y la cantidad de agua iguales en las primeras tazas. Así descubrirá a qué sabe el café antes de decidir si le gusta ajustar la receta.",
        },
        {
          heading: "Elija café en grano si le gusta experimentar",
          body: "Un molinillo le permite cambiar un solo ajuste entre una preparación y otra. Pruebe dos tazas de la misma bolsa con la misma dosis y la misma agua. Cambie un poco la molienda en la segunda taza y pruébelas una al lado de la otra. Esa comparación rápida le enseña más sobre sus preferencias que una larga lista de notas de cata.",
        },
        {
          heading: "Decida en el mostrador",
          body: "Si ya tiene un molinillo ajustable, compre café en grano y pida al tostador un ajuste de partida. Si en su cocina solo hay un hervidor y una cafetera de filtro, pida una bolsa pequeña molida para esa cafetera. Con cualquiera de los dos equipos puede preparar una buena primera taza.",
        },
      ],
    },
    checklist: {
      title: "Lista de control para el primer uso de un panel de informes",
      credit: "Empresa de software / Incorporación de clientes",
      intro:
        "Antes de invitar a todo el equipo, pida a una persona que use el panel para responder a una pregunta real. «¿Qué vendimos la semana pasada?» es una primera prueba mejor que un recorrido por todos los gráficos. Use la lista siguiente mientras la observa trabajar.",
      sections: [
        {
          heading: "1. Elija una cifra que alguien pueda comprobar",
          body: "Elija un periodo ya cerrado y una cifra en la que el equipo ya confíe. Anote la fuente, el intervalo de fechas y la zona horaria. Si el panel muestra otro total, esos tres datos le dan un punto de partida.",
        },
        {
          heading: "2. Conecte la fuente de datos útil más pequeña",
          body: "Importe la fuente que responde a la primera pregunta. Deje las demás conexiones para más adelante. Compruebe que las fechas, la moneda y los reembolsos se tratan como espera la persona que lee el informe.",
        },
        {
          heading: "3. Pida a un compañero que encuentre la respuesta",
          body: "Dele la pregunta original y deje de explicarle la interfaz. Fíjese en la primera etiqueta ante la que duda. Cambie el nombre de esa etiqueta o ajuste el intervalo de fechas predeterminado y repita la prueba con un segundo compañero.",
        },
        {
          heading: "4. Guarde la vista que funcionó",
          body: "Dé al informe un nombre que la gente reconozca, como «Ventas de la semana pasada». Envíe un enlace a esa vista y pida a quien lo reciba que responda con la cifra que ve. Su respuesta le dirá si el traspaso ha funcionado.",
        },
      ],
    },
  },
  explainer: [
    {
      heading: "Empiece por lo que ya sabe",
      body: "Los mejores artículos responden a una pregunta que sus clientes hacen de verdad, con un consejo que solo usted puede dar. Escriba ambas cosas en una frase cada una y la introducción surge de ellas, con sus palabras y no con relleno genérico.",
    },
    {
      heading: "De una introducción a un artículo completo",
      body: "Esta herramienta gratuita escribe el título y el primer párrafo. En RepGet, el mismo encargo se convierte en un artículo completo que puede editar, programar y publicar en su sitio web.",
    },
  ],
};

const FR: BlogWriterCopy = {
  metaDescription: "Rédacteur de blog IA gratuit : transformez la question de vos clients et votre conseil en un titre et une introduction modifiables. Sans inscription.",
  backLink: "← Tous les outils gratuits",
  description: "Obtenez une introduction modifiable pour votre propre article avant de vous inscrire.",
  samplesTitle: "Découvrez des exemples de rédaction",
  formats: { guide: "Guide pratique", comparison: "Comparatif", checklist: "Liste de contrôle" },
  form: {
    title: "Le brief de votre article",
    topicLabel: "Que vous demandent vos clients ?",
    topicPlaceholder: "Combien de temps prévoir pour les portraits de mariage au lac de Côme ?",
    formatLabel: "Format de l'article",
    notesLabel: "En une phrase, que diriez-vous au lecteur ?",
    notesPlaceholder: "Nous partons de l'heure de l'apéritif et comptons la marche jusqu'au bateau dans le temps des portraits.",
    submit: "Rédiger mon introduction",
    writing: "Rédaction de votre introduction…",
    hint: "Nous utilisons l'IA intégrée à votre navigateur s'il en a une. Sinon, RepGet rédige l'introduction, et un modèle simple prend le relais quand aucune des deux n'est disponible. Seule l'introduction est rédigée ici.",
    copyBrief: "Copier mon brief",
    saved: "Enregistré sur cet appareil",
    copied: "Copié",
    copyFallback: "Utilisez la commande Copier de votre appareil.",
  },
  result: {
    methods: { on_device: "Introduction par l'IA de l'appareil", server: "Introduction par l'IA de RepGet", template: "Introduction à partir d'un modèle" },
    heading: "L'introduction de votre article",
    editLabel: "L'introduction de votre article, modifiable",
    copyOpening: "Copier l'introduction",
    cta: "Rédiger l'article complet dans RepGet",
    ctaHint: "Copiez votre introduction pour continuer dans l'éditeur de RepGet.",
    replaceConfirm: "Remplacer l'introduction que vous avez modifiée ?",
    fallbackNote: "Notre rédacteur IA n'est pas disponible pour le moment : cette introduction suit donc un modèle. Modifiez-la librement.",
  },
  sampleLabel: "Exemple de rédaction complet",
  prompt: {
    title: "Inscrivez-vous gratuitement pour obtenir l'article complet",
    body: "Ce n'est que l'introduction. Dans RepGet, le même brief devient un article complet que vous pouvez modifier et publier.",
    button: "S'inscrire gratuitement",
    dismiss: "Plus tard",
  },
  footer: { name: "RepGet · Rédacteur de blog IA", explore: "Découvrir les outils gratuits" },
  closings: {
    guide: "Le plus simple pour mettre ce conseil en pratique est de l'essayer sur un exemple réel. Prenez la prochaine décision qui vous attend, appliquez la même règle et voyez ce qui change.",
    comparison: "Servez-vous de ce point pour comparer les options côte à côte. Que signifierait chaque choix en pratique, et quel compromis seriez-vous prêt à accepter ?",
    checklist: "Gardez ce point en tête de votre liste de contrôle. Avant de passer à la suite, déterminez qui s'en chargera et ce que vous vérifierez pour confirmer qu'il est fait.",
  },
  samples: {
    guide: {
      title: "Comment organiser les portraits de mariage au lac de Côme autour de l'apéritif",
      credit: "Image Studio / Photographie de mariage · imagestudio.com",
      intro:
        "Commencez par la photo que vous regretteriez de manquer. Pour certains couples, ce sont les deux mariés sur un bateau en bois. Pour d'autres, c'est un grand-père qui lève son verre à l'apéritif. Les deux ont leur place dans le déroulé. L'ordre dans lequel vous les prévoyez compte.",
      sections: [
        {
          heading: "Choisissez d'abord l'heure du retour",
          body: "Demandez à votre organisateur quand les invités se retrouveront pour l'apéritif et quand tout le monde passera à table. Choisissez le moment auquel vous voulez assister. Si c'est le premier toast, notez-le comme un rendez-vous fixe avant de choisir un ponton ou un lieu pour les portraits.",
        },
        {
          heading: "Comptez le temps hors de la photo",
          body: "Faites le trajet entre la sortie de la cérémonie et le point d'embarquement avec les chaussures que vous porterez. Puis interrogez le batelier sur l'embarquement, le demi-tour et l'accostage. Une courte balade tient sur le papier, alors que le retour à pied par les jardins grignote discrètement le reste de la pause.",
        },
        {
          heading: "Prévoyez une version plus courte",
          body: "Choisissez un second lieu en vue de la réception. Si les discours s'éternisent, vous pourrez faire les portraits sur la terrasse et entendre quand même le toast. Notez les deux lieux sur l'exemplaire du planning de l'organisateur pour que personne n'ait à vous interrompre pour trancher.",
        },
      ],
    },
    comparison: {
      title: "Café en grains ou moulu pour votre première cafetière filtre ?",
      credit: "Torréfacteur / Guide d'achat",
      intro:
        "Un sachet de café en grains vous laisse un choix à faire chaque matin. Un sachet moulu chez le torréfacteur vous permet de le faire une seule fois. Lequel vous convient dépend du matériel posé sur votre plan de travail et du plaisir que vous prenez à préparer le café.",
      sections: [
        {
          heading: "Choisissez le moulu si votre matériel est simple",
          body: "Dites au torréfacteur quelle cafetière vous avez et demandez-lui de vous moudre un petit sachet pour elle. À la maison, gardez la même dose et la même quantité d'eau pour les premières tasses. Vous découvrirez le goût du café avant de décider si vous aimez ajuster la recette.",
        },
        {
          heading: "Choisissez les grains si vous aimez expérimenter",
          body: "Un moulin vous permet de changer un seul réglage d'une préparation à l'autre. Essayez deux tasses du même sachet avec la même dose et la même eau. Modifiez légèrement la mouture pour la seconde tasse et goûtez-les côte à côte. Cette comparaison rapide vous en apprend plus sur vos goûts qu'une longue liste de notes de dégustation.",
        },
        {
          heading: "Décidez au comptoir",
          body: "Si vous avez déjà un moulin réglable, achetez des grains et demandez au torréfacteur un réglage de départ. Si votre cuisine ne compte qu'une bouilloire et une cafetière filtre, demandez un petit sachet moulu pour cette cafetière. Les deux installations permettent une bonne première tasse.",
        },
      ],
    },
    checklist: {
      title: "Liste de contrôle pour la première utilisation d'un tableau de bord",
      credit: "Éditeur de logiciels / Prise en main client",
      intro:
        "Avant d'inviter toute l'équipe, demandez à une personne d'utiliser le tableau de bord pour répondre à une vraie question. « Qu'avons-nous vendu la semaine dernière ? » est un meilleur premier test qu'une visite de tous les graphiques. Suivez la liste ci-dessous pendant que vous la regardez faire.",
      sections: [
        {
          heading: "1. Choisissez un chiffre vérifiable",
          body: "Choisissez une période terminée et un chiffre auquel l'équipe se fie déjà. Notez la source, la plage de dates et le fuseau horaire. Si le tableau de bord affiche un autre total, ces trois éléments vous donnent un point de départ.",
        },
        {
          heading: "2. Connectez la plus petite source de données utile",
          body: "Importez la source qui répond à la première question. Gardez les autres connexions pour plus tard. Vérifiez que les dates, la devise et les remboursements sont traités comme l'attend la personne qui lit le rapport.",
        },
        {
          heading: "3. Demandez à un collègue de trouver la réponse",
          body: "Donnez-lui la question de départ et cessez d'expliquer l'interface. Repérez le premier libellé devant lequel il hésite. Renommez ce libellé ou ajustez la plage de dates par défaut, puis refaites le test avec un deuxième collègue.",
        },
        {
          heading: "4. Enregistrez la vue qui a fonctionné",
          body: "Donnez au rapport un nom que chacun reconnaîtra, par exemple « Ventes de la semaine dernière ». Envoyez un lien vers cette vue et demandez au destinataire de répondre avec le chiffre qu'il voit. Sa réponse vous dira si la passation a fonctionné.",
        },
      ],
    },
  },
  explainer: [
    {
      heading: "Partez de ce que vous savez déjà",
      body: "Les meilleurs articles répondent à une question que vos clients posent vraiment, avec un conseil que vous seul pouvez donner. Écrivez chacun en une phrase et l'introduction en découle, avec vos mots plutôt qu'un remplissage générique.",
    },
    {
      heading: "D'une introduction à un article complet",
      body: "Cet outil gratuit rédige le titre et le premier paragraphe. Dans RepGet, le même brief devient un article complet que vous pouvez modifier, planifier et publier sur votre site.",
    },
  ],
};

const IT: BlogWriterCopy = {
  metaDescription: "Blog writer AI gratuito: trasformi la domanda dei suoi clienti e il suo consiglio in un titolo e un incipit modificabili. Senza registrazione.",
  backLink: "← Tutti gli strumenti gratuiti",
  description: "Ottenga un incipit modificabile per il suo articolo prima di registrarsi.",
  samplesTitle: "Scopra esempi di scrittura",
  formats: { guide: "Guida pratica", comparison: "Confronto", checklist: "Checklist" },
  form: {
    title: "Il brief del suo articolo",
    topicLabel: "Che cosa chiedono i suoi clienti?",
    topicPlaceholder: "Quanto tempo dovremmo lasciare per i ritratti di matrimonio sul lago di Como?",
    formatLabel: "Formato dell'articolo",
    notesLabel: "In una frase, che cosa direbbe al lettore?",
    notesPlaceholder: "Partiamo dall'ora dell'aperitivo e includiamo la camminata fino alla barca nel tempo dei ritratti.",
    submit: "Scrivi il mio incipit",
    writing: "Stiamo scrivendo il suo incipit…",
    hint: "Usiamo l'AI integrata nel suo browser, se c'è. Altrimenti RepGet scrive l'incipit, e un semplice modello subentra quando nessuna delle due è disponibile. Qui viene scritto solo l'incipit.",
    copyBrief: "Copia il mio brief",
    saved: "Salvato su questo dispositivo",
    copied: "Copiato",
    copyFallback: "Usi il comando Copia del suo dispositivo.",
  },
  result: {
    methods: { on_device: "Incipit con l'AI del dispositivo", server: "Incipit con l'AI di RepGet", template: "Incipit da modello" },
    heading: "L'incipit del suo articolo",
    editLabel: "L'incipit del suo articolo, modificabile",
    copyOpening: "Copia l'incipit",
    cta: "Scriva l'articolo completo in RepGet",
    ctaHint: "Copi il suo incipit per continuare nell'editor di RepGet.",
    replaceConfirm: "Sostituire l'incipit che ha modificato?",
    fallbackNote: "Il nostro writer AI non è disponibile in questo momento, quindi questo incipit segue un modello. Lo modifichi liberamente.",
  },
  sampleLabel: "Esempio di scrittura completo",
  prompt: {
    title: "Si registri gratis per avere l'articolo completo",
    body: "Questo è solo l'incipit. In RepGet, lo stesso brief diventa un articolo completo da modificare e pubblicare.",
    button: "Registrati gratis",
    dismiss: "Non ora",
  },
  footer: { name: "RepGet · Blog writer AI", explore: "Scopri gli strumenti gratuiti" },
  closings: {
    guide: "Il modo più semplice per mettere in pratica questo consiglio è provarlo su un esempio reale. Prenda la prossima decisione che ha davanti, applichi la stessa regola e veda che cosa cambia.",
    comparison: "Usi questo punto per confrontare le opzioni una accanto all'altra. Che cosa significherebbe ogni scelta nella pratica, e con quale compromesso sarebbe disposto a convivere?",
    checklist: "Tenga questo punto in cima alla sua checklist. Prima di andare avanti, stabilisca chi se ne occuperà e che cosa controllerà per confermare che è fatto.",
  },
  samples: {
    guide: {
      title: "Come organizzare i ritratti di matrimonio sul lago di Como intorno all'aperitivo",
      credit: "Image Studio / Fotografia di matrimonio · imagestudio.com",
      intro:
        "Parta dalla fotografia che le dispiacerebbe perdere. Per alcune coppie sono loro due su una barca di legno. Per altre è un nonno che alza il bicchiere all'aperitivo. Entrambe trovano posto nel programma. Conta l'ordine in cui le pianifica.",
      sections: [
        {
          heading: "Scelga prima l'ora del rientro",
          body: "Chieda al wedding planner quando gli ospiti si ritroveranno per l'aperitivo e quando tutti passeranno alla cena. Scelga il momento a cui vuole essere presente. Se è il primo brindisi, lo segni come un appuntamento fisso prima di scegliere un pontile o un luogo per i ritratti.",
        },
        {
          heading: "Conti il tempo fuori dalla fotografia",
          body: "Percorra il tragitto dall'uscita della cerimonia al punto d'imbarco con le scarpe che indosserà. Poi chieda al barcaiolo dell'imbarco, dell'inversione e dell'attracco. Un breve giro può stare sulla carta mentre il ritorno a piedi tra i giardini si mangia in silenzio il resto della pausa.",
        },
        {
          heading: "Prepari una versione più breve del piano",
          body: "Scelga un secondo luogo in vista del ricevimento. Se i discorsi si allungano, potrà fare i ritratti sulla terrazza e sentire comunque il brindisi. Segni entrambi i luoghi sulla copia del programma del wedding planner, così nessuno dovrà interromperla per una decisione.",
        },
      ],
    },
    comparison: {
      title: "Caffè in grani o macinato per la sua prima macchina a filtro?",
      credit: "Torrefazione / Guida all'acquisto",
      intro:
        "Un sacchetto di caffè in grani le lascia una scelta da fare ogni mattina. Un sacchetto macinato in torrefazione le permette di farla una volta sola. Quale fa per lei dipende dall'attrezzatura che ha sul piano di lavoro e da quanto le piace il processo di preparazione.",
      sections: [
        {
          heading: "Scelga il macinato se la sua attrezzatura è semplice",
          body: "Dica alla torrefazione quale macchina possiede e chieda di macinarle un piccolo sacchetto adatto. A casa, mantenga uguali la dose e la quantità d'acqua per le prime tazze. Scoprirà il sapore del caffè prima di decidere se le piace regolare la ricetta.",
        },
        {
          heading: "Scelga i grani se le piace sperimentare",
          body: "Un macinino le permette di cambiare una sola impostazione tra una preparazione e l'altra. Provi due tazze dallo stesso sacchetto con la stessa dose e la stessa acqua. Cambi leggermente la macinatura per la seconda tazza e le assaggi una accanto all'altra. Quel rapido confronto le insegna sui suoi gusti più di una lunga lista di note di degustazione.",
        },
        {
          heading: "Decida al banco",
          body: "Se ha già un macinino regolabile, compri i grani e chieda alla torrefazione un'impostazione di partenza. Se in cucina ha solo un bollitore e una macchina a filtro, chieda un piccolo sacchetto macinato per quella macchina. Con entrambe le soluzioni può preparare una buona prima tazza.",
        },
      ],
    },
    checklist: {
      title: "Una checklist per il primo utilizzo di una dashboard di report",
      credit: "Azienda software / Onboarding dei clienti",
      intro:
        "Prima di invitare tutto il team, chieda a una persona di usare la dashboard per rispondere a una domanda reale. «Che cosa abbiamo venduto la settimana scorsa?» è un primo test migliore di un giro di tutti i grafici. Usi la checklist qui sotto mentre la osserva lavorare.",
      sections: [
        {
          heading: "1. Scelga un numero che qualcuno possa verificare",
          body: "Scelga un periodo concluso e un dato di cui il team si fida già. Annoti la fonte, l'intervallo di date e il fuso orario. Se la dashboard mostra un totale diverso, questi tre dettagli le danno un punto da cui partire.",
        },
        {
          heading: "2. Colleghi la fonte di dati utile più piccola",
          body: "Importi la fonte che risponde alla prima domanda. Lasci gli altri collegamenti per dopo. Controlli che date, valuta e rimborsi siano gestiti come si aspetta chi legge il report.",
        },
        {
          heading: "3. Chieda a un collega di trovare la risposta",
          body: "Gli dia la domanda originale e smetta di spiegare l'interfaccia. Noti la prima etichetta su cui esita. Rinomini quell'etichetta o modifichi l'intervallo di date predefinito, poi ripeta il test con un secondo collega.",
        },
        {
          heading: "4. Salvi la vista che ha funzionato",
          body: "Dia al report un nome che tutti riconoscano, come «Vendite della settimana scorsa». Invii un link a quella vista e chieda a chi lo riceve di rispondere con il dato che vede. La sua risposta le dirà se il passaggio di consegne ha funzionato.",
        },
      ],
    },
  },
  explainer: [
    {
      heading: "Parta da ciò che sa già",
      body: "I migliori articoli rispondono a una domanda che i suoi clienti fanno davvero, con un consiglio che solo lei può dare. Scriva entrambi in una frase ciascuno e l'incipit nasce da lì, con le sue parole invece che con riempitivi generici.",
    },
    {
      heading: "Da un incipit a un articolo completo",
      body: "Questo strumento gratuito scrive il titolo e il primo paragrafo. In RepGet, lo stesso brief diventa un articolo completo da modificare, programmare e pubblicare sul suo sito.",
    },
  ],
};

const DE: BlogWriterCopy = {
  metaDescription: "Kostenloser KI-Blog-Writer: Machen Sie aus der Frage Ihrer Kunden und Ihrem Rat einen bearbeitbaren Titel und Artikelanfang. Ohne Anmeldung.",
  backLink: "← Alle kostenlosen Tools",
  description: "Erhalten Sie einen bearbeitbaren Anfang für Ihren eigenen Artikel, bevor Sie sich anmelden.",
  samplesTitle: "Schreibbeispiele ansehen",
  formats: { guide: "Anleitung", comparison: "Vergleich", checklist: "Checkliste" },
  form: {
    title: "Ihr Artikel-Briefing",
    topicLabel: "Was fragen Ihre Kunden?",
    topicPlaceholder: "Wie viel Zeit sollten wir für Hochzeitsporträts am Comer See einplanen?",
    formatLabel: "Artikelformat",
    notesLabel: "Was würden Sie dem Leser in einem Satz sagen?",
    notesPlaceholder: "Wir planen vom Aperitif aus rückwärts und rechnen den Weg zum Boot in die Porträtzeit ein.",
    submit: "Meinen Anfang schreiben",
    writing: "Ihr Anfang wird geschrieben…",
    hint: "Wir nutzen die KI Ihres Browsers, wenn er eine hat. Sonst schreibt RepGet den Anfang, und eine einfache Vorlage springt ein, wenn beides nicht geht. Hier wird nur der Anfang geschrieben.",
    copyBrief: "Mein Briefing kopieren",
    saved: "Auf diesem Gerät gespeichert",
    copied: "Kopiert",
    copyFallback: "Nutzen Sie die Kopierfunktion Ihres Geräts.",
  },
  result: {
    methods: { on_device: "Anfang von der KI auf dem Gerät", server: "Anfang von der KI von RepGet", template: "Anfang nach Vorlage" },
    heading: "Der Anfang Ihres Artikels",
    editLabel: "Der Anfang Ihres Artikels, bearbeitbar",
    copyOpening: "Anfang kopieren",
    cta: "Den ganzen Artikel in RepGet schreiben",
    ctaHint: "Kopieren Sie Ihren Anfang, um im RepGet-Editor weiterzumachen.",
    replaceConfirm: "Ihren bearbeiteten Anfang ersetzen?",
    fallbackNote: "Unser KI-Writer ist gerade nicht verfügbar, daher folgt dieser Anfang einer Vorlage. Bearbeiten Sie ihn nach Belieben.",
  },
  sampleLabel: "Vollständiges Schreibbeispiel",
  prompt: {
    title: "Kostenlos anmelden und den ganzen Artikel erhalten",
    body: "Das ist nur der Anfang. In RepGet wird aus demselben Briefing ein vollständiger Artikel, den Sie bearbeiten und veröffentlichen können.",
    button: "Kostenlos anmelden",
    dismiss: "Nicht jetzt",
  },
  footer: { name: "RepGet · KI-Blog-Writer", explore: "Kostenlose Tools entdecken" },
  closings: {
    guide: "Am einfachsten setzen Sie diesen Rat um, indem Sie ihn an einem echten Beispiel ausprobieren. Nehmen Sie die nächste Entscheidung, die vor Ihnen liegt, wenden Sie dieselbe Regel an und sehen Sie, was sich ändert.",
    comparison: "Nutzen Sie diesen Punkt, um die Möglichkeiten nebeneinander zu vergleichen. Was würde jede Wahl in der Praxis bedeuten, und mit welchem Kompromiss könnten Sie leben?",
    checklist: "Setzen Sie diesen Punkt ganz oben auf Ihre Checkliste. Bevor Sie weitermachen, legen Sie fest, wer sich darum kümmert und woran Sie erkennen, dass es erledigt ist.",
  },
  samples: {
    guide: {
      title: "Wie Sie Hochzeitsporträts am Comer See rund um den Aperitif planen",
      credit: "Image Studio / Hochzeitsfotografie · imagestudio.com",
      intro:
        "Beginnen Sie mit dem Foto, das Sie auf keinen Fall verpassen möchten. Für manche Paare sind es die beiden in einem Holzboot. Für andere ist es ein Großvater, der beim Aperitif sein Glas hebt. Beides gehört in den Ablaufplan. Auf die Reihenfolge, in der Sie es planen, kommt es an.",
      sections: [
        {
          heading: "Legen Sie zuerst die Rückkehrzeit fest",
          body: "Fragen Sie Ihre Hochzeitsplanerin, wann sich die Gäste zum Aperitif treffen und wann alle zum Abendessen gehen. Wählen Sie den Teil, bei dem Sie dabei sein möchten. Ist es der erste Toast, notieren Sie ihn als festen Termin, bevor Sie einen Anleger oder einen Ort für die Porträts wählen.",
        },
        {
          heading: "Rechnen Sie die Zeit außerhalb des Fotos mit",
          body: "Gehen Sie den Weg vom Ausgang der Trauung bis zur Anlegestelle in den Schuhen, die Sie tragen werden. Fragen Sie dann den Bootsführer nach Einsteigen, Wenden und Anlegen. Eine kurze Fahrt passt auf dem Papier, während der Rückweg durch die Gärten still den Rest der Pause aufbraucht.",
        },
        {
          heading: "Halten Sie eine kürzere Version bereit",
          body: "Wählen Sie einen zweiten Ort in Sichtweite des Empfangs. Ziehen sich die Reden hin, können Sie die Porträts auf der Terrasse machen und den Toast trotzdem hören. Tragen Sie beide Orte in den Ablaufplan der Planerin ein, damit Sie niemand für eine Entscheidung unterbrechen muss.",
        },
      ],
    },
    comparison: {
      title: "Ganze Bohnen oder gemahlener Kaffee für Ihren ersten Filterkaffeebereiter?",
      credit: "Kaffeerösterei / Kaufberatung",
      intro:
        "Eine Tüte ganzer Bohnen stellt Sie jeden Morgen vor eine Wahl. Eine Tüte, die in der Rösterei gemahlen wurde, lässt Sie diese Wahl einmal treffen. Was zu Ihnen passt, hängt davon ab, was auf Ihrer Arbeitsfläche steht und wie viel Freude Ihnen das Zubereiten macht.",
      sections: [
        {
          heading: "Wählen Sie gemahlenen Kaffee, wenn Ihre Ausstattung einfach ist",
          body: "Sagen Sie der Rösterei, welchen Kaffeebereiter Sie haben, und bitten Sie um eine kleine Tüte, passend dafür gemahlen. Halten Sie zu Hause Kaffeemenge und Wassermenge bei den ersten Tassen gleich. So lernen Sie den Geschmack kennen, bevor Sie entscheiden, ob Ihnen das Anpassen des Rezepts Spaß macht.",
        },
        {
          heading: "Wählen Sie ganze Bohnen, wenn Sie gern experimentieren",
          body: "Mit einer Mühle können Sie zwischen zwei Zubereitungen eine einzige Einstellung ändern. Probieren Sie zwei Tassen aus derselben Tüte mit derselben Kaffee- und Wassermenge. Mahlen Sie für die zweite Tasse etwas anders und probieren Sie beide nebeneinander. Dieser schnelle Vergleich verrät Ihnen mehr über Ihren Geschmack als eine lange Liste von Aromanoten.",
        },
        {
          heading: "Entscheiden Sie an der Theke",
          body: "Haben Sie schon eine verstellbare Mühle, kaufen Sie ganze Bohnen und fragen Sie die Rösterei nach einer Starteinstellung. Gibt es in Ihrer Küche nur einen Wasserkocher und einen Filterkaffeebereiter, bitten Sie um eine kleine Tüte, passend dafür gemahlen. Mit beiden Ausstattungen gelingt eine gute erste Tasse.",
        },
      ],
    },
    checklist: {
      title: "Eine Checkliste für den ersten Einsatz eines Reporting-Dashboards",
      credit: "Softwareunternehmen / Kunden-Onboarding",
      intro:
        "Bevor Sie das ganze Team einladen, bitten Sie eine Person, mit dem Dashboard eine echte Frage zu beantworten. „Was haben wir letzte Woche verkauft?“ ist ein besserer erster Test als ein Rundgang durch alle Diagramme. Nutzen Sie die Checkliste unten, während Sie ihr bei der Arbeit zusehen.",
      sections: [
        {
          heading: "1. Wählen Sie eine Zahl, die jemand prüfen kann",
          body: "Wählen Sie einen abgeschlossenen Zeitraum und eine Zahl, der das Team bereits vertraut. Notieren Sie Quelle, Zeitraum und Zeitzone. Zeigt das Dashboard eine andere Summe, haben Sie mit diesen drei Angaben einen Ansatzpunkt.",
        },
        {
          heading: "2. Verbinden Sie die kleinste nützliche Datenquelle",
          body: "Importieren Sie die Quelle, die die erste Frage beantwortet. Heben Sie die anderen Verbindungen für später auf. Prüfen Sie, ob Datumsangaben, Währung und Erstattungen so behandelt werden, wie es die Person erwartet, die den Bericht liest.",
        },
        {
          heading: "3. Lassen Sie eine Kollegin die Antwort finden",
          body: "Geben Sie ihr die ursprüngliche Frage und hören Sie auf, die Oberfläche zu erklären. Achten Sie auf die erste Beschriftung, bei der sie zögert. Benennen Sie diese Beschriftung um oder passen Sie den Standardzeitraum an und wiederholen Sie den Test mit einer zweiten Person.",
        },
        {
          heading: "4. Speichern Sie die Ansicht, die funktioniert hat",
          body: "Geben Sie dem Bericht einen Namen, den alle wiedererkennen, etwa „Umsatz der letzten Woche“. Schicken Sie einen Link zu dieser Ansicht und bitten Sie die Empfängerin, mit der Zahl zu antworten, die sie sieht. Ihre Antwort zeigt Ihnen, ob die Übergabe geklappt hat.",
        },
      ],
    },
  },
  explainer: [
    {
      heading: "Beginnen Sie mit dem, was Sie schon wissen",
      body: "Die besten Artikel beantworten eine Frage, die Ihre Kunden wirklich stellen, mit einem Rat, den nur Sie geben können. Schreiben Sie beides in je einem Satz auf, und der Anfang ergibt sich daraus, in Ihren Worten statt mit allgemeinem Fülltext.",
    },
    {
      heading: "Vom Anfang zum vollständigen Artikel",
      body: "Dieses kostenlose Tool schreibt den Titel und den ersten Absatz. In RepGet wird aus demselben Briefing ein vollständiger Artikel, den Sie bearbeiten, planen und auf Ihrer Website veröffentlichen können.",
    },
  ],
};

const COPY: Record<Locale, BlogWriterCopy> = { en: EN, es: ES, fr: FR, it: IT, de: DE };

export function blogWriterCopy(locale: Locale): BlogWriterCopy {
  return COPY[locale];
}
