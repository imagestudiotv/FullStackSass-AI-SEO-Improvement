import type { Locale } from "@/lib/i18n/config";

/**
 * The Videos page's words (lib/video; client, 2026-10-29). Five languages,
 * formal address, like the rest of the app. {placeholders} are filled with
 * format() (lib/i18n/format.ts); "one|other" pairs with plural().
 */
export type VideosCopy = {
  title: string;
  intro: string;
  tabs: { ideas: string; videos: string; posted: string; settings: string };
  /** The day's progress: "{approved} of {goal} made today". */
  today: string;
  dayComplete: string;
  dayCompleteBody: string;
  newIdeas: string;
  ideasQueued: string;
  writingIdeas: string;
  writingIdeasBody: string;
  noIdeasLeft: string;
  noIdeasLeftBody: string;
  ideaOf: string;
  reel: string;
  carousel: string;
  styles: { bold: string; numbers: string; story: string };
  styleHelp: { bold: string; numbers: string; story: string };
  skip: string;
  undo: string;
  edit: string;
  /** "Make it · {price}" */
  approve: string;
  approved: string;
  swipeHint: string;
  previewNote: string;
  slide: string;
  // Editing an idea
  editTitle: string;
  hook: string;
  point: string;
  pointTitle: string;
  pointDetail: string;
  stat: string;
  statValue: string;
  statSuffix: string;
  statLabel: string;
  addPoint: string;
  removePoint: string;
  proof: string;
  cta: string;
  caption: string;
  style: string;
  format: string;
  voice: string;
  voiceOff: string;
  music: string;
  musicAuto: string;
  musicNone: string;
  captions: string;
  pictures: string;
  addPicture: string;
  noPictures: string;
  save: string;
  saved: string;
  cancel: string;
  saveAndApprove: string;
  // Your videos
  noVideos: string;
  noVideosBody: string;
  status: {
    approved: string;
    making: string;
    ready: string;
    scheduled: string;
    posting: string;
    posted: string;
    failed: string;
  };
  makingBody: string;
  scheduledFor: string;
  download: string;
  downloadSlide: string;
  publishTo: string;
  publishNow: string;
  publishBest: string;
  publishAt: string;
  schedule: string;
  unschedule: string;
  publishing: string;
  published: string;
  scheduledToast: string;
  retry: string;
  failedBody: string;
  connectFirst: string;
  noCarouselOnYoutube: string;
  // Posted
  noPosted: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  totalViews: string;
  open: string;
  statsUpdated: string;
  // Settings
  accounts: string;
  accountsBody: string;
  connect: string;
  connecting: string;
  disconnect: string;
  connected: string;
  paused: string;
  resume: string;
  notConfigured: string;
  defaults: string;
  defaultStyle: string;
  defaultVoice: string;
  musicOn: string;
  captionsOn: string;
  publishMode: string;
  publishManual: string;
  publishManualHelp: string;
  publishAuto: string;
  publishAutoHelp: string;
  platforms: string;
  logo: string;
  logoHelp: string;
  uploadLogo: string;
  removeLogo: string;
  library: string;
  libraryHelp: string;
  upload: string;
  uploading: string;
  remove: string;
  safety: string;
  safetyPoints: string[];
  trialNote: string;
  notice: { connected: string; not_connected: string; connect_failed: string };
  errors: {
    view_only: string;
    no_plan: string;
    not_found: string;
    already_handled: string;
    not_enough_credits: string;
    bad_script: string;
    no_accounts: string;
    not_configured: string;
    connect_failed: string;
    bad_file: string;
    too_big: string;
    bad_time: string;
    generic: string;
  };
};

const en: VideosCopy = {
  title: "Videos",
  intro: "Short animated videos and photo carousels made from your website, with an AI voice, captions and music. Swipe through today's ideas: the ones you keep are made and published for you.",
  tabs: { ideas: "Today's ideas", videos: "Your videos", posted: "Posted", settings: "Settings" },
  today: "{approved} of {goal} made today",
  dayComplete: "Today is complete",
  dayCompleteBody: "You have made today's {goal} videos. You can make more from the ideas left; each one uses a credit.",
  newIdeas: "New ideas",
  ideasQueued: "Writing today's ideas. They appear here in a minute.",
  writingIdeas: "Writing today's ideas…",
  writingIdeasBody: "RepGet is reading your website and writing 20 video ideas. This takes about a minute.",
  noIdeasLeft: "You have seen all of today's ideas",
  noIdeasLeftBody: "New ideas arrive every morning.",
  ideaOf: "Idea {index} of {count}",
  reel: "Reel",
  carousel: "Carousel",
  styles: { bold: "Bold", numbers: "Numbers", story: "Story" },
  styleHelp: {
    bold: "Big headlines and an animated checklist.",
    numbers: "Each point as a figure that counts up.",
    story: "Your pictures and clips, with the words over them.",
  },
  skip: "Skip",
  undo: "Undo",
  edit: "Edit",
  approve: "Make it · {price}",
  approved: "Being made. You will find it under Your videos.",
  swipeHint: "Swipe right or press → to make it, left or ← to skip.",
  previewNote: "Preview without the voice. The finished video has the AI voice, captions and music.",
  slide: "Slide {index}",
  editTitle: "Edit the idea",
  hook: "First line (the hook)",
  point: "Point {index}",
  pointTitle: "On screen",
  pointDetail: "The voice adds",
  stat: "A figure (optional)",
  statValue: "Number",
  statSuffix: "Unit",
  statLabel: "Label",
  addPoint: "Add a point",
  removePoint: "Remove",
  proof: "Proof",
  cta: "Closing line",
  caption: "Post text",
  style: "Style",
  format: "Format",
  voice: "Voice",
  voiceOff: "No voice",
  music: "Music",
  musicAuto: "Chosen for you",
  musicNone: "No music",
  captions: "Captions",
  pictures: "Pictures and clips",
  addPicture: "Add from your library",
  noPictures: "No pictures yet: the scenes use your brand colours.",
  save: "Save",
  saved: "Saved",
  cancel: "Cancel",
  saveAndApprove: "Save and make it",
  noVideos: "No videos yet",
  noVideosBody: "Approve an idea on Today's ideas and it is made here in a few minutes.",
  status: {
    approved: "Waiting",
    making: "Being made",
    ready: "Ready",
    scheduled: "Scheduled",
    posting: "Publishing",
    posted: "Posted",
    failed: "Not made",
  },
  makingBody: "The voice, captions and video are being made. This takes 2 to 5 minutes.",
  scheduledFor: "Publishes {date}",
  download: "Download",
  downloadSlide: "Slide {index}",
  publishTo: "Publish to",
  publishNow: "Publish now",
  publishBest: "At the best time",
  publishAt: "At a time",
  schedule: "Schedule",
  unschedule: "Unschedule",
  publishing: "Publishing…",
  published: "Sent to the platforms.",
  scheduledToast: "Scheduled for {date}.",
  retry: "Try again",
  failedBody: "Your credit was returned.",
  connectFirst: "Connect Instagram, TikTok, YouTube or Facebook in Settings to publish from here. You can always download the video.",
  noCarouselOnYoutube: "YouTube takes videos only, so carousels go to the other platforms.",
  noPosted: "Nothing posted yet.",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  totalViews: "{count} views",
  open: "Open",
  statsUpdated: "Updated {date}",
  accounts: "Accounts",
  accountsBody: "Connect the accounts RepGet publishes your videos to. You sign in on the platform itself; RepGet never sees your password.",
  connect: "Connect",
  connecting: "Opening…",
  disconnect: "Disconnect",
  connected: "Connected",
  paused: "Paused: {reason}",
  resume: "Resume",
  notConfigured: "Publishing is not set up on this RepGet yet. You can still make and download videos.",
  defaults: "Your videos",
  defaultStyle: "Style",
  defaultVoice: "Voice",
  musicOn: "Background music",
  captionsOn: "Captions",
  publishMode: "Publishing",
  publishManual: "I publish each video",
  publishManualHelp: "Ready videos wait for you to press Publish.",
  publishAuto: "Publish automatically",
  publishAutoHelp: "Each video you make is published at the next good time.",
  platforms: "Publish to",
  logo: "Logo",
  logoHelp: "Shown on the closing card. Without one, the first letter of your brand is shown.",
  uploadLogo: "Upload a logo",
  removeLogo: "Remove",
  library: "Your pictures and clips",
  libraryHelp: "Photos (PNG, JPG, WebP, up to 8 MB) and short clips (MP4, MOV, WebM, up to 50 MB) used in the Story style and anywhere you add them.",
  upload: "Upload",
  uploading: "Uploading…",
  remove: "Remove",
  safety: "How RepGet keeps your accounts safe",
  safetyPoints: [
    "At most 3 videos a day on each platform.",
    "Every video is different: no repeated content.",
    "If a platform refuses a video, RepGet pauses posting there until you resume it.",
    "Free music that is licensed for use in videos, and your own pictures.",
    "Video files are deleted 7 days after posting.",
  ],
  trialNote: "Videos are included in your trial.",
  notice: {
    connected: "{platform} is connected.",
    not_connected: "{platform} was not connected.",
    connect_failed: "{platform} could not be connected. Please try again.",
  },
  errors: {
    view_only: "You can view this website but not change it.",
    no_plan: "Choose a plan for this website to make videos.",
    not_found: "This idea is no longer there.",
    already_handled: "This idea has already been handled.",
    not_enough_credits: "This needs {price} and you have {available}. Buy credits on Credits.",
    bad_script: "Fill in the first line and at least two points.",
    no_accounts: "Connect at least one platform for this video in Settings.",
    not_configured: "This is not set up on this RepGet yet.",
    connect_failed: "The connection page could not be opened. Please try again.",
    bad_file: "Use a PNG, JPG or WebP picture, or an MP4, MOV or WebM clip.",
    too_big: "This file is too big.",
    bad_time: "Choose a time in the next 60 days.",
    generic: "Something went wrong. Please try again.",
  },
};

const es: VideosCopy = {
  title: "Vídeos",
  intro: "Vídeos animados cortos y carruseles de fotos creados a partir de su sitio web, con voz de IA, subtítulos y música. Deslice las ideas de hoy: las que conserve se crean y se publican por usted.",
  tabs: { ideas: "Ideas de hoy", videos: "Sus vídeos", posted: "Publicados", settings: "Ajustes" },
  today: "{approved} de {goal} creados hoy",
  dayComplete: "El día de hoy está completo",
  dayCompleteBody: "Ya ha creado los {goal} vídeos de hoy. Puede crear más con las ideas restantes; cada uno usa un crédito.",
  newIdeas: "Nuevas ideas",
  ideasQueued: "Escribiendo las ideas de hoy. Aparecerán aquí en un minuto.",
  writingIdeas: "Escribiendo las ideas de hoy…",
  writingIdeasBody: "RepGet está leyendo su sitio web y escribiendo 20 ideas de vídeo. Tarda alrededor de un minuto.",
  noIdeasLeft: "Ha visto todas las ideas de hoy",
  noIdeasLeftBody: "Cada mañana llegan nuevas ideas.",
  ideaOf: "Idea {index} de {count}",
  reel: "Reel",
  carousel: "Carrusel",
  styles: { bold: "Impacto", numbers: "Cifras", story: "Historia" },
  styleHelp: {
    bold: "Grandes titulares y una lista animada.",
    numbers: "Cada punto como una cifra que va subiendo.",
    story: "Sus imágenes y clips, con el texto encima.",
  },
  skip: "Omitir",
  undo: "Deshacer",
  edit: "Editar",
  approve: "Crear · {price}",
  approved: "Se está creando. Lo encontrará en Sus vídeos.",
  swipeHint: "Deslice a la derecha o pulse → para crearlo, a la izquierda o ← para omitirlo.",
  previewNote: "Vista previa sin la voz. El vídeo final tiene la voz de IA, subtítulos y música.",
  slide: "Diapositiva {index}",
  editTitle: "Editar la idea",
  hook: "Primera línea (el gancho)",
  point: "Punto {index}",
  pointTitle: "En pantalla",
  pointDetail: "La voz añade",
  stat: "Una cifra (opcional)",
  statValue: "Número",
  statSuffix: "Unidad",
  statLabel: "Etiqueta",
  addPoint: "Añadir un punto",
  removePoint: "Quitar",
  proof: "Prueba",
  cta: "Frase final",
  caption: "Texto de la publicación",
  style: "Estilo",
  format: "Formato",
  voice: "Voz",
  voiceOff: "Sin voz",
  music: "Música",
  musicAuto: "Elegida para usted",
  musicNone: "Sin música",
  captions: "Subtítulos",
  pictures: "Imágenes y clips",
  addPicture: "Añadir de su biblioteca",
  noPictures: "Aún no hay imágenes: las escenas usan los colores de su marca.",
  save: "Guardar",
  saved: "Guardado",
  cancel: "Cancelar",
  saveAndApprove: "Guardar y crear",
  noVideos: "Aún no hay vídeos",
  noVideosBody: "Apruebe una idea en Ideas de hoy y se creará aquí en unos minutos.",
  status: {
    approved: "En espera",
    making: "En creación",
    ready: "Listo",
    scheduled: "Programado",
    posting: "Publicando",
    posted: "Publicado",
    failed: "No creado",
  },
  makingBody: "Se están creando la voz, los subtítulos y el vídeo. Tarda de 2 a 5 minutos.",
  scheduledFor: "Se publica el {date}",
  download: "Descargar",
  downloadSlide: "Diapositiva {index}",
  publishTo: "Publicar en",
  publishNow: "Publicar ahora",
  publishBest: "A la mejor hora",
  publishAt: "A una hora",
  schedule: "Programar",
  unschedule: "Desprogramar",
  publishing: "Publicando…",
  published: "Enviado a las plataformas.",
  scheduledToast: "Programado para el {date}.",
  retry: "Reintentar",
  failedBody: "Se le ha devuelto el crédito.",
  connectFirst: "Conecte Instagram, TikTok, YouTube o Facebook en Ajustes para publicar desde aquí. Siempre puede descargar el vídeo.",
  noCarouselOnYoutube: "YouTube solo admite vídeos, así que los carruseles van a las demás plataformas.",
  noPosted: "Todavía no hay nada publicado.",
  views: "Visualizaciones",
  likes: "Me gusta",
  comments: "Comentarios",
  shares: "Compartidos",
  totalViews: "{count} visualizaciones",
  open: "Abrir",
  statsUpdated: "Actualizado el {date}",
  accounts: "Cuentas",
  accountsBody: "Conecte las cuentas en las que RepGet publica sus vídeos. Usted inicia sesión en la propia plataforma; RepGet nunca ve su contraseña.",
  connect: "Conectar",
  connecting: "Abriendo…",
  disconnect: "Desconectar",
  connected: "Conectado",
  paused: "En pausa: {reason}",
  resume: "Reanudar",
  notConfigured: "La publicación todavía no está configurada en este RepGet. Puede seguir creando y descargando vídeos.",
  defaults: "Sus vídeos",
  defaultStyle: "Estilo",
  defaultVoice: "Voz",
  musicOn: "Música de fondo",
  captionsOn: "Subtítulos",
  publishMode: "Publicación",
  publishManual: "Publico cada vídeo yo",
  publishManualHelp: "Los vídeos listos esperan a que pulse Publicar.",
  publishAuto: "Publicar automáticamente",
  publishAutoHelp: "Cada vídeo que cree se publica en el siguiente buen momento.",
  platforms: "Publicar en",
  logo: "Logotipo",
  logoHelp: "Se muestra en la tarjeta final. Si no tiene uno, se muestra la inicial de su marca.",
  uploadLogo: "Subir un logotipo",
  removeLogo: "Quitar",
  library: "Sus imágenes y clips",
  libraryHelp: "Fotos (PNG, JPG, WebP, hasta 8 MB) y clips cortos (MP4, MOV, WebM, hasta 50 MB) que se usan en el estilo Historia y donde usted los añada.",
  upload: "Subir",
  uploading: "Subiendo…",
  remove: "Quitar",
  safety: "Cómo RepGet mantiene seguras sus cuentas",
  safetyPoints: [
    "Como máximo 3 vídeos al día en cada plataforma.",
    "Cada vídeo es distinto: sin contenido repetido.",
    "Si una plataforma rechaza un vídeo, RepGet pausa las publicaciones allí hasta que usted las reanude.",
    "Música gratuita con licencia para usarse en vídeos, y sus propias imágenes.",
    "Los archivos de vídeo se eliminan 7 días después de publicarse.",
  ],
  trialNote: "Los vídeos están incluidos en su prueba.",
  notice: {
    connected: "{platform} está conectado.",
    not_connected: "No se conectó {platform}.",
    connect_failed: "No se pudo conectar {platform}. Inténtelo de nuevo.",
  },
  errors: {
    view_only: "Puede ver este sitio web, pero no modificarlo.",
    no_plan: "Elija un plan para este sitio web para crear vídeos.",
    not_found: "Esta idea ya no está disponible.",
    already_handled: "Esta idea ya se ha gestionado.",
    not_enough_credits: "Esto cuesta {price} y tiene {available}. Compre créditos en Créditos.",
    bad_script: "Rellene la primera línea y al menos dos puntos.",
    no_accounts: "Conecte al menos una plataforma para este vídeo en Ajustes.",
    not_configured: "Esto todavía no está configurado en este RepGet.",
    connect_failed: "No se pudo abrir la página de conexión. Inténtelo de nuevo.",
    bad_file: "Use una imagen PNG, JPG o WebP, o un clip MP4, MOV o WebM.",
    too_big: "Este archivo es demasiado grande.",
    bad_time: "Elija una hora dentro de los próximos 60 días.",
    generic: "Algo salió mal. Inténtelo de nuevo.",
  },
};

const fr: VideosCopy = {
  title: "Vidéos",
  intro: "De courtes vidéos animées et des carrousels de photos créés à partir de votre site, avec une voix IA, des sous-titres et de la musique. Faites défiler les idées du jour : celles que vous gardez sont créées et publiées pour vous.",
  tabs: { ideas: "Idées du jour", videos: "Vos vidéos", posted: "Publiées", settings: "Paramètres" },
  today: "{approved} sur {goal} créées aujourd’hui",
  dayComplete: "La journée est terminée",
  dayCompleteBody: "Vous avez créé les {goal} vidéos du jour. Vous pouvez en créer d’autres avec les idées restantes ; chacune utilise un crédit.",
  newIdeas: "Nouvelles idées",
  ideasQueued: "Rédaction des idées du jour. Elles apparaîtront ici d’ici une minute.",
  writingIdeas: "Rédaction des idées du jour…",
  writingIdeasBody: "RepGet lit votre site et rédige 20 idées de vidéos. Cela prend environ une minute.",
  noIdeasLeft: "Vous avez vu toutes les idées du jour",
  noIdeasLeftBody: "De nouvelles idées arrivent chaque matin.",
  ideaOf: "Idée {index} sur {count}",
  reel: "Reel",
  carousel: "Carrousel",
  styles: { bold: "Percutant", numbers: "Chiffres", story: "Récit" },
  styleHelp: {
    bold: "De grands titres et une liste animée.",
    numbers: "Chaque point sous forme de chiffre qui défile.",
    story: "Vos images et vos clips, avec le texte par-dessus.",
  },
  skip: "Ignorer",
  undo: "Annuler",
  edit: "Modifier",
  approve: "Créer · {price}",
  approved: "En cours de création. Vous la trouverez dans Vos vidéos.",
  swipeHint: "Balayez vers la droite ou appuyez sur → pour la créer, vers la gauche ou ← pour l’ignorer.",
  previewNote: "Aperçu sans la voix. La vidéo finale comporte la voix IA, les sous-titres et la musique.",
  slide: "Diapositive {index}",
  editTitle: "Modifier l’idée",
  hook: "Première ligne (l’accroche)",
  point: "Point {index}",
  pointTitle: "À l’écran",
  pointDetail: "La voix ajoute",
  stat: "Un chiffre (facultatif)",
  statValue: "Nombre",
  statSuffix: "Unité",
  statLabel: "Libellé",
  addPoint: "Ajouter un point",
  removePoint: "Retirer",
  proof: "Preuve",
  cta: "Phrase de fin",
  caption: "Texte de la publication",
  style: "Style",
  format: "Format",
  voice: "Voix",
  voiceOff: "Sans voix",
  music: "Musique",
  musicAuto: "Choisie pour vous",
  musicNone: "Sans musique",
  captions: "Sous-titres",
  pictures: "Images et clips",
  addPicture: "Ajouter depuis votre bibliothèque",
  noPictures: "Pas encore d’images : les scènes utilisent les couleurs de votre marque.",
  save: "Enregistrer",
  saved: "Enregistré",
  cancel: "Annuler",
  saveAndApprove: "Enregistrer et créer",
  noVideos: "Pas encore de vidéos",
  noVideosBody: "Approuvez une idée dans Idées du jour et elle sera créée ici en quelques minutes.",
  status: {
    approved: "En attente",
    making: "En création",
    ready: "Prête",
    scheduled: "Programmée",
    posting: "Publication",
    posted: "Publiée",
    failed: "Non créée",
  },
  makingBody: "La voix, les sous-titres et la vidéo sont en cours de création. Cela prend de 2 à 5 minutes.",
  scheduledFor: "Publication le {date}",
  download: "Télécharger",
  downloadSlide: "Diapositive {index}",
  publishTo: "Publier sur",
  publishNow: "Publier maintenant",
  publishBest: "Au meilleur moment",
  publishAt: "À une heure précise",
  schedule: "Programmer",
  unschedule: "Déprogrammer",
  publishing: "Publication…",
  published: "Envoyée aux plateformes.",
  scheduledToast: "Programmée pour le {date}.",
  retry: "Réessayer",
  failedBody: "Votre crédit vous a été rendu.",
  connectFirst: "Connectez Instagram, TikTok, YouTube ou Facebook dans Paramètres pour publier d’ici. Vous pouvez toujours télécharger la vidéo.",
  noCarouselOnYoutube: "YouTube n’accepte que les vidéos : les carrousels vont donc sur les autres plateformes.",
  noPosted: "Rien n’a encore été publié.",
  views: "Vues",
  likes: "J’aime",
  comments: "Commentaires",
  shares: "Partages",
  totalViews: "{count} vues",
  open: "Ouvrir",
  statsUpdated: "Mis à jour le {date}",
  accounts: "Comptes",
  accountsBody: "Connectez les comptes sur lesquels RepGet publie vos vidéos. Vous vous connectez sur la plateforme elle-même ; RepGet ne voit jamais votre mot de passe.",
  connect: "Connecter",
  connecting: "Ouverture…",
  disconnect: "Déconnecter",
  connected: "Connecté",
  paused: "En pause : {reason}",
  resume: "Reprendre",
  notConfigured: "La publication n’est pas encore configurée sur ce RepGet. Vous pouvez tout de même créer et télécharger des vidéos.",
  defaults: "Vos vidéos",
  defaultStyle: "Style",
  defaultVoice: "Voix",
  musicOn: "Musique de fond",
  captionsOn: "Sous-titres",
  publishMode: "Publication",
  publishManual: "Je publie chaque vidéo",
  publishManualHelp: "Les vidéos prêtes attendent que vous cliquiez sur Publier.",
  publishAuto: "Publier automatiquement",
  publishAutoHelp: "Chaque vidéo que vous créez est publiée au prochain bon moment.",
  platforms: "Publier sur",
  logo: "Logo",
  logoHelp: "Affiché sur la carte de fin. Sans logo, l’initiale de votre marque est affichée.",
  uploadLogo: "Importer un logo",
  removeLogo: "Retirer",
  library: "Vos images et clips",
  libraryHelp: "Photos (PNG, JPG, WebP, jusqu’à 8 MB) et courts clips (MP4, MOV, WebM, jusqu’à 50 MB) utilisés dans le style Récit et partout où vous les ajoutez.",
  upload: "Importer",
  uploading: "Importation…",
  remove: "Retirer",
  safety: "Comment RepGet protège vos comptes",
  safetyPoints: [
    "Au maximum 3 vidéos par jour sur chaque plateforme.",
    "Chaque vidéo est différente : aucun contenu répété.",
    "Si une plateforme refuse une vidéo, RepGet suspend la publication sur celle-ci jusqu’à ce que vous la repreniez.",
    "De la musique gratuite sous licence pour les vidéos, et vos propres images.",
    "Les fichiers vidéo sont supprimés 7 jours après la publication.",
  ],
  trialNote: "Les vidéos sont incluses dans votre essai.",
  notice: {
    connected: "{platform} est connecté.",
    not_connected: "{platform} n’a pas été connecté.",
    connect_failed: "{platform} n’a pas pu être connecté. Veuillez réessayer.",
  },
  errors: {
    view_only: "Vous pouvez consulter ce site, mais pas le modifier.",
    no_plan: "Choisissez un forfait pour ce site afin de créer des vidéos.",
    not_found: "Cette idée n’est plus disponible.",
    already_handled: "Cette idée a déjà été traitée.",
    not_enough_credits: "Cela coûte {price} et vous en avez {available}. Achetez des crédits dans Crédits.",
    bad_script: "Remplissez la première ligne et au moins deux points.",
    no_accounts: "Connectez au moins une plateforme pour cette vidéo dans Paramètres.",
    not_configured: "Ce n’est pas encore configuré sur ce RepGet.",
    connect_failed: "La page de connexion n’a pas pu s’ouvrir. Veuillez réessayer.",
    bad_file: "Utilisez une image PNG, JPG ou WebP, ou un clip MP4, MOV ou WebM.",
    too_big: "Ce fichier est trop volumineux.",
    bad_time: "Choisissez une heure dans les 60 prochains jours.",
    generic: "Une erreur s’est produite. Veuillez réessayer.",
  },
};

const it: VideosCopy = {
  title: "Video",
  intro: "Brevi video animati e caroselli di foto creati dal suo sito, con voce IA, sottotitoli e musica. Scorra le idee di oggi: quelle che tiene vengono create e pubblicate per lei.",
  tabs: { ideas: "Idee di oggi", videos: "I suoi video", posted: "Pubblicati", settings: "Impostazioni" },
  today: "{approved} di {goal} creati oggi",
  dayComplete: "La giornata è completa",
  dayCompleteBody: "Ha creato i {goal} video di oggi. Può crearne altri con le idee rimaste; ognuno usa un credito.",
  newIdeas: "Nuove idee",
  ideasQueued: "Sto scrivendo le idee di oggi. Appariranno qui fra un minuto.",
  writingIdeas: "Scrittura delle idee di oggi…",
  writingIdeasBody: "RepGet sta leggendo il suo sito e scrivendo 20 idee per video. Ci vuole circa un minuto.",
  noIdeasLeft: "Ha visto tutte le idee di oggi",
  noIdeasLeftBody: "Nuove idee arrivano ogni mattina.",
  ideaOf: "Idea {index} di {count}",
  reel: "Reel",
  carousel: "Carosello",
  styles: { bold: "Impatto", numbers: "Numeri", story: "Racconto" },
  styleHelp: {
    bold: "Grandi titoli e una checklist animata.",
    numbers: "Ogni punto come una cifra che sale.",
    story: "Le sue immagini e clip, con il testo sopra.",
  },
  skip: "Salta",
  undo: "Annulla",
  edit: "Modifica",
  approve: "Crea · {price}",
  approved: "In creazione. Lo troverà in I suoi video.",
  swipeHint: "Scorra a destra o prema → per crearlo, a sinistra o ← per saltarlo.",
  previewNote: "Anteprima senza voce. Il video finito ha la voce IA, i sottotitoli e la musica.",
  slide: "Slide {index}",
  editTitle: "Modifica l’idea",
  hook: "Prima riga (il gancio)",
  point: "Punto {index}",
  pointTitle: "Sullo schermo",
  pointDetail: "La voce aggiunge",
  stat: "Una cifra (facoltativa)",
  statValue: "Numero",
  statSuffix: "Unità",
  statLabel: "Etichetta",
  addPoint: "Aggiungi un punto",
  removePoint: "Rimuovi",
  proof: "Prova",
  cta: "Frase finale",
  caption: "Testo del post",
  style: "Stile",
  format: "Formato",
  voice: "Voce",
  voiceOff: "Senza voce",
  music: "Musica",
  musicAuto: "Scelta per lei",
  musicNone: "Senza musica",
  captions: "Sottotitoli",
  pictures: "Immagini e clip",
  addPicture: "Aggiungi dalla sua libreria",
  noPictures: "Ancora nessuna immagine: le scene usano i colori del suo marchio.",
  save: "Salva",
  saved: "Salvato",
  cancel: "Annulla",
  saveAndApprove: "Salva e crea",
  noVideos: "Ancora nessun video",
  noVideosBody: "Approvi un’idea in Idee di oggi e verrà creata qui in pochi minuti.",
  status: {
    approved: "In attesa",
    making: "In creazione",
    ready: "Pronto",
    scheduled: "Programmato",
    posting: "Pubblicazione",
    posted: "Pubblicato",
    failed: "Non creato",
  },
  makingBody: "Voce, sottotitoli e video sono in creazione. Ci vogliono da 2 a 5 minuti.",
  scheduledFor: "Pubblicazione il {date}",
  download: "Scarica",
  downloadSlide: "Slide {index}",
  publishTo: "Pubblica su",
  publishNow: "Pubblica ora",
  publishBest: "All’orario migliore",
  publishAt: "A un orario",
  schedule: "Programma",
  unschedule: "Annulla programmazione",
  publishing: "Pubblicazione…",
  published: "Inviato alle piattaforme.",
  scheduledToast: "Programmato per il {date}.",
  retry: "Riprova",
  failedBody: "Il suo credito è stato restituito.",
  connectFirst: "Colleghi Instagram, TikTok, YouTube o Facebook in Impostazioni per pubblicare da qui. Può sempre scaricare il video.",
  noCarouselOnYoutube: "YouTube accetta solo video, quindi i caroselli vanno sulle altre piattaforme.",
  noPosted: "Ancora niente di pubblicato.",
  views: "Visualizzazioni",
  likes: "Mi piace",
  comments: "Commenti",
  shares: "Condivisioni",
  totalViews: "{count} visualizzazioni",
  open: "Apri",
  statsUpdated: "Aggiornato il {date}",
  accounts: "Account",
  accountsBody: "Colleghi gli account su cui RepGet pubblica i suoi video. Accede sulla piattaforma stessa; RepGet non vede mai la sua password.",
  connect: "Collega",
  connecting: "Apertura…",
  disconnect: "Scollega",
  connected: "Collegato",
  paused: "In pausa: {reason}",
  resume: "Riprendi",
  notConfigured: "La pubblicazione non è ancora configurata su questo RepGet. Può comunque creare e scaricare video.",
  defaults: "I suoi video",
  defaultStyle: "Stile",
  defaultVoice: "Voce",
  musicOn: "Musica di sottofondo",
  captionsOn: "Sottotitoli",
  publishMode: "Pubblicazione",
  publishManual: "Pubblico io ogni video",
  publishManualHelp: "I video pronti aspettano che lei prema Pubblica.",
  publishAuto: "Pubblica automaticamente",
  publishAutoHelp: "Ogni video che crea viene pubblicato al prossimo momento adatto.",
  platforms: "Pubblica su",
  logo: "Logo",
  logoHelp: "Mostrato nella scheda finale. Senza logo, si mostra l’iniziale del suo marchio.",
  uploadLogo: "Carica un logo",
  removeLogo: "Rimuovi",
  library: "Le sue immagini e clip",
  libraryHelp: "Foto (PNG, JPG, WebP, fino a 8 MB) e brevi clip (MP4, MOV, WebM, fino a 50 MB) usate nello stile Racconto e ovunque le aggiunga.",
  upload: "Carica",
  uploading: "Caricamento…",
  remove: "Rimuovi",
  safety: "Come RepGet protegge i suoi account",
  safetyPoints: [
    "Al massimo 3 video al giorno su ogni piattaforma.",
    "Ogni video è diverso: nessun contenuto ripetuto.",
    "Se una piattaforma rifiuta un video, RepGet sospende la pubblicazione lì finché lei non la riprende.",
    "Musica gratuita con licenza per l’uso nei video, e le sue immagini.",
    "I file video vengono eliminati 7 giorni dopo la pubblicazione.",
  ],
  trialNote: "I video sono inclusi nella sua prova.",
  notice: {
    connected: "{platform} è collegato.",
    not_connected: "{platform} non è stato collegato.",
    connect_failed: "Non è stato possibile collegare {platform}. Riprovi.",
  },
  errors: {
    view_only: "Può vedere questo sito ma non modificarlo.",
    no_plan: "Scelga un piano per questo sito per creare video.",
    not_found: "Questa idea non è più disponibile.",
    already_handled: "Questa idea è già stata gestita.",
    not_enough_credits: "Costa {price} e ne ha {available}. Acquisti crediti in Crediti.",
    bad_script: "Compili la prima riga e almeno due punti.",
    no_accounts: "Colleghi almeno una piattaforma per questo video in Impostazioni.",
    not_configured: "Non è ancora configurato su questo RepGet.",
    connect_failed: "Non è stato possibile aprire la pagina di collegamento. Riprovi.",
    bad_file: "Usi un’immagine PNG, JPG o WebP, o una clip MP4, MOV o WebM.",
    too_big: "Questo file è troppo grande.",
    bad_time: "Scelga un orario entro i prossimi 60 giorni.",
    generic: "Qualcosa è andato storto. Riprovi.",
  },
};

const de: VideosCopy = {
  title: "Videos",
  intro: "Kurze animierte Videos und Foto-Karussells aus Ihrer Website, mit KI-Stimme, Untertiteln und Musik. Wischen Sie durch die Ideen von heute: Die, die Sie behalten, werden für Sie erstellt und veröffentlicht.",
  tabs: { ideas: "Ideen von heute", videos: "Ihre Videos", posted: "Gepostet", settings: "Einstellungen" },
  today: "{approved} von {goal} heute erstellt",
  dayComplete: "Für heute erledigt",
  dayCompleteBody: "Sie haben die {goal} Videos von heute erstellt. Mit den übrigen Ideen können Sie weitere erstellen; jedes kostet einen Credit.",
  newIdeas: "Neue Ideen",
  ideasQueued: "Die Ideen von heute werden geschrieben. Sie erscheinen hier in einer Minute.",
  writingIdeas: "Ideen von heute werden geschrieben…",
  writingIdeasBody: "RepGet liest Ihre Website und schreibt 20 Videoideen. Das dauert etwa eine Minute.",
  noIdeasLeft: "Sie haben alle Ideen von heute gesehen",
  noIdeasLeftBody: "Jeden Morgen kommen neue Ideen.",
  ideaOf: "Idee {index} von {count}",
  reel: "Reel",
  carousel: "Karussell",
  styles: { bold: "Plakativ", numbers: "Zahlen", story: "Story" },
  styleHelp: {
    bold: "Große Überschriften und eine animierte Checkliste.",
    numbers: "Jeder Punkt als Zahl, die hochzählt.",
    story: "Ihre Bilder und Clips, mit dem Text darüber.",
  },
  skip: "Überspringen",
  undo: "Rückgängig",
  edit: "Bearbeiten",
  approve: "Erstellen · {price}",
  approved: "Wird erstellt. Sie finden es unter Ihre Videos.",
  swipeHint: "Nach rechts wischen oder → drücken zum Erstellen, nach links oder ← zum Überspringen.",
  previewNote: "Vorschau ohne Stimme. Das fertige Video hat KI-Stimme, Untertitel und Musik.",
  slide: "Folie {index}",
  editTitle: "Idee bearbeiten",
  hook: "Erste Zeile (der Aufhänger)",
  point: "Punkt {index}",
  pointTitle: "Auf dem Bildschirm",
  pointDetail: "Die Stimme ergänzt",
  stat: "Eine Zahl (optional)",
  statValue: "Zahl",
  statSuffix: "Einheit",
  statLabel: "Beschriftung",
  addPoint: "Punkt hinzufügen",
  removePoint: "Entfernen",
  proof: "Beleg",
  cta: "Schlusssatz",
  caption: "Beitragstext",
  style: "Stil",
  format: "Format",
  voice: "Stimme",
  voiceOff: "Keine Stimme",
  music: "Musik",
  musicAuto: "Für Sie ausgewählt",
  musicNone: "Keine Musik",
  captions: "Untertitel",
  pictures: "Bilder und Clips",
  addPicture: "Aus Ihrer Mediathek hinzufügen",
  noPictures: "Noch keine Bilder: Die Szenen verwenden Ihre Markenfarben.",
  save: "Speichern",
  saved: "Gespeichert",
  cancel: "Abbrechen",
  saveAndApprove: "Speichern und erstellen",
  noVideos: "Noch keine Videos",
  noVideosBody: "Genehmigen Sie eine Idee unter Ideen von heute, und sie wird hier in wenigen Minuten erstellt.",
  status: {
    approved: "Wartet",
    making: "Wird erstellt",
    ready: "Bereit",
    scheduled: "Geplant",
    posting: "Wird veröffentlicht",
    posted: "Gepostet",
    failed: "Nicht erstellt",
  },
  makingBody: "Stimme, Untertitel und Video werden erstellt. Das dauert 2 bis 5 Minuten.",
  scheduledFor: "Wird am {date} veröffentlicht",
  download: "Herunterladen",
  downloadSlide: "Folie {index}",
  publishTo: "Veröffentlichen auf",
  publishNow: "Jetzt veröffentlichen",
  publishBest: "Zur besten Zeit",
  publishAt: "Zu einer Uhrzeit",
  schedule: "Planen",
  unschedule: "Planung aufheben",
  publishing: "Wird veröffentlicht…",
  published: "An die Plattformen gesendet.",
  scheduledToast: "Geplant für {date}.",
  retry: "Erneut versuchen",
  failedBody: "Ihr Credit wurde zurückerstattet.",
  connectFirst: "Verbinden Sie Instagram, TikTok, YouTube oder Facebook in den Einstellungen, um von hier aus zu veröffentlichen. Herunterladen können Sie das Video jederzeit.",
  noCarouselOnYoutube: "YouTube nimmt nur Videos an, daher gehen Karussells an die anderen Plattformen.",
  noPosted: "Noch nichts gepostet.",
  views: "Aufrufe",
  likes: "Likes",
  comments: "Kommentare",
  shares: "Geteilt",
  totalViews: "{count} Aufrufe",
  open: "Öffnen",
  statsUpdated: "Aktualisiert {date}",
  accounts: "Konten",
  accountsBody: "Verbinden Sie die Konten, auf denen RepGet Ihre Videos veröffentlicht. Sie melden sich auf der Plattform selbst an; RepGet sieht Ihr Passwort nie.",
  connect: "Verbinden",
  connecting: "Wird geöffnet…",
  disconnect: "Trennen",
  connected: "Verbunden",
  paused: "Pausiert: {reason}",
  resume: "Fortsetzen",
  notConfigured: "Das Veröffentlichen ist auf diesem RepGet noch nicht eingerichtet. Sie können trotzdem Videos erstellen und herunterladen.",
  defaults: "Ihre Videos",
  defaultStyle: "Stil",
  defaultVoice: "Stimme",
  musicOn: "Hintergrundmusik",
  captionsOn: "Untertitel",
  publishMode: "Veröffentlichung",
  publishManual: "Ich veröffentliche jedes Video selbst",
  publishManualHelp: "Fertige Videos warten, bis Sie auf Veröffentlichen klicken.",
  publishAuto: "Automatisch veröffentlichen",
  publishAutoHelp: "Jedes Video, das Sie erstellen, wird zur nächsten guten Zeit veröffentlicht.",
  platforms: "Veröffentlichen auf",
  logo: "Logo",
  logoHelp: "Wird auf der Schlusskarte angezeigt. Ohne Logo wird der Anfangsbuchstabe Ihrer Marke gezeigt.",
  uploadLogo: "Logo hochladen",
  removeLogo: "Entfernen",
  library: "Ihre Bilder und Clips",
  libraryHelp: "Fotos (PNG, JPG, WebP, bis 8 MB) und kurze Clips (MP4, MOV, WebM, bis 50 MB), die im Stil Story und überall dort verwendet werden, wo Sie sie hinzufügen.",
  upload: "Hochladen",
  uploading: "Wird hochgeladen…",
  remove: "Entfernen",
  safety: "So schützt RepGet Ihre Konten",
  safetyPoints: [
    "Höchstens 3 Videos pro Tag auf jeder Plattform.",
    "Jedes Video ist anders: keine wiederholten Inhalte.",
    "Lehnt eine Plattform ein Video ab, pausiert RepGet das Posten dort, bis Sie es fortsetzen.",
    "Kostenlose Musik mit Lizenz für die Nutzung in Videos, und Ihre eigenen Bilder.",
    "Videodateien werden 7 Tage nach dem Posten gelöscht.",
  ],
  trialNote: "Videos sind in Ihrer Testphase enthalten.",
  notice: {
    connected: "{platform} ist verbunden.",
    not_connected: "{platform} wurde nicht verbunden.",
    connect_failed: "{platform} konnte nicht verbunden werden. Bitte versuchen Sie es erneut.",
  },
  errors: {
    view_only: "Sie können diese Website ansehen, aber nicht ändern.",
    no_plan: "Wählen Sie einen Tarif für diese Website, um Videos zu erstellen.",
    not_found: "Diese Idee ist nicht mehr verfügbar.",
    already_handled: "Diese Idee wurde bereits bearbeitet.",
    not_enough_credits: "Das kostet {price}, und Sie haben {available}. Kaufen Sie Credits unter Credits.",
    bad_script: "Füllen Sie die erste Zeile und mindestens zwei Punkte aus.",
    no_accounts: "Verbinden Sie in den Einstellungen mindestens eine Plattform für dieses Video.",
    not_configured: "Das ist auf diesem RepGet noch nicht eingerichtet.",
    connect_failed: "Die Verbindungsseite konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.",
    bad_file: "Verwenden Sie ein PNG-, JPG- oder WebP-Bild oder einen MP4-, MOV- oder WebM-Clip.",
    too_big: "Diese Datei ist zu groß.",
    bad_time: "Wählen Sie eine Uhrzeit in den nächsten 60 Tagen.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
};

/** One full translation per locale; keep the five objects in step when a key changes. */
export const VIDEOS_COPY: Record<Locale, VideosCopy> = { en, es, fr, it, de };
