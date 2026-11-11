import type { Locale } from "@/lib/i18n/config";

/**
 * The words of the homepage's Customer stories section and of a blog post's
 * comments and upvotes (client, 2026-11-11; RepGet_Customer_Stories_
 * Corrected_Elementor.html and repget_compact_comments_upvote_orange.html).
 * English is the designs' text; the others are translations, in the formal
 * register. Here rather than in messages.ts, which must never reach the
 * browser: the comments are a client component, and only the reader's
 * language is passed to it.
 */

export type CustomerStoriesCopy = {
  eyebrow: string;
  heading: string;
  intro: string;
  viewAll: string;
  /** The crown badge on each story's logo. */
  featured: string;
  /** "<business> · Customer story". */
  byline: string;
  /** "{name}" is the business. */
  logoLabel: string;
  /** The arrow link's label; "{name}" is the business. */
  openStory: string;
};

export const CUSTOMER_STORIES_COPY: Record<Locale, CustomerStoriesCopy> = {
  en: {
    eyebrow: "CUSTOMER STORIES",
    heading: "Meet the brands building with RepGet",
    intro: "Discover real websites and follow their progress with RepGet.",
    viewAll: "View all customer stories",
    featured: "Featured story",
    byline: "Customer story",
    logoLabel: "{name} logo",
    openStory: "Open the customer story for {name}",
  },
  es: {
    eyebrow: "CASOS DE CLIENTES",
    heading: "Conozca las marcas que crecen con RepGet",
    intro: "Descubra sitios web reales y siga su progreso con RepGet.",
    viewAll: "Ver todos los casos de clientes",
    featured: "Caso destacado",
    byline: "Caso de cliente",
    logoLabel: "Logotipo de {name}",
    openStory: "Abrir el caso de cliente de {name}",
  },
  fr: {
    eyebrow: "HISTOIRES DE CLIENTS",
    heading: "Découvrez les marques qui se développent avec RepGet",
    intro: "Découvrez de vrais sites web et suivez leurs progrès avec RepGet.",
    viewAll: "Voir toutes les histoires de clients",
    featured: "Histoire à la une",
    byline: "Histoire de client",
    logoLabel: "Logo de {name}",
    openStory: "Ouvrir l’histoire de client de {name}",
  },
  it: {
    eyebrow: "STORIE DEI CLIENTI",
    heading: "Scopra i brand che crescono con RepGet",
    intro: "Scopra siti web reali e segua i loro progressi con RepGet.",
    viewAll: "Vedi tutte le storie dei clienti",
    featured: "Storia in evidenza",
    byline: "Storia di un cliente",
    logoLabel: "Logo di {name}",
    openStory: "Apra la storia del cliente {name}",
  },
  de: {
    eyebrow: "KUNDENGESCHICHTEN",
    heading: "Lernen Sie die Marken kennen, die mit RepGet wachsen",
    intro: "Entdecken Sie echte Websites und verfolgen Sie ihre Fortschritte mit RepGet.",
    viewAll: "Alle Kundengeschichten ansehen",
    featured: "Empfohlene Geschichte",
    byline: "Kundengeschichte",
    logoLabel: "Logo von {name}",
    openStory: "Kundengeschichte von {name} öffnen",
  },
};

export type CommentsCopy = {
  title: string;
  /** "{n}" is how many comments are shown. */
  shown: string;
  subtitle: string;
  gateTitle: string;
  /** "New to RepGet? <link>Create a free account</link> to join the conversation." */
  gateBefore: string;
  gateLink: string;
  gateAfter: string;
  upvote: string;
  upvoted: string;
  upvotePost: string;
  upvoteComment: string;
  removeUpvote: string;
  signIn: string;
  empty: string;
  /** The compose box's label (for screen readers) and placeholder. */
  label: string;
  placeholder: string;
  post: string;
  posting: string;
  delete: string;
  confirmDelete: string;
  cancel: string;
  /** A commenter whose account has no name. */
  member: string;
  /** "{n}" characters used of "{max}". */
  counter: string;
  errors: { empty: string; tooLong: string; rateLimited: string; notFound: string; failed: string };
};

export const COMMENTS_COPY: Record<Locale, CommentsCopy> = {
  en: {
    title: "Comments",
    shown: "{n} shown",
    subtitle: "Share your thoughts about this article.",
    gateTitle: "Sign in to leave a comment.",
    gateBefore: "New to RepGet? ",
    gateLink: "Create a free account",
    gateAfter: " to join the conversation.",
    upvote: "Upvote",
    upvoted: "Upvoted",
    upvotePost: "Upvote this article",
    upvoteComment: "Upvote this comment",
    removeUpvote: "Remove upvote",
    signIn: "Sign in",
    empty: "No comments yet. Be the first to leave one.",
    label: "Your comment",
    placeholder: "Write a comment…",
    post: "Post comment",
    posting: "Posting…",
    delete: "Delete",
    confirmDelete: "Delete this comment?",
    cancel: "Cancel",
    member: "RepGet member",
    counter: "{n}/{max}",
    errors: {
      empty: "Write a comment first.",
      tooLong: "Comments can be up to 750 characters.",
      rateLimited: "You have posted several comments in a short time. Please wait a few minutes before posting again.",
      notFound: "Comments are closed on this article.",
      failed: "Something went wrong. Please try again.",
    },
  },
  es: {
    title: "Comentarios",
    shown: "{n} visibles",
    subtitle: "Comparta su opinión sobre este artículo.",
    gateTitle: "Inicie sesión para dejar un comentario.",
    gateBefore: "¿Es nuevo en RepGet? ",
    gateLink: "Cree una cuenta gratuita",
    gateAfter: " para unirse a la conversación.",
    upvote: "Votar",
    upvoted: "Votado",
    upvotePost: "Votar este artículo",
    upvoteComment: "Votar este comentario",
    removeUpvote: "Quitar el voto",
    signIn: "Iniciar sesión",
    empty: "Todavía no hay comentarios. Sea el primero en dejar uno.",
    label: "Su comentario",
    placeholder: "Escriba un comentario…",
    post: "Publicar comentario",
    posting: "Publicando…",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar este comentario?",
    cancel: "Cancelar",
    member: "Miembro de RepGet",
    counter: "{n}/{max}",
    errors: {
      empty: "Escriba primero un comentario.",
      tooLong: "Los comentarios pueden tener hasta 750 caracteres.",
      rateLimited: "Ha publicado varios comentarios en poco tiempo. Espere unos minutos antes de volver a publicar.",
      notFound: "Los comentarios están cerrados en este artículo.",
      failed: "Algo ha salido mal. Inténtelo de nuevo.",
    },
  },
  fr: {
    title: "Commentaires",
    shown: "{n} affichés",
    subtitle: "Donnez votre avis sur cet article.",
    gateTitle: "Connectez-vous pour laisser un commentaire.",
    gateBefore: "Nouveau sur RepGet ? ",
    gateLink: "Créez un compte gratuit",
    gateAfter: " pour rejoindre la conversation.",
    upvote: "Voter",
    upvoted: "Voté",
    upvotePost: "Voter pour cet article",
    upvoteComment: "Voter pour ce commentaire",
    removeUpvote: "Retirer le vote",
    signIn: "Se connecter",
    empty: "Aucun commentaire pour l’instant. Soyez le premier à en laisser un.",
    label: "Votre commentaire",
    placeholder: "Écrivez un commentaire…",
    post: "Publier le commentaire",
    posting: "Publication…",
    delete: "Supprimer",
    confirmDelete: "Supprimer ce commentaire ?",
    cancel: "Annuler",
    member: "Membre RepGet",
    counter: "{n}/{max}",
    errors: {
      empty: "Écrivez d’abord un commentaire.",
      tooLong: "Les commentaires peuvent compter jusqu’à 750 caractères.",
      rateLimited: "Vous avez publié plusieurs commentaires en peu de temps. Veuillez patienter quelques minutes avant de publier à nouveau.",
      notFound: "Les commentaires sont fermés pour cet article.",
      failed: "Une erreur s’est produite. Veuillez réessayer.",
    },
  },
  it: {
    title: "Commenti",
    shown: "{n} visualizzati",
    subtitle: "Condivida la sua opinione su questo articolo.",
    gateTitle: "Acceda per lasciare un commento.",
    gateBefore: "Nuovo su RepGet? ",
    gateLink: "Crei un account gratuito",
    gateAfter: " per partecipare alla conversazione.",
    upvote: "Vota",
    upvoted: "Votato",
    upvotePost: "Vota questo articolo",
    upvoteComment: "Vota questo commento",
    removeUpvote: "Rimuova il voto",
    signIn: "Accedi",
    empty: "Ancora nessun commento. Sia il primo a lasciarne uno.",
    label: "Il suo commento",
    placeholder: "Scriva un commento…",
    post: "Pubblica commento",
    posting: "Pubblicazione…",
    delete: "Elimina",
    confirmDelete: "Eliminare questo commento?",
    cancel: "Annulla",
    member: "Membro di RepGet",
    counter: "{n}/{max}",
    errors: {
      empty: "Scriva prima un commento.",
      tooLong: "I commenti possono contenere fino a 750 caratteri.",
      rateLimited: "Ha pubblicato diversi commenti in poco tempo. Attenda qualche minuto prima di pubblicarne un altro.",
      notFound: "I commenti sono chiusi per questo articolo.",
      failed: "Qualcosa è andato storto. Riprovi.",
    },
  },
  de: {
    title: "Kommentare",
    shown: "{n} angezeigt",
    subtitle: "Teilen Sie Ihre Gedanken zu diesem Artikel.",
    gateTitle: "Melden Sie sich an, um einen Kommentar zu hinterlassen.",
    gateBefore: "Neu bei RepGet? ",
    gateLink: "Erstellen Sie ein kostenloses Konto",
    gateAfter: ", um mitzudiskutieren.",
    upvote: "Empfehlen",
    upvoted: "Empfohlen",
    upvotePost: "Diesen Artikel empfehlen",
    upvoteComment: "Diesen Kommentar empfehlen",
    removeUpvote: "Empfehlung zurücknehmen",
    signIn: "Anmelden",
    empty: "Noch keine Kommentare. Schreiben Sie den ersten.",
    label: "Ihr Kommentar",
    placeholder: "Kommentar schreiben…",
    post: "Kommentar veröffentlichen",
    posting: "Wird veröffentlicht…",
    delete: "Löschen",
    confirmDelete: "Diesen Kommentar löschen?",
    cancel: "Abbrechen",
    member: "RepGet-Mitglied",
    counter: "{n}/{max}",
    errors: {
      empty: "Schreiben Sie zuerst einen Kommentar.",
      tooLong: "Kommentare dürfen bis zu 750 Zeichen lang sein.",
      rateLimited: "Sie haben in kurzer Zeit mehrere Kommentare veröffentlicht. Bitte warten Sie einige Minuten, bevor Sie erneut posten.",
      notFound: "Die Kommentare zu diesem Artikel sind geschlossen.",
      failed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    },
  },
};
