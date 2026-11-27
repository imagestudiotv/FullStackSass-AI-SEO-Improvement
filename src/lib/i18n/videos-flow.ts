import type { Locale } from "@/lib/i18n/config";
import { VIDEO_LIBRARY_COPY, type LibraryCopy } from "@/lib/i18n/videos-library";

/**
 * The Social Content review flow's words (client, 2026-11-21: Today's ideas
 * offered one at a time with Skip, Edit and Approve; the publishing window
 * after Approve - manual, automatic or saved for later; Saved Videos; paid
 * New ideas). Five languages, formal address, like lib/i18n/videos.ts, whose
 * VideosCopy carries these as `flow`. {placeholders} are filled with format().
 */
/** The review window's words that differ for a carousel: the slides, never "the video". */
export type CarouselPopup = {
  /** Manual publish's body. */
  manual: string;
  /** Save for later's body. */
  save: string;
  /** The note under the modes for Save for later. */
  saveNote: string;
  preview: string;
  making: string;
  makingBody: string;
  download: string;
  waitVideo: string;
  manualStill: string;
  whenReady: string;
  saveBody: string;
};

export type FlowCopy = {
  deck: {
    /** The content-type filter's first option. */
    filterAll: string;
    /** The tag over the preview: the idea's category. */
    tags: { viral: string; educational: string; authority: string; promotional: string };
    /** "Approve · {price}" */
    approve: string;
    /** The {price} of a free trial's free video (lib/video/trial-free.ts): "free (2 of 3 left)". */
    trialFree: string;
    skipLabel: string;
    /** The toast after Skip, with Undo. */
    skipped: string;
    showDetails: string;
    hideDetails: string;
    hint: string;
    /** The hint when the idea shown is a carousel (client, 2026-11-26: "This is a carousel but when I click approve it says create your video"). */
    hintCarousel: string;
  };
  /** New ideas: extra batches cost credits; the daily twenty stay free. */
  ideas: {
    /** "{price} a batch · {left} of {total} left today" */
    left: string;
    note: string;
    /** "A batch costs {price}; you have {available}." */
    short: string;
    buy: string;
    earn: string;
    usedUp: string;
  };
  popup: {
    eyebrow: string;
    title: string;
    close: string;
    step: string;
    question: string;
    modes: Record<"manual" | "auto" | "save", { title: string; body: string }>;
    notes: Record<"manual" | "auto" | "save", string>;
    /** "Posted on {count} of {total}" */
    progress: string;
    preview: string;
    making: string;
    makingBody: string;
    download: string;
    textsTitle: string;
    textsBody: string;
    titleLabel: string;
    captionLabel: string;
    /** "{count} / {max} characters" */
    chars: string;
    copyTitle: string;
    copyText: string;
    copied: string;
    copyFailed: string;
    /** "Open {platform}" */
    open: string;
    markPosted: string;
    unmarkPosted: string;
    /** "Marked as posted on {platform}." */
    marked: string;
    /** "{platform} is no longer marked as posted." */
    unmarked: string;
    postedBadge: string;
    waitVideo: string;
    noConnected: string;
    connect: string;
    manualStill: string;
    whenReady: string;
    autoText: string;
    saveBody: string;
    save: string;
    saved: string;
    /** A carousel's words where they differ (client, 2026-11-26: a carousel is slides, never "your video"); popupCopy() lays them over the rest. */
    carousel: CarouselPopup;
  };
  saved: { emptyTitle: string; emptyBody: string; ready: string };
  posted: { manual: string; publish: string };
  errors: { not_ready: string; extra_used_up: string };
  /** Deleting videos, tags, the neutral words (2026-11-24; lib/i18n/videos-library.ts). */
  library: LibraryCopy;
};

const en: FlowCopy = {
  deck: {
    filterAll: "All content types",
    tags: { viral: "Viral idea", educational: "Educational idea", authority: "Authority idea", promotional: "Promotional idea" },
    approve: "Approve · {price}",
    trialFree: "free ({left} of {total} left)",
    skipLabel: "Skip this idea",
    skipped: "Idea skipped",
    showDetails: "Idea details",
    hideDetails: "Hide details",
    hint: "← → browse the ideas. Approve makes the video and opens publishing.",
    hintCarousel: "← → browse the ideas. Approve makes the carousel and opens publishing.",
  },
  ideas: {
    left: "{price} a batch · {left} of {total} left today",
    note: "Each batch adds 10 ideas. Your 20 daily ideas stay free.",
    short: "A batch costs {price}; you have {available}.",
    buy: "Buy credits",
    earn: "Earn credits",
    usedUp: "You have used today's 3 extra batches. More ideas arrive tomorrow morning.",
  },
  popup: {
    eyebrow: "Social Content",
    title: "Review & publish",
    close: "Close",
    step: "Your next step",
    question: "How would you like to publish?",
    modes: {
      manual: { title: "Manual publish", body: "Copy the text, download the video and post it yourself." },
      auto: { title: "Auto publish", body: "Publish through your connected social accounts." },
      save: { title: "Save for later", body: "Keep the video in Saved Videos for another day." },
    },
    notes: {
      manual: "No social account is needed. Nothing is published until you post it yourself.",
      auto: "RepGet publishes only to the accounts you choose, when you choose.",
      save: "Nothing is published. The video waits in Saved Videos.",
    },
    progress: "Posted on {count} of {total}",
    preview: "Video preview",
    making: "Making your video…",
    makingBody: "This takes a few minutes. You can close this window: the video waits in Saved Videos.",
    download: "Download video",
    textsTitle: "Platform-ready text",
    textsBody: "Each platform has its own text. Edit it, copy it, then post it there.",
    titleLabel: "Title",
    captionLabel: "Caption",
    chars: "{count} / {max} characters",
    copyTitle: "Copy title",
    copyText: "Copy text",
    copied: "Copied",
    copyFailed: "Could not copy. Select the text and copy it yourself.",
    open: "Open {platform}",
    markPosted: "Mark as posted",
    unmarkPosted: "Not posted yet",
    marked: "Marked as posted on {platform}.",
    unmarked: "{platform} is no longer marked as posted.",
    postedBadge: "Posted",
    waitVideo: "Download the video once it is ready, post it, then mark it as posted.",
    noConnected: "No social account is connected yet.",
    connect: "Connect accounts",
    manualStill: "You can still publish manually: copy the text, download the video and post it yourself.",
    whenReady: "Auto publish opens once the video is ready. You can close this window: the video waits in Saved Videos.",
    autoText: "RepGet posts the idea's own text, fitted to each platform.",
    saveBody: "The video stays in Saved Videos. Publish it whenever you like, yourself or automatically.",
    save: "Save for later",
    saved: "Saved in Saved Videos.",
    carousel: {
      manual: "Copy the text, download the slides and post them yourself.",
      save: "Keep the carousel in Saved Videos for another day.",
      saveNote: "Nothing is published. The carousel waits in Saved Videos.",
      preview: "Carousel preview",
      making: "Making your carousel…",
      makingBody: "This takes a few minutes. You can close this window: the carousel waits in Saved Videos.",
      download: "Download slides",
      waitVideo: "Download the slides once they are ready, post them, then mark the carousel as posted.",
      manualStill: "You can still publish manually: copy the text, download the slides and post them yourself.",
      whenReady: "Auto publish opens once the carousel is ready. You can close this window: the carousel waits in Saved Videos.",
      saveBody: "The carousel stays in Saved Videos. Publish it whenever you like, yourself or automatically.",
    },
  },
  saved: {
    emptyTitle: "No saved videos yet",
    emptyBody: "Approve an idea on Today's ideas: the video is made and waits here until you publish it.",
    ready: "Ready to publish",
  },
  posted: { manual: "posted by you", publish: "Publish" },
  errors: {
    not_ready: "The video is still being made. Mark it as posted once it is ready.",
    extra_used_up: "You have used today's 3 extra batches of ideas. More arrive tomorrow morning.",
  },
  library: VIDEO_LIBRARY_COPY.en,
};

const es: FlowCopy = {
  deck: {
    filterAll: "Todos los tipos de contenido",
    tags: { viral: "Idea viral", educational: "Idea educativa", authority: "Idea de autoridad", promotional: "Idea promocional" },
    approve: "Aprobar · {price}",
    trialFree: "gratis (quedan {left} de {total})",
    skipLabel: "Omitir esta idea",
    skipped: "Idea omitida",
    showDetails: "Detalles de la idea",
    hideDetails: "Ocultar detalles",
    hint: "← → recorren las ideas. Aprobar crea el vídeo y abre la publicación.",
    hintCarousel: "← → recorren las ideas. Aprobar crea el carrusel y abre la publicación.",
  },
  ideas: {
    left: "{price} por lote · quedan {left} de {total} hoy",
    note: "Cada lote añade 10 ideas. Sus 20 ideas diarias siguen siendo gratis.",
    short: "Un lote cuesta {price}; usted tiene {available}.",
    buy: "Comprar créditos",
    earn: "Ganar créditos",
    usedUp: "Ya ha usado los 3 lotes extra de hoy. Mañana por la mañana llegan más ideas.",
  },
  popup: {
    eyebrow: "Contenido social",
    title: "Revisar y publicar",
    close: "Cerrar",
    step: "Su siguiente paso",
    question: "¿Cómo quiere publicar?",
    modes: {
      manual: { title: "Publicación manual", body: "Copie el texto, descargue el vídeo y publíquelo usted mismo." },
      auto: { title: "Publicación automática", body: "Publique a través de sus cuentas sociales conectadas." },
      save: { title: "Guardar para más tarde", body: "Deje el vídeo en Vídeos guardados para otro día." },
    },
    notes: {
      manual: "No necesita ninguna cuenta social. No se publica nada hasta que usted lo publique.",
      auto: "RepGet publica solo en las cuentas que usted elija, cuando usted elija.",
      save: "No se publica nada. El vídeo le espera en Vídeos guardados.",
    },
    progress: "Publicado en {count} de {total}",
    preview: "Vista previa del vídeo",
    making: "Creando su vídeo…",
    makingBody: "Tarda unos minutos. Puede cerrar esta ventana: el vídeo le espera en Vídeos guardados.",
    download: "Descargar vídeo",
    textsTitle: "Texto listo para cada plataforma",
    textsBody: "Cada plataforma tiene su propio texto. Edítelo, cópielo y publíquelo allí.",
    titleLabel: "Título",
    captionLabel: "Texto",
    chars: "{count} / {max} caracteres",
    copyTitle: "Copiar título",
    copyText: "Copiar texto",
    copied: "Copiado",
    copyFailed: "No se pudo copiar. Seleccione el texto y cópielo usted.",
    open: "Abrir {platform}",
    markPosted: "Marcar como publicado",
    unmarkPosted: "Aún no publicado",
    marked: "Marcado como publicado en {platform}.",
    unmarked: "{platform} ya no está marcado como publicado.",
    postedBadge: "Publicado",
    waitVideo: "Descargue el vídeo cuando esté listo, publíquelo y márquelo como publicado.",
    noConnected: "Todavía no hay ninguna cuenta social conectada.",
    connect: "Conectar cuentas",
    manualStill: "Puede publicar manualmente: copie el texto, descargue el vídeo y publíquelo usted mismo.",
    whenReady: "La publicación automática se abre cuando el vídeo está listo. Puede cerrar esta ventana: el vídeo le espera en Vídeos guardados.",
    autoText: "RepGet publica el texto de la idea, adaptado a cada plataforma.",
    saveBody: "El vídeo queda en Vídeos guardados. Publíquelo cuando quiera, usted mismo o automáticamente.",
    save: "Guardar para más tarde",
    saved: "Guardado en Vídeos guardados.",
    carousel: {
      manual: "Copie el texto, descargue las diapositivas y publíquelas usted mismo.",
      save: "Deje el carrusel en Vídeos guardados para otro día.",
      saveNote: "No se publica nada. El carrusel le espera en Vídeos guardados.",
      preview: "Vista previa del carrusel",
      making: "Creando su carrusel…",
      makingBody: "Tarda unos minutos. Puede cerrar esta ventana: el carrusel le espera en Vídeos guardados.",
      download: "Descargar diapositivas",
      waitVideo: "Descargue las diapositivas cuando estén listas, publíquelas y marque el carrusel como publicado.",
      manualStill: "Puede publicar manualmente: copie el texto, descargue las diapositivas y publíquelas usted mismo.",
      whenReady: "La publicación automática se abre cuando el carrusel está listo. Puede cerrar esta ventana: el carrusel le espera en Vídeos guardados.",
      saveBody: "El carrusel queda en Vídeos guardados. Publíquelo cuando quiera, usted mismo o automáticamente.",
    },
  },
  saved: {
    emptyTitle: "Aún no hay vídeos guardados",
    emptyBody: "Apruebe una idea en Ideas de hoy: el vídeo se crea y le espera aquí hasta que lo publique.",
    ready: "Listo para publicar",
  },
  posted: { manual: "publicado por usted", publish: "Publicar" },
  errors: {
    not_ready: "El vídeo todavía se está creando. Márquelo como publicado cuando esté listo.",
    extra_used_up: "Ya ha usado los 3 lotes extra de ideas de hoy. Mañana por la mañana llegan más.",
  },
  library: VIDEO_LIBRARY_COPY.es,
};

const fr: FlowCopy = {
  deck: {
    filterAll: "Tous les types de contenu",
    tags: { viral: "Idée virale", educational: "Idée pédagogique", authority: "Idée d’expertise", promotional: "Idée promotionnelle" },
    approve: "Approuver · {price}",
    trialFree: "gratuit ({left} sur {total} restants)",
    skipLabel: "Ignorer cette idée",
    skipped: "Idée ignorée",
    showDetails: "Détails de l’idée",
    hideDetails: "Masquer les détails",
    hint: "← → parcourent les idées. Approuver crée la vidéo et ouvre la publication.",
    hintCarousel: "← → parcourent les idées. Approuver crée le carrousel et ouvre la publication.",
  },
  ideas: {
    left: "{price} par lot · {left} sur {total} restants aujourd’hui",
    note: "Chaque lot ajoute 10 idées. Vos 20 idées du jour restent gratuites.",
    short: "Un lot coûte {price} ; vous avez {available}.",
    buy: "Acheter des crédits",
    earn: "Gagner des crédits",
    usedUp: "Vous avez utilisé les 3 lots supplémentaires du jour. D’autres idées arrivent demain matin.",
  },
  popup: {
    eyebrow: "Contenu social",
    title: "Vérifier et publier",
    close: "Fermer",
    step: "Votre prochaine étape",
    question: "Comment souhaitez-vous publier ?",
    modes: {
      manual: { title: "Publication manuelle", body: "Copiez le texte, téléchargez la vidéo et publiez-la vous-même." },
      auto: { title: "Publication automatique", body: "Publiez via vos comptes sociaux connectés." },
      save: { title: "Enregistrer pour plus tard", body: "Gardez la vidéo dans Vidéos enregistrées pour un autre jour." },
    },
    notes: {
      manual: "Aucun compte social n’est nécessaire. Rien n’est publié tant que vous ne le publiez pas vous-même.",
      auto: "RepGet publie uniquement sur les comptes que vous choisissez, quand vous le choisissez.",
      save: "Rien n’est publié. La vidéo vous attend dans Vidéos enregistrées.",
    },
    progress: "Publiée sur {count} sur {total}",
    preview: "Aperçu de la vidéo",
    making: "Création de votre vidéo…",
    makingBody: "Cela prend quelques minutes. Vous pouvez fermer cette fenêtre : la vidéo vous attend dans Vidéos enregistrées.",
    download: "Télécharger la vidéo",
    textsTitle: "Texte prêt pour chaque plateforme",
    textsBody: "Chaque plateforme a son propre texte. Modifiez-le, copiez-le, puis publiez-le.",
    titleLabel: "Titre",
    captionLabel: "Texte",
    chars: "{count} / {max} caractères",
    copyTitle: "Copier le titre",
    copyText: "Copier le texte",
    copied: "Copié",
    copyFailed: "Impossible de copier. Sélectionnez le texte et copiez-le vous-même.",
    open: "Ouvrir {platform}",
    markPosted: "Marquer comme publiée",
    unmarkPosted: "Pas encore publiée",
    marked: "Marquée comme publiée sur {platform}.",
    unmarked: "{platform} n’est plus marquée comme publiée.",
    postedBadge: "Publiée",
    waitVideo: "Téléchargez la vidéo une fois prête, publiez-la, puis marquez-la comme publiée.",
    noConnected: "Aucun compte social n’est encore connecté.",
    connect: "Connecter des comptes",
    manualStill: "Vous pouvez toujours publier manuellement : copiez le texte, téléchargez la vidéo et publiez-la vous-même.",
    whenReady: "La publication automatique s’ouvre une fois la vidéo prête. Vous pouvez fermer cette fenêtre : la vidéo vous attend dans Vidéos enregistrées.",
    autoText: "RepGet publie le texte de l’idée, adapté à chaque plateforme.",
    saveBody: "La vidéo reste dans Vidéos enregistrées. Publiez-la quand vous voulez, vous-même ou automatiquement.",
    save: "Enregistrer pour plus tard",
    saved: "Enregistrée dans Vidéos enregistrées.",
    carousel: {
      manual: "Copiez le texte, téléchargez les diapositives et publiez-les vous-même.",
      save: "Gardez le carrousel dans Vidéos enregistrées pour un autre jour.",
      saveNote: "Rien n’est publié. Le carrousel vous attend dans Vidéos enregistrées.",
      preview: "Aperçu du carrousel",
      making: "Création de votre carrousel…",
      makingBody: "Cela prend quelques minutes. Vous pouvez fermer cette fenêtre : le carrousel vous attend dans Vidéos enregistrées.",
      download: "Télécharger les diapositives",
      waitVideo: "Téléchargez les diapositives une fois prêtes, publiez-les, puis marquez le carrousel comme publié.",
      manualStill: "Vous pouvez toujours publier manuellement : copiez le texte, téléchargez les diapositives et publiez-les vous-même.",
      whenReady: "La publication automatique s’ouvre une fois le carrousel prêt. Vous pouvez fermer cette fenêtre : le carrousel vous attend dans Vidéos enregistrées.",
      saveBody: "Le carrousel reste dans Vidéos enregistrées. Publiez-le quand vous voulez, vous-même ou automatiquement.",
    },
  },
  saved: {
    emptyTitle: "Pas encore de vidéos enregistrées",
    emptyBody: "Approuvez une idée dans Idées du jour : la vidéo est créée et vous attend ici jusqu’à sa publication.",
    ready: "Prête à publier",
  },
  posted: { manual: "publiée par vous", publish: "Publier" },
  errors: {
    not_ready: "La vidéo est encore en cours de création. Marquez-la comme publiée une fois prête.",
    extra_used_up: "Vous avez utilisé les 3 lots d’idées supplémentaires du jour. D’autres arrivent demain matin.",
  },
  library: VIDEO_LIBRARY_COPY.fr,
};

const it: FlowCopy = {
  deck: {
    filterAll: "Tutti i tipi di contenuto",
    tags: { viral: "Idea virale", educational: "Idea educativa", authority: "Idea di autorevolezza", promotional: "Idea promozionale" },
    approve: "Approva · {price}",
    trialFree: "gratis (ne restano {left} di {total})",
    skipLabel: "Salta questa idea",
    skipped: "Idea saltata",
    showDetails: "Dettagli dell’idea",
    hideDetails: "Nascondi dettagli",
    hint: "← → scorrono le idee. Approva crea il video e apre la pubblicazione.",
    hintCarousel: "← → scorrono le idee. Approva crea il carosello e apre la pubblicazione.",
  },
  ideas: {
    left: "{price} a gruppo · ne restano {left} di {total} oggi",
    note: "Ogni gruppo aggiunge 10 idee. Le sue 20 idee giornaliere restano gratuite.",
    short: "Un gruppo costa {price}; lei ne ha {available}.",
    buy: "Acquista crediti",
    earn: "Guadagna crediti",
    usedUp: "Ha già usato i 3 gruppi extra di oggi. Altre idee arrivano domani mattina.",
  },
  popup: {
    eyebrow: "Contenuti social",
    title: "Controlla e pubblica",
    close: "Chiudi",
    step: "Il prossimo passo",
    question: "Come desidera pubblicare?",
    modes: {
      manual: { title: "Pubblicazione manuale", body: "Copi il testo, scarichi il video e lo pubblichi lei." },
      auto: { title: "Pubblicazione automatica", body: "Pubblichi tramite i suoi account social collegati." },
      save: { title: "Salva per dopo", body: "Tenga il video in Video salvati per un altro giorno." },
    },
    notes: {
      manual: "Non serve alcun account social. Nulla viene pubblicato finché non lo pubblica lei.",
      auto: "RepGet pubblica solo sugli account che sceglie, quando lo sceglie.",
      save: "Nulla viene pubblicato. Il video la aspetta in Video salvati.",
    },
    progress: "Pubblicato su {count} di {total}",
    preview: "Anteprima del video",
    making: "Creazione del video…",
    makingBody: "Ci vogliono alcuni minuti. Può chiudere questa finestra: il video la aspetta in Video salvati.",
    download: "Scarica il video",
    textsTitle: "Testo pronto per ogni piattaforma",
    textsBody: "Ogni piattaforma ha il proprio testo. Lo modifichi, lo copi e lo pubblichi lì.",
    titleLabel: "Titolo",
    captionLabel: "Testo",
    chars: "{count} / {max} caratteri",
    copyTitle: "Copia titolo",
    copyText: "Copia testo",
    copied: "Copiato",
    copyFailed: "Impossibile copiare. Selezioni il testo e lo copi lei.",
    open: "Apri {platform}",
    markPosted: "Segna come pubblicato",
    unmarkPosted: "Non ancora pubblicato",
    marked: "Segnato come pubblicato su {platform}.",
    unmarked: "{platform} non è più segnato come pubblicato.",
    postedBadge: "Pubblicato",
    waitVideo: "Scarichi il video quando è pronto, lo pubblichi e poi lo segni come pubblicato.",
    noConnected: "Nessun account social è ancora collegato.",
    connect: "Collega account",
    manualStill: "Può comunque pubblicare manualmente: copi il testo, scarichi il video e lo pubblichi lei.",
    whenReady: "La pubblicazione automatica si apre quando il video è pronto. Può chiudere questa finestra: il video la aspetta in Video salvati.",
    autoText: "RepGet pubblica il testo dell’idea, adattato a ogni piattaforma.",
    saveBody: "Il video resta in Video salvati. Lo pubblichi quando vuole, da sé o automaticamente.",
    save: "Salva per dopo",
    saved: "Salvato in Video salvati.",
    carousel: {
      manual: "Copi il testo, scarichi le slide e le pubblichi lei.",
      save: "Tenga il carosello in Video salvati per un altro giorno.",
      saveNote: "Nulla viene pubblicato. Il carosello la aspetta in Video salvati.",
      preview: "Anteprima del carosello",
      making: "Creazione del carosello…",
      makingBody: "Ci vogliono alcuni minuti. Può chiudere questa finestra: il carosello la aspetta in Video salvati.",
      download: "Scarica le slide",
      waitVideo: "Scarichi le slide quando sono pronte, le pubblichi e poi segni il carosello come pubblicato.",
      manualStill: "Può comunque pubblicare manualmente: copi il testo, scarichi le slide e le pubblichi lei.",
      whenReady: "La pubblicazione automatica si apre quando il carosello è pronto. Può chiudere questa finestra: il carosello la aspetta in Video salvati.",
      saveBody: "Il carosello resta in Video salvati. Lo pubblichi quando vuole, da sé o automaticamente.",
    },
  },
  saved: {
    emptyTitle: "Ancora nessun video salvato",
    emptyBody: "Approvi un’idea in Idee di oggi: il video viene creato e la aspetta qui finché non lo pubblica.",
    ready: "Pronto da pubblicare",
  },
  posted: { manual: "pubblicato da lei", publish: "Pubblica" },
  errors: {
    not_ready: "Il video è ancora in creazione. Lo segni come pubblicato quando è pronto.",
    extra_used_up: "Ha già usato i 3 gruppi extra di idee di oggi. Altre arrivano domani mattina.",
  },
  library: VIDEO_LIBRARY_COPY.it,
};

const de: FlowCopy = {
  deck: {
    filterAll: "Alle Inhaltsarten",
    tags: { viral: "Virale Idee", educational: "Lehrreiche Idee", authority: "Expertise-Idee", promotional: "Werbe-Idee" },
    approve: "Genehmigen · {price}",
    trialFree: "kostenlos (noch {left} von {total})",
    skipLabel: "Diese Idee überspringen",
    skipped: "Idee übersprungen",
    showDetails: "Details zur Idee",
    hideDetails: "Details ausblenden",
    hint: "← → blättern durch die Ideen. Genehmigen erstellt das Video und öffnet die Veröffentlichung.",
    hintCarousel: "← → blättern durch die Ideen. Genehmigen erstellt das Karussell und öffnet die Veröffentlichung.",
  },
  ideas: {
    left: "{price} pro Paket · noch {left} von {total} heute",
    note: "Jedes Paket fügt 10 Ideen hinzu. Ihre 20 täglichen Ideen bleiben kostenlos.",
    short: "Ein Paket kostet {price}; Sie haben {available}.",
    buy: "Credits kaufen",
    earn: "Credits verdienen",
    usedUp: "Sie haben die 3 zusätzlichen Pakete von heute genutzt. Neue Ideen kommen morgen früh.",
  },
  popup: {
    eyebrow: "Social Content",
    title: "Prüfen und veröffentlichen",
    close: "Schließen",
    step: "Ihr nächster Schritt",
    question: "Wie möchten Sie veröffentlichen?",
    modes: {
      manual: { title: "Manuell veröffentlichen", body: "Text kopieren, Video herunterladen und selbst posten." },
      auto: { title: "Automatisch veröffentlichen", body: "Über Ihre verbundenen Social-Media-Konten veröffentlichen." },
      save: { title: "Für später speichern", body: "Das Video für einen anderen Tag unter Gespeicherte Videos behalten." },
    },
    notes: {
      manual: "Kein Social-Media-Konto nötig. Nichts wird veröffentlicht, bis Sie es selbst posten.",
      auto: "RepGet veröffentlicht nur auf den Konten, die Sie wählen, und wann Sie es wählen.",
      save: "Nichts wird veröffentlicht. Das Video wartet unter Gespeicherte Videos.",
    },
    progress: "Gepostet auf {count} von {total}",
    preview: "Videovorschau",
    making: "Ihr Video wird erstellt…",
    makingBody: "Das dauert einige Minuten. Sie können dieses Fenster schließen: Das Video wartet unter Gespeicherte Videos.",
    download: "Video herunterladen",
    textsTitle: "Text für jede Plattform",
    textsBody: "Jede Plattform hat ihren eigenen Text. Bearbeiten, kopieren und dort posten.",
    titleLabel: "Titel",
    captionLabel: "Text",
    chars: "{count} / {max} Zeichen",
    copyTitle: "Titel kopieren",
    copyText: "Text kopieren",
    copied: "Kopiert",
    copyFailed: "Kopieren nicht möglich. Markieren Sie den Text und kopieren Sie ihn selbst.",
    open: "{platform} öffnen",
    markPosted: "Als gepostet markieren",
    unmarkPosted: "Noch nicht gepostet",
    marked: "Auf {platform} als gepostet markiert.",
    unmarked: "{platform} ist nicht mehr als gepostet markiert.",
    postedBadge: "Gepostet",
    waitVideo: "Laden Sie das Video herunter, sobald es fertig ist, posten Sie es und markieren Sie es als gepostet.",
    noConnected: "Noch ist kein Social-Media-Konto verbunden.",
    connect: "Konten verbinden",
    manualStill: "Sie können trotzdem manuell veröffentlichen: Text kopieren, Video herunterladen und selbst posten.",
    whenReady: "Die automatische Veröffentlichung öffnet sich, sobald das Video fertig ist. Sie können dieses Fenster schließen: Das Video wartet unter Gespeicherte Videos.",
    autoText: "RepGet postet den Text der Idee, angepasst an jede Plattform.",
    saveBody: "Das Video bleibt unter Gespeicherte Videos. Veröffentlichen Sie es, wann Sie möchten, selbst oder automatisch.",
    save: "Für später speichern",
    saved: "Unter Gespeicherte Videos gespeichert.",
    carousel: {
      manual: "Text kopieren, Folien herunterladen und selbst posten.",
      save: "Das Karussell für einen anderen Tag unter Gespeicherte Videos behalten.",
      saveNote: "Nichts wird veröffentlicht. Das Karussell wartet unter Gespeicherte Videos.",
      preview: "Karussell-Vorschau",
      making: "Ihr Karussell wird erstellt…",
      makingBody: "Das dauert einige Minuten. Sie können dieses Fenster schließen: Das Karussell wartet unter Gespeicherte Videos.",
      download: "Folien herunterladen",
      waitVideo: "Laden Sie die Folien herunter, sobald sie fertig sind, posten Sie sie und markieren Sie das Karussell als gepostet.",
      manualStill: "Sie können trotzdem manuell veröffentlichen: Text kopieren, Folien herunterladen und selbst posten.",
      whenReady: "Die automatische Veröffentlichung öffnet sich, sobald das Karussell fertig ist. Sie können dieses Fenster schließen: Das Karussell wartet unter Gespeicherte Videos.",
      saveBody: "Das Karussell bleibt unter Gespeicherte Videos. Veröffentlichen Sie es, wann Sie möchten, selbst oder automatisch.",
    },
  },
  saved: {
    emptyTitle: "Noch keine gespeicherten Videos",
    emptyBody: "Genehmigen Sie eine Idee unter Ideen von heute: Das Video wird erstellt und wartet hier, bis Sie es veröffentlichen.",
    ready: "Bereit zum Veröffentlichen",
  },
  posted: { manual: "von Ihnen gepostet", publish: "Veröffentlichen" },
  errors: {
    not_ready: "Das Video wird noch erstellt. Markieren Sie es als gepostet, sobald es fertig ist.",
    extra_used_up: "Sie haben die 3 zusätzlichen Ideenpakete von heute genutzt. Neue kommen morgen früh.",
  },
  library: VIDEO_LIBRARY_COPY.de,
};

/** One full translation per locale; keep the five objects in step when a key changes. */
export const VIDEO_FLOW_COPY: Record<Locale, FlowCopy> = { en, es, fr, it, de };

/**
 * The review window's words for an idea of this format: a carousel's own
 * where they differ (CarouselPopup), the video's everywhere else.
 */
export function popupCopy(popup: FlowCopy["popup"], format: string | null | undefined): FlowCopy["popup"] {
  if (format !== "carousel") return popup;
  const c = popup.carousel;
  return {
    ...popup,
    modes: { ...popup.modes, manual: { ...popup.modes.manual, body: c.manual }, save: { ...popup.modes.save, body: c.save } },
    notes: { ...popup.notes, save: c.saveNote },
    preview: c.preview,
    making: c.making,
    makingBody: c.makingBody,
    download: c.download,
    waitVideo: c.waitVideo,
    manualStill: c.manualStill,
    whenReady: c.whenReady,
    saveBody: c.saveBody,
  };
}
