import type { Locale } from "@/lib/i18n/config";
import type { FreeSocialGoal, FreeSocialTone } from "@/lib/tools/social-posts-shared";

/**
 * The free AI Social Media Post Generator (client, 2026-11-13,
 * repget-free-ai-social-media-post-generator.html) in every language.
 *
 * English follows the design's wording, except where the design promised
 * what the product does not: after the free batch, more posts are made in
 * RepGet's Social Distribution area under the account's plan - never "unlimited" or
 * "free" - so the invitations say "keep creating posts in RepGet".
 *
 * `{n}`, `{count}` and `{max}` are numbers, `{platform}` a platform's name.
 * The posts themselves are written in the language of the page they come from.
 */
export type SocialPostGeneratorCopy = {
  /** The tool page's description, for search results (70-158 characters). */
  metaDescription: string;
  /** Above the page's h1. */
  eyebrow: string;
  /** Under the page's h1. */
  description: string;
  benefits: [string, string, string];
  form: {
    title: string;
    freeBadge: string;
    usedBadge: string;
    stepWebsite: string;
    urlLabel: string;
    urlPlaceholder: string;
    urlHelp: string;
    example: string;
    stepPlatform: string;
    selectOne: string;
    platformsLabel: string;
    showMore: string;
    showFewer: string;
    quotaStrong: string;
    quotaRest: string;
    customize: string;
    optional: string;
    goal: string;
    goals: Record<FreeSocialGoal, string>;
    tone: string;
    tones: Record<FreeSocialTone, string>;
    hashtags: string;
    emoji: string;
    generate: string;
    generating: string;
    retry: string;
    /** When the free batch is used: the button leads to sign-up. */
    unlock: string;
    helper: string;
    helperUsed: string;
    foot: string;
  };
  results: {
    eyebrow: string;
    emptyTitle: string;
    emptySub: string;
    preview: string;
    emptyHeading: string;
    emptyText: string;
    emptyHint: string;
    loadingTitle: string;
    loadingText: string;
    readyTitle: string;
    readySub: string;
    readyBadge: string;
    /** "{platform} · 3 posts". */
    sourceLine: string;
    copyAll: string;
    exportCsv: string;
    /** The textarea's accessible name: "Edit {platform} post {n}". */
    postLabel: string;
    /** "Post {n}", in Copy all. */
    postHeading: string;
    /** "{count} / {max} characters". */
    chars: string;
    over: string;
    copy: string;
    copied: string;
    copyFailed: string;
    exported: string;
    review: string;
    /** The CSV's columns: platform, post number, angle, text, characters, source address. */
    csvHeader: [string, string, string, string, string, string];
    usedTitle: string;
    usedText: string;
    errorTitle: string;
  };
  unlock: {
    pill: string;
    title: string;
    text: string;
    button: string;
    signInLead: string;
    signIn: string;
  };
  errors: {
    invalidUrl: string;
    extraction: string;
    provider: string;
    providerFinal: string;
    limit: string;
    rateLimited: string;
    busy: string;
    unavailable: string;
  };
  cta: { title: string; text: string; button: string };
  explainer: [{ heading: string; body: string }, { heading: string; body: string }, { heading: string; body: string }];
};

const en: SocialPostGeneratorCopy = {
  eyebrow: "Free tool by RepGet",
  metaDescription:
    "Free AI social media post generator: enter a website or article URL and get 3 editable posts for Instagram, LinkedIn, X and more. No signup needed.",
  description: "Turn your website or article into 3 ready-to-share social posts. Pick a platform, edit your posts, then copy or export them for free.",
  benefits: ["3 posts free", "One platform to start", "Edit, copy and export"],
  form: {
    title: "Create your posts",
    freeBadge: "3 free posts",
    usedBadge: "Free batch used",
    stepWebsite: "Enter your website",
    urlLabel: "Website or article URL",
    urlPlaceholder: "https://yourwebsite.com",
    urlHelp: "Your homepage or any public article.",
    example: "Use the RepGet example",
    stepPlatform: "Choose your platform",
    selectOne: "Select one",
    platformsLabel: "Choose one social network",
    showMore: "+ Show 3 more platforms",
    showFewer: "− Show fewer platforms",
    quotaStrong: "One free batch of 3 posts",
    quotaRest: "for the platform you choose. Create an account to keep creating posts in RepGet.",
    customize: "Customize your posts",
    optional: "(optional)",
    goal: "Goal",
    goals: {
      introduce: "Introduce my business",
      traffic: "Bring visitors to my website",
      engage: "Start conversations",
      educate: "Share useful insights",
    },
    tone: "Tone",
    tones: { natural: "Clear and natural", professional: "Professional", friendly: "Friendly", bold: "Bold and confident" },
    hashtags: "Include hashtags",
    emoji: "Include emojis",
    generate: "Generate my 3 free posts",
    generating: "Writing your posts…",
    retry: "Try once more",
    unlock: "Create an account to keep going",
    helper: "No signup needed for your first 3 posts.",
    helperUsed: "Your free batch is used. You can still edit, copy and export your posts.",
    foot: "RepGet never publishes anything from this page: your posts are drafts for you to review and share.",
  },
  results: {
    eyebrow: "Step 3 · Your results",
    emptyTitle: "Your posts appear here",
    emptySub: "Ready for editing, copying and publishing.",
    preview: "Preview",
    emptyHeading: "From one link to three posts.",
    emptyText: "Select a platform, enter your website and click Generate to get your 3 free posts.",
    emptyHint: "Start with your website",
    loadingTitle: "Reading your page and writing your posts…",
    loadingText: "This usually takes 10 to 20 seconds.",
    readyTitle: "Your 3 free posts",
    readySub: "Edit, copy or export them. They stay saved in this browser.",
    readyBadge: "3 of 3 free",
    sourceLine: "{platform} · 3 posts",
    copyAll: "Copy all",
    exportCsv: "Export CSV",
    postLabel: "Edit {platform} post {n}",
    postHeading: "Post {n}",
    chars: "{count} / {max} characters",
    over: "Over the {platform} limit",
    copy: "Copy post",
    copied: "Copied",
    copyFailed: "Copying is blocked in this browser. Select the text to copy it.",
    exported: "CSV exported.",
    review: "Review facts and platform guidelines before posting.",
    csvHeader: ["Platform", "Post", "Angle", "Text", "Characters", "Source URL"],
    usedTitle: "Your free batch has been used",
    usedText: "This free generator makes one batch of 3 posts per visitor. Create a RepGet account to keep creating posts for your website.",
    errorTitle: "No posts this time",
  },
  unlock: {
    pill: "Your free 3 are ready",
    title: "Keep the good ideas coming.",
    text: "Create a RepGet account to keep creating posts for your website in Social Distribution, for every platform your plan includes.",
    button: "Sign up free",
    signInLead: "Already have an account?",
    signIn: "Sign in",
  },
  errors: {
    invalidUrl: "Enter a valid public website or article address, such as https://yourbusiness.com.",
    extraction: "We could not read that page. Check the address, or try your homepage or another public article.",
    provider: "We could not write your posts just now. You can try once more.",
    providerFinal: "We could not write your posts, and the free try is now used. Create a RepGet account to keep going.",
    limit: "Your free batch has been used. Create a RepGet account to keep creating posts.",
    rateLimited: "You have tried many addresses in the last hour. Please try again later.",
    busy: "The generator is very busy right now. Please try again in a few minutes.",
    unavailable: "The generator is not available right now. Please try again later.",
  },
  cta: {
    title: "From a free draft to a complete content workflow.",
    text: "RepGet helps you create, organize and distribute content while growing your search visibility.",
    button: "Sign up free",
  },
  explainer: [
    {
      heading: "Posts from your own page",
      body: "RepGet reads the one page you enter - your homepage or an article - and writes three posts from what it actually says. Nothing is invented: review the facts before you post.",
    },
    {
      heading: "Made for the platform",
      body: "Each network gets its own format and length: short and direct for X and Bluesky, a title and body for Reddit and Pinterest, a hook and caption for TikTok. Character counts follow each platform's limit.",
    },
    {
      heading: "Yours to edit and export",
      body: "Edit every post, copy one or all of them, or export a CSV. RepGet never publishes from this page. With an account, Social Distribution plans, writes and schedules posts for your website.",
    },
  ],
};

const es: SocialPostGeneratorCopy = {
  eyebrow: "Herramienta gratuita de RepGet",
  metaDescription:
    "Generador gratuito de publicaciones con IA: introduzca la URL de su web o artículo y obtenga 3 posts editables para Instagram, LinkedIn, X y más.",
  description: "Convierta su web o su artículo en 3 publicaciones listas para compartir. Elija una red, edite sus publicaciones y cópielas o expórtelas gratis.",
  benefits: ["3 publicaciones gratis", "Una red para empezar", "Editar, copiar y exportar"],
  form: {
    title: "Cree sus publicaciones",
    freeBadge: "3 publicaciones gratis",
    usedBadge: "Lote gratuito usado",
    stepWebsite: "Introduzca su web",
    urlLabel: "URL de la web o del artículo",
    urlPlaceholder: "https://suweb.com",
    urlHelp: "Su página de inicio o cualquier artículo público.",
    example: "Usar el ejemplo de RepGet",
    stepPlatform: "Elija su red social",
    selectOne: "Elija una",
    platformsLabel: "Elija una red social",
    showMore: "+ Mostrar 3 redes más",
    showFewer: "− Mostrar menos redes",
    quotaStrong: "Un lote gratuito de 3 publicaciones",
    quotaRest: "para la red que elija. Cree una cuenta para seguir creando publicaciones en RepGet.",
    customize: "Personalice sus publicaciones",
    optional: "(opcional)",
    goal: "Objetivo",
    goals: {
      introduce: "Presentar mi negocio",
      traffic: "Atraer visitas a mi web",
      engage: "Iniciar conversaciones",
      educate: "Compartir ideas útiles",
    },
    tone: "Tono",
    tones: { natural: "Claro y natural", professional: "Profesional", friendly: "Cercano", bold: "Audaz y seguro" },
    hashtags: "Incluir hashtags",
    emoji: "Incluir emojis",
    generate: "Generar mis 3 publicaciones gratis",
    generating: "Escribiendo sus publicaciones…",
    retry: "Intentarlo una vez más",
    unlock: "Cree una cuenta para continuar",
    helper: "Sin registro para sus 3 primeras publicaciones.",
    helperUsed: "Ya usó su lote gratuito. Aún puede editar, copiar y exportar sus publicaciones.",
    foot: "RepGet nunca publica nada desde esta página: sus publicaciones son borradores para que usted las revise y comparta.",
  },
  results: {
    eyebrow: "Paso 3 · Sus resultados",
    emptyTitle: "Sus publicaciones aparecerán aquí",
    emptySub: "Listas para editar, copiar y publicar.",
    preview: "Vista previa",
    emptyHeading: "De un enlace a tres publicaciones.",
    emptyText: "Elija una red, introduzca su web y pulse Generar para obtener sus 3 publicaciones gratis.",
    emptyHint: "Empiece por su web",
    loadingTitle: "Leyendo su página y escribiendo sus publicaciones…",
    loadingText: "Suele tardar entre 10 y 20 segundos.",
    readyTitle: "Sus 3 publicaciones gratis",
    readySub: "Edítelas, cópielas o expórtelas. Quedan guardadas en este navegador.",
    readyBadge: "3 de 3 gratis",
    sourceLine: "{platform} · 3 publicaciones",
    copyAll: "Copiar todo",
    exportCsv: "Exportar CSV",
    postLabel: "Editar la publicación {n} de {platform}",
    postHeading: "Publicación {n}",
    chars: "{count} / {max} caracteres",
    over: "Supera el límite de {platform}",
    copy: "Copiar publicación",
    copied: "Copiado",
    copyFailed: "Este navegador bloquea la copia. Seleccione el texto para copiarlo.",
    exported: "CSV exportado.",
    review: "Revise los datos y las normas de la red antes de publicar.",
    csvHeader: ["Red", "Publicación", "Enfoque", "Texto", "Caracteres", "URL de origen"],
    usedTitle: "Ya usó su lote gratuito",
    usedText: "Este generador gratuito crea un lote de 3 publicaciones por visitante. Cree una cuenta de RepGet para seguir creando publicaciones para su web.",
    errorTitle: "Esta vez no hay publicaciones",
  },
  unlock: {
    pill: "Sus 3 gratis están listas",
    title: "Siga generando buenas ideas.",
    text: "Cree una cuenta de RepGet para seguir creando publicaciones para su web en Distribución social, para cada red que incluya su plan.",
    button: "Regístrese gratis",
    signInLead: "¿Ya tiene una cuenta?",
    signIn: "Iniciar sesión",
  },
  errors: {
    invalidUrl: "Introduzca una dirección pública válida de una web o un artículo, como https://sunegocio.com.",
    extraction: "No pudimos leer esa página. Revise la dirección o pruebe con su página de inicio u otro artículo público.",
    provider: "No pudimos escribir sus publicaciones ahora mismo. Puede intentarlo una vez más.",
    providerFinal: "No pudimos escribir sus publicaciones y el intento gratuito ya se ha usado. Cree una cuenta de RepGet para continuar.",
    limit: "Ya usó su lote gratuito. Cree una cuenta de RepGet para seguir creando publicaciones.",
    rateLimited: "Ha probado muchas direcciones en la última hora. Vuelva a intentarlo más tarde.",
    busy: "El generador está muy ocupado ahora mismo. Vuelva a intentarlo en unos minutos.",
    unavailable: "El generador no está disponible ahora mismo. Vuelva a intentarlo más tarde.",
  },
  cta: {
    title: "De un borrador gratuito a un flujo de contenido completo.",
    text: "RepGet le ayuda a crear, organizar y distribuir contenido mientras mejora su visibilidad en los buscadores.",
    button: "Regístrese gratis",
  },
  explainer: [
    {
      heading: "Publicaciones a partir de su propia página",
      body: "RepGet lee la página que usted introduce - su página de inicio o un artículo - y escribe tres publicaciones a partir de lo que realmente dice. No inventa nada: revise los datos antes de publicar.",
    },
    {
      heading: "Hechas para cada red",
      body: "Cada red tiene su formato y su extensión: breve y directa para X y Bluesky, título y cuerpo para Reddit y Pinterest, gancho y texto para TikTok. El recuento de caracteres sigue el límite de cada red.",
    },
    {
      heading: "Suyas para editar y exportar",
      body: "Edite cada publicación, copie una o todas, o exporte un CSV. RepGet nunca publica desde esta página. Con una cuenta, Distribución social planifica, escribe y programa publicaciones para su web.",
    },
  ],
};

const fr: SocialPostGeneratorCopy = {
  eyebrow: "Outil gratuit de RepGet",
  metaDescription:
    "Générateur gratuit de posts par IA : saisissez l’URL de votre site ou d’un article et obtenez 3 posts modifiables pour Instagram, LinkedIn, X et plus.",
  description: "Transformez votre site ou votre article en 3 posts prêts à partager. Choisissez un réseau, modifiez vos posts, puis copiez-les ou exportez-les gratuitement.",
  benefits: ["3 posts gratuits", "Un réseau pour commencer", "Modifier, copier et exporter"],
  form: {
    title: "Créez vos posts",
    freeBadge: "3 posts gratuits",
    usedBadge: "Lot gratuit utilisé",
    stepWebsite: "Saisissez votre site",
    urlLabel: "URL du site ou de l’article",
    urlPlaceholder: "https://votresite.fr",
    urlHelp: "Votre page d’accueil ou n’importe quel article public.",
    example: "Utiliser l’exemple RepGet",
    stepPlatform: "Choisissez votre réseau",
    selectOne: "Un seul choix",
    platformsLabel: "Choisissez un réseau social",
    showMore: "+ Afficher 3 réseaux de plus",
    showFewer: "− Afficher moins de réseaux",
    quotaStrong: "Un lot gratuit de 3 posts",
    quotaRest: "pour le réseau de votre choix. Créez un compte pour continuer à créer des posts dans RepGet.",
    customize: "Personnalisez vos posts",
    optional: "(facultatif)",
    goal: "Objectif",
    goals: {
      introduce: "Présenter mon entreprise",
      traffic: "Attirer des visiteurs sur mon site",
      engage: "Lancer des conversations",
      educate: "Partager des conseils utiles",
    },
    tone: "Ton",
    tones: { natural: "Clair et naturel", professional: "Professionnel", friendly: "Chaleureux", bold: "Audacieux et assuré" },
    hashtags: "Inclure des hashtags",
    emoji: "Inclure des emojis",
    generate: "Générer mes 3 posts gratuits",
    generating: "Rédaction de vos posts…",
    retry: "Réessayer une fois",
    unlock: "Créez un compte pour continuer",
    helper: "Sans inscription pour vos 3 premiers posts.",
    helperUsed: "Votre lot gratuit est utilisé. Vous pouvez toujours modifier, copier et exporter vos posts.",
    foot: "RepGet ne publie jamais rien depuis cette page : vos posts sont des brouillons que vous relisez et partagez vous-même.",
  },
  results: {
    eyebrow: "Étape 3 · Vos résultats",
    emptyTitle: "Vos posts apparaîtront ici",
    emptySub: "Prêts à être modifiés, copiés et publiés.",
    preview: "Aperçu",
    emptyHeading: "D’un lien à trois posts.",
    emptyText: "Choisissez un réseau, saisissez votre site et cliquez sur Générer pour obtenir vos 3 posts gratuits.",
    emptyHint: "Commencez par votre site",
    loadingTitle: "Lecture de votre page et rédaction de vos posts…",
    loadingText: "Cela prend généralement 10 à 20 secondes.",
    readyTitle: "Vos 3 posts gratuits",
    readySub: "Modifiez-les, copiez-les ou exportez-les. Ils restent enregistrés dans ce navigateur.",
    readyBadge: "3 sur 3 gratuits",
    sourceLine: "{platform} · 3 posts",
    copyAll: "Tout copier",
    exportCsv: "Exporter en CSV",
    postLabel: "Modifier le post {n} pour {platform}",
    postHeading: "Post {n}",
    chars: "{count} / {max} caractères",
    over: "Au-delà de la limite de {platform}",
    copy: "Copier le post",
    copied: "Copié",
    copyFailed: "Ce navigateur bloque la copie. Sélectionnez le texte pour le copier.",
    exported: "CSV exporté.",
    review: "Vérifiez les faits et les règles du réseau avant de publier.",
    csvHeader: ["Réseau", "Post", "Angle", "Texte", "Caractères", "URL source"],
    usedTitle: "Votre lot gratuit est utilisé",
    usedText: "Ce générateur gratuit crée un lot de 3 posts par visiteur. Créez un compte RepGet pour continuer à créer des posts pour votre site.",
    errorTitle: "Pas de posts cette fois",
  },
  unlock: {
    pill: "Vos 3 posts gratuits sont prêts",
    title: "Continuez sur votre lancée.",
    text: "Créez un compte RepGet pour continuer à créer des posts pour votre site dans Diffusion sociale, sur chaque réseau inclus dans votre offre.",
    button: "Inscrivez-vous gratuitement",
    signInLead: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
  },
  errors: {
    invalidUrl: "Saisissez l’adresse publique valide d’un site ou d’un article, par exemple https://votreentreprise.fr.",
    extraction: "Nous n’avons pas pu lire cette page. Vérifiez l’adresse, ou essayez votre page d’accueil ou un autre article public.",
    provider: "Nous n’avons pas pu rédiger vos posts pour le moment. Vous pouvez réessayer une fois.",
    providerFinal: "Nous n’avons pas pu rédiger vos posts, et l’essai gratuit est désormais utilisé. Créez un compte RepGet pour continuer.",
    limit: "Votre lot gratuit est utilisé. Créez un compte RepGet pour continuer à créer des posts.",
    rateLimited: "Vous avez essayé de nombreuses adresses au cours de la dernière heure. Veuillez réessayer plus tard.",
    busy: "Le générateur est très sollicité en ce moment. Veuillez réessayer dans quelques minutes.",
    unavailable: "Le générateur n’est pas disponible pour le moment. Veuillez réessayer plus tard.",
  },
  cta: {
    title: "D’un brouillon gratuit à un flux de contenu complet.",
    text: "RepGet vous aide à créer, organiser et diffuser du contenu tout en améliorant votre visibilité dans les moteurs de recherche.",
    button: "Inscrivez-vous gratuitement",
  },
  explainer: [
    {
      heading: "Des posts tirés de votre propre page",
      body: "RepGet lit la page que vous saisissez - votre page d’accueil ou un article - et rédige trois posts à partir de ce qu’elle dit réellement. Rien n’est inventé : vérifiez les faits avant de publier.",
    },
    {
      heading: "Pensés pour chaque réseau",
      body: "Chaque réseau a son format et sa longueur : court et direct pour X et Bluesky, un titre et un corps pour Reddit et Pinterest, une accroche et une légende pour TikTok. Le nombre de caractères suit la limite de chaque réseau.",
    },
    {
      heading: "À modifier et exporter librement",
      body: "Modifiez chaque post, copiez-en un ou tous, ou exportez un CSV. RepGet ne publie jamais depuis cette page. Avec un compte, Diffusion sociale planifie, rédige et programme des posts pour votre site.",
    },
  ],
};

const it: SocialPostGeneratorCopy = {
  eyebrow: "Strumento gratuito di RepGet",
  metaDescription:
    "Generatore gratuito di post social con AI: inserisca l’URL del suo sito o di un articolo e ottenga 3 post modificabili per Instagram, LinkedIn, X e altri.",
  description: "Trasformi il suo sito o il suo articolo in 3 post pronti da condividere. Scelga un social, modifichi i post e li copi o li esporti gratuitamente.",
  benefits: ["3 post gratis", "Un social per iniziare", "Modifica, copia ed esporta"],
  form: {
    title: "Crei i suoi post",
    freeBadge: "3 post gratis",
    usedBadge: "Lotto gratuito usato",
    stepWebsite: "Inserisca il suo sito",
    urlLabel: "URL del sito o dell’articolo",
    urlPlaceholder: "https://ilsuosito.it",
    urlHelp: "La sua home page o qualsiasi articolo pubblico.",
    example: "Usi l’esempio di RepGet",
    stepPlatform: "Scelga il social",
    selectOne: "Ne scelga uno",
    platformsLabel: "Scelga un social network",
    showMore: "+ Mostra altri 3 social",
    showFewer: "− Mostra meno social",
    quotaStrong: "Un lotto gratuito di 3 post",
    quotaRest: "per il social che sceglie. Crei un account per continuare a creare post in RepGet.",
    customize: "Personalizzi i suoi post",
    optional: "(facoltativo)",
    goal: "Obiettivo",
    goals: {
      introduce: "Presentare la mia attività",
      traffic: "Portare visitatori al mio sito",
      engage: "Avviare conversazioni",
      educate: "Condividere spunti utili",
    },
    tone: "Tono",
    tones: { natural: "Chiaro e naturale", professional: "Professionale", friendly: "Cordiale", bold: "Deciso e sicuro" },
    hashtags: "Includi hashtag",
    emoji: "Includi emoji",
    generate: "Genera i miei 3 post gratis",
    generating: "Stiamo scrivendo i suoi post…",
    retry: "Riprovi ancora una volta",
    unlock: "Crei un account per continuare",
    helper: "Nessuna registrazione per i primi 3 post.",
    helperUsed: "Il suo lotto gratuito è stato usato. Può ancora modificare, copiare ed esportare i suoi post.",
    foot: "RepGet non pubblica mai nulla da questa pagina: i suoi post sono bozze da rivedere e condividere lei stesso.",
  },
  results: {
    eyebrow: "Passo 3 · I suoi risultati",
    emptyTitle: "I suoi post appariranno qui",
    emptySub: "Pronti da modificare, copiare e pubblicare.",
    preview: "Anteprima",
    emptyHeading: "Da un link a tre post.",
    emptyText: "Scelga un social, inserisca il suo sito e clicchi su Genera per ottenere i suoi 3 post gratis.",
    emptyHint: "Inizi dal suo sito",
    loadingTitle: "Stiamo leggendo la sua pagina e scrivendo i post…",
    loadingText: "Di solito servono dai 10 ai 20 secondi.",
    readyTitle: "I suoi 3 post gratis",
    readySub: "Li modifichi, li copi o li esporti. Restano salvati in questo browser.",
    readyBadge: "3 su 3 gratis",
    sourceLine: "{platform} · 3 post",
    copyAll: "Copia tutto",
    exportCsv: "Esporta CSV",
    postLabel: "Modifica il post {n} per {platform}",
    postHeading: "Post {n}",
    chars: "{count} / {max} caratteri",
    over: "Oltre il limite di {platform}",
    copy: "Copia il post",
    copied: "Copiato",
    copyFailed: "Questo browser blocca la copia. Selezioni il testo per copiarlo.",
    exported: "CSV esportato.",
    review: "Verifichi i fatti e le regole del social prima di pubblicare.",
    csvHeader: ["Social", "Post", "Taglio", "Testo", "Caratteri", "URL di origine"],
    usedTitle: "Il suo lotto gratuito è stato usato",
    usedText: "Questo generatore gratuito crea un lotto di 3 post per visitatore. Crei un account RepGet per continuare a creare post per il suo sito.",
    errorTitle: "Nessun post questa volta",
  },
  unlock: {
    pill: "I suoi 3 post gratis sono pronti",
    title: "Continui a far arrivare buone idee.",
    text: "Crei un account RepGet per continuare a creare post per il suo sito in Distribuzione social, per ogni social incluso nel suo piano.",
    button: "Si registri gratis",
    signInLead: "Ha già un account?",
    signIn: "Acceda",
  },
  errors: {
    invalidUrl: "Inserisca un indirizzo pubblico valido di un sito o di un articolo, come https://lasuaazienda.it.",
    extraction: "Non siamo riusciti a leggere quella pagina. Controlli l’indirizzo, oppure provi con la home page o un altro articolo pubblico.",
    provider: "Non siamo riusciti a scrivere i suoi post in questo momento. Può riprovare ancora una volta.",
    providerFinal: "Non siamo riusciti a scrivere i suoi post e il tentativo gratuito è stato usato. Crei un account RepGet per continuare.",
    limit: "Il suo lotto gratuito è stato usato. Crei un account RepGet per continuare a creare post.",
    rateLimited: "Ha provato molti indirizzi nell’ultima ora. Riprovi più tardi.",
    busy: "Il generatore è molto richiesto in questo momento. Riprovi tra qualche minuto.",
    unavailable: "Il generatore non è disponibile in questo momento. Riprovi più tardi.",
  },
  cta: {
    title: "Da una bozza gratuita a un flusso di contenuti completo.",
    text: "RepGet la aiuta a creare, organizzare e distribuire contenuti mentre migliora la sua visibilità nei motori di ricerca.",
    button: "Si registri gratis",
  },
  explainer: [
    {
      heading: "Post dalla sua pagina",
      body: "RepGet legge la pagina che inserisce - la home page o un articolo - e scrive tre post da ciò che dice davvero. Non inventa nulla: verifichi i fatti prima di pubblicare.",
    },
    {
      heading: "Pensati per ogni social",
      body: "Ogni social ha il suo formato e la sua lunghezza: breve e diretto per X e Bluesky, titolo e testo per Reddit e Pinterest, gancio e didascalia per TikTok. Il conteggio dei caratteri segue il limite di ogni social.",
    },
    {
      heading: "Suoi da modificare ed esportare",
      body: "Modifichi ogni post, ne copi uno o tutti, oppure esporti un CSV. RepGet non pubblica mai da questa pagina. Con un account, Distribuzione social pianifica, scrive e programma i post per il suo sito.",
    },
  ],
};

const de: SocialPostGeneratorCopy = {
  eyebrow: "Kostenloses Werkzeug von RepGet",
  metaDescription:
    "Kostenloser KI-Generator für Social-Media-Beiträge: Website- oder Artikel-URL eingeben und 3 bearbeitbare Beiträge für Instagram, LinkedIn und X erhalten.",
  description: "Machen Sie aus Ihrer Website oder Ihrem Artikel 3 Beiträge, die Sie sofort teilen können. Netzwerk wählen, Beiträge bearbeiten, dann kostenlos kopieren oder exportieren.",
  benefits: ["3 Beiträge kostenlos", "Ein Netzwerk zum Start", "Bearbeiten, kopieren, exportieren"],
  form: {
    title: "Erstellen Sie Ihre Beiträge",
    freeBadge: "3 kostenlose Beiträge",
    usedBadge: "Kostenloser Satz genutzt",
    stepWebsite: "Website eingeben",
    urlLabel: "URL der Website oder des Artikels",
    urlPlaceholder: "https://ihrewebsite.de",
    urlHelp: "Ihre Startseite oder ein beliebiger öffentlicher Artikel.",
    example: "RepGet-Beispiel verwenden",
    stepPlatform: "Netzwerk wählen",
    selectOne: "Eines wählen",
    platformsLabel: "Ein soziales Netzwerk wählen",
    showMore: "+ 3 weitere Netzwerke anzeigen",
    showFewer: "− Weniger Netzwerke anzeigen",
    quotaStrong: "Ein kostenloser Satz mit 3 Beiträgen",
    quotaRest: "für das Netzwerk Ihrer Wahl. Mit einem Konto erstellen Sie weitere Beiträge in RepGet.",
    customize: "Beiträge anpassen",
    optional: "(optional)",
    goal: "Ziel",
    goals: {
      introduce: "Mein Unternehmen vorstellen",
      traffic: "Besucher auf meine Website bringen",
      engage: "Gespräche anstoßen",
      educate: "Nützliches Wissen teilen",
    },
    tone: "Tonfall",
    tones: { natural: "Klar und natürlich", professional: "Professionell", friendly: "Freundlich", bold: "Mutig und selbstbewusst" },
    hashtags: "Hashtags einfügen",
    emoji: "Emojis einfügen",
    generate: "Meine 3 kostenlosen Beiträge erstellen",
    generating: "Ihre Beiträge werden geschrieben…",
    retry: "Noch einmal versuchen",
    unlock: "Konto erstellen und weitermachen",
    helper: "Für Ihre ersten 3 Beiträge ist keine Anmeldung nötig.",
    helperUsed: "Ihr kostenloser Satz ist genutzt. Sie können Ihre Beiträge weiterhin bearbeiten, kopieren und exportieren.",
    foot: "RepGet veröffentlicht nie etwas von dieser Seite: Ihre Beiträge sind Entwürfe, die Sie selbst prüfen und teilen.",
  },
  results: {
    eyebrow: "Schritt 3 · Ihre Ergebnisse",
    emptyTitle: "Hier erscheinen Ihre Beiträge",
    emptySub: "Bereit zum Bearbeiten, Kopieren und Veröffentlichen.",
    preview: "Vorschau",
    emptyHeading: "Aus einem Link werden drei Beiträge.",
    emptyText: "Wählen Sie ein Netzwerk, geben Sie Ihre Website ein und klicken Sie auf Erstellen, um Ihre 3 kostenlosen Beiträge zu erhalten.",
    emptyHint: "Beginnen Sie mit Ihrer Website",
    loadingTitle: "Ihre Seite wird gelesen und Ihre Beiträge werden geschrieben…",
    loadingText: "Das dauert meist 10 bis 20 Sekunden.",
    readyTitle: "Ihre 3 kostenlosen Beiträge",
    readySub: "Bearbeiten, kopieren oder exportieren Sie sie. Sie bleiben in diesem Browser gespeichert.",
    readyBadge: "3 von 3 kostenlos",
    sourceLine: "{platform} · 3 Beiträge",
    copyAll: "Alle kopieren",
    exportCsv: "Als CSV exportieren",
    postLabel: "{platform}-Beitrag {n} bearbeiten",
    postHeading: "Beitrag {n}",
    chars: "{count} / {max} Zeichen",
    over: "Über dem Limit von {platform}",
    copy: "Beitrag kopieren",
    copied: "Kopiert",
    copyFailed: "Dieser Browser blockiert das Kopieren. Markieren Sie den Text, um ihn zu kopieren.",
    exported: "CSV exportiert.",
    review: "Prüfen Sie Fakten und Netzwerkregeln vor dem Veröffentlichen.",
    csvHeader: ["Netzwerk", "Beitrag", "Ansatz", "Text", "Zeichen", "Quell-URL"],
    usedTitle: "Ihr kostenloser Satz ist genutzt",
    usedText: "Dieser kostenlose Generator erstellt einen Satz mit 3 Beiträgen pro Besucher. Mit einem RepGet-Konto erstellen Sie weitere Beiträge für Ihre Website.",
    errorTitle: "Diesmal keine Beiträge",
  },
  unlock: {
    pill: "Ihre 3 kostenlosen Beiträge sind fertig",
    title: "Bleiben Sie dran.",
    text: "Mit einem RepGet-Konto erstellen Sie im Bereich Social-Verbreitung weitere Beiträge für Ihre Website, für jedes Netzwerk, das Ihr Tarif umfasst.",
    button: "Kostenlos registrieren",
    signInLead: "Sie haben bereits ein Konto?",
    signIn: "Anmelden",
  },
  errors: {
    invalidUrl: "Geben Sie eine gültige öffentliche Adresse einer Website oder eines Artikels ein, zum Beispiel https://ihrunternehmen.de.",
    extraction: "Wir konnten diese Seite nicht lesen. Prüfen Sie die Adresse oder versuchen Sie es mit Ihrer Startseite oder einem anderen öffentlichen Artikel.",
    provider: "Wir konnten Ihre Beiträge gerade nicht schreiben. Sie können es noch einmal versuchen.",
    providerFinal: "Wir konnten Ihre Beiträge nicht schreiben, und der kostenlose Versuch ist nun genutzt. Mit einem RepGet-Konto machen Sie weiter.",
    limit: "Ihr kostenloser Satz ist genutzt. Mit einem RepGet-Konto erstellen Sie weitere Beiträge.",
    rateLimited: "Sie haben in der letzten Stunde viele Adressen ausprobiert. Bitte versuchen Sie es später erneut.",
    busy: "Der Generator ist gerade stark ausgelastet. Bitte versuchen Sie es in ein paar Minuten erneut.",
    unavailable: "Der Generator ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.",
  },
  cta: {
    title: "Vom kostenlosen Entwurf zum vollständigen Content-Workflow.",
    text: "RepGet hilft Ihnen, Inhalte zu erstellen, zu organisieren und zu verbreiten und dabei Ihre Sichtbarkeit in Suchmaschinen zu steigern.",
    button: "Kostenlos registrieren",
  },
  explainer: [
    {
      heading: "Beiträge aus Ihrer eigenen Seite",
      body: "RepGet liest die eine Seite, die Sie eingeben - Ihre Startseite oder einen Artikel - und schreibt drei Beiträge aus dem, was dort wirklich steht. Nichts wird erfunden: Prüfen Sie die Fakten vor dem Veröffentlichen.",
    },
    {
      heading: "Für jedes Netzwerk gemacht",
      body: "Jedes Netzwerk erhält sein eigenes Format und seine Länge: kurz und direkt für X und Bluesky, Titel und Text für Reddit und Pinterest, Hook und Bildunterschrift für TikTok. Die Zeichenzählung folgt dem Limit des Netzwerks.",
    },
    {
      heading: "Zum Bearbeiten und Exportieren",
      body: "Bearbeiten Sie jeden Beitrag, kopieren Sie einen oder alle oder exportieren Sie eine CSV-Datei. RepGet veröffentlicht nie von dieser Seite. Mit einem Konto plant, schreibt und terminiert der Bereich Social-Verbreitung Beiträge für Ihre Website.",
    },
  ],
};

const COPY: Record<Locale, SocialPostGeneratorCopy> = { en, es, fr, it, de };

export function socialPostGeneratorCopy(locale: Locale): SocialPostGeneratorCopy {
  return COPY[locale];
}
