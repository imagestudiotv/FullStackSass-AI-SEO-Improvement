import type { DiscoverStyle } from "@/lib/earn/discover-rules";
import type { Locale } from "@/lib/i18n/config";

/**
 * Earn Credits' "Discover & earn" card and its comment dialog (client ticket,
 * 2026-11-11, repget-earn-credits-multiple-businesses.html). English is the
 * design's text; the others use the app's formal address. {placeholders} are
 * filled with format() (lib/i18n/format.ts); the goal's figures are always
 * placeholders, read from DISCOVER_GOAL.
 */
export type EarnDiscoverCopy = {
  sectionLabel: string;
  /** "BUSINESS {n} OF {total}" */
  counter: string;
  visitSite: string;
  /** The featured image's alt: "Featured image for {name}". */
  photoAlt: string;

  eyebrow: string;
  title: string;
  body: string;
  upvote: string;
  upvoted: string;
  comment: string;
  commented: string;
  skip: string;
  feedbackUpvoted: string;
  feedbackCommented: string;
  aiNote: string;

  /** "{upvotes} upvotes + {comments} comments =" */
  missionLead: string;
  /** "{bonus} bonus credits" */
  missionReward: string;
  upvotesLabel: string;
  commentsLabel: string;
  upvotesProgress: string;
  commentsProgress: string;
  noteOpen: string;
  noteReady: string;
  noteClaimed: string;
  claim: string;

  queueTitle: string;
  queueHint: string;
  previous: string;
  next: string;
  backToFirst: string;
  railLabel: string;
  tileVote: string;
  tileComment: string;
  tileSkipped: string;

  toastSkipped: string;
  toastUpvoted: string;
  toastCommented: string;
  toastBonus: string;
  errors: {
    failed: string;
    not_found: string;
    rate_limited: string;
    not_allowed: string;
    not_reached: string;
    already_claimed: string;
  };

  dialogEyebrow: string;
  /** "Comment on {name}" */
  dialogTitle: string;
  dialogBody: string;
  close: string;
  styleLabel: string;
  styles: Record<DiscoverStyle, string>;
  commentLabel: string;
  draftNote: string;
  drafting: string;
  draftUnavailable: string;
  draftLimit: string;
  draftFailed: string;
  /** "{count} / {max}" */
  counterChars: string;
  confirm: string;
  errShort: string;
  errTooLong: string;
  errLink: string;
  errConfirm: string;
  regenerate: string;
  submit: string;
  submitting: string;
};

const en: EarnDiscoverCopy = {
  sectionLabel: "Discover and earn credits",
  counter: "BUSINESS {n} OF {total}",
  visitSite: "Visit site",
  photoAlt: "Featured image for {name}",

  eyebrow: "Discover & earn",
  title: "Support businesses. Earn credits.",
  body: "Explore businesses, upvote the ones you like and leave thoughtful comments.",
  upvote: "Upvote",
  upvoted: "Upvoted",
  comment: "Comment with AI",
  commented: "Comment sent",
  skip: "Skip this business",
  feedbackUpvoted: "✓ Upvoted",
  feedbackCommented: "✓ Commented",
  aiNote: "AI drafts are editable and require your review before posting.",

  missionLead: "{upvotes} upvotes + {comments} comments =",
  missionReward: "{bonus} bonus credits",
  upvotesLabel: "Upvotes",
  commentsLabel: "Comments",
  upvotesProgress: "Upvotes progress",
  commentsProgress: "Comments progress",
  noteOpen: "Complete both goals to unlock {bonus} bonus credits.",
  noteReady: "Milestones complete! Claim your {bonus} bonus credits.",
  noteClaimed: "{bonus} bonus credits claimed.",
  claim: "Claim {bonus} bonus credits",

  queueTitle: "Explore businesses",
  queueHint: "Choose any business, or use Next to see how it works.",
  previous: "Previous business",
  next: "Next business",
  backToFirst: "Back to first",
  railLabel: "Business preview carousel",
  tileVote: "✓ Vote",
  tileComment: "✓ Comment",
  tileSkipped: "Skipped",

  toastSkipped: "Skipped {name}. Showing the next business.",
  toastUpvoted: "Upvoted {name}. Add a comment or go to the next business.",
  toastCommented: "Comment posted for {name}.",
  toastBonus: "{bonus} bonus credits added to your balance.",
  errors: {
    failed: "Something went wrong. Please try again.",
    not_found: "This business is no longer available.",
    rate_limited: "You have posted several comments in a short time. Please try again a little later.",
    not_allowed: "Earn Credits is for your own workspace.",
    not_reached: "Complete both goals to claim the bonus.",
    already_claimed: "You have already claimed this bonus.",
  },

  dialogEyebrow: "AI-assisted comment",
  dialogTitle: "Comment on {name}",
  dialogBody: "Start with a suggested draft, then edit it to reflect your own observations.",
  close: "Close comment dialog",
  styleLabel: "Draft style",
  styles: { question: "Thoughtful question", insight: "Helpful suggestion", appreciation: "Positive observation" },
  commentLabel: "Your comment",
  draftNote: "AI draft based on this business's story. Make it your own.",
  drafting: "Writing a draft…",
  draftUnavailable: "AI drafts are not available right now. You can write your comment yourself.",
  draftLimit: "You have used today's AI drafts. You can still write your comment yourself.",
  draftFailed: "No draft could be written this time. Try again, or write your own.",
  counterChars: "{count} / {max}",
  confirm: "I have reviewed and edited this comment so it reflects my own opinion.",
  errShort: "Please write at least {min} characters.",
  errTooLong: "Please keep your comment to {max} characters.",
  errLink: "Please avoid links in credited comments.",
  errConfirm: "Please confirm you reviewed the draft.",
  regenerate: "Regenerate draft",
  submit: "Submit comment",
  submitting: "Posting…",
};

const es: EarnDiscoverCopy = {
  sectionLabel: "Descubra y gane créditos",
  counter: "NEGOCIO {n} DE {total}",
  visitSite: "Visitar sitio",
  photoAlt: "Imagen destacada de {name}",

  eyebrow: "Descubra y gane",
  title: "Apoye a negocios. Gane créditos.",
  body: "Explore negocios, vote a favor de los que le gusten y deje comentarios bien pensados.",
  upvote: "Votar a favor",
  upvoted: "Votado",
  comment: "Comentar con IA",
  commented: "Comentario enviado",
  skip: "Omitir este negocio",
  feedbackUpvoted: "✓ Votado",
  feedbackCommented: "✓ Comentado",
  aiNote: "Los borradores de IA se pueden editar y requieren su revisión antes de publicarse.",

  missionLead: "{upvotes} votos + {comments} comentarios =",
  missionReward: "{bonus} créditos de bonificación",
  upvotesLabel: "Votos",
  commentsLabel: "Comentarios",
  upvotesProgress: "Progreso de votos",
  commentsProgress: "Progreso de comentarios",
  noteOpen: "Complete ambos objetivos para desbloquear {bonus} créditos de bonificación.",
  noteReady: "¡Objetivos cumplidos! Reclame sus {bonus} créditos de bonificación.",
  noteClaimed: "{bonus} créditos de bonificación reclamados.",
  claim: "Reclamar {bonus} créditos de bonificación",

  queueTitle: "Explorar negocios",
  queueHint: "Elija cualquier negocio, o use Siguiente para ver cómo funciona.",
  previous: "Negocio anterior",
  next: "Siguiente negocio",
  backToFirst: "Volver al primero",
  railLabel: "Carrusel de negocios",
  tileVote: "✓ Voto",
  tileComment: "✓ Comentario",
  tileSkipped: "Omitido",

  toastSkipped: "Ha omitido {name}. Se muestra el siguiente negocio.",
  toastUpvoted: "Ha votado a favor de {name}. Añada un comentario o pase al siguiente negocio.",
  toastCommented: "Comentario publicado para {name}.",
  toastBonus: "Se han añadido {bonus} créditos de bonificación a su saldo.",
  errors: {
    failed: "Algo ha salido mal. Inténtelo de nuevo.",
    not_found: "Este negocio ya no está disponible.",
    rate_limited: "Ha publicado varios comentarios en poco tiempo. Inténtelo de nuevo un poco más tarde.",
    not_allowed: "Ganar créditos es para su propio espacio de trabajo.",
    not_reached: "Complete ambos objetivos para reclamar la bonificación.",
    already_claimed: "Ya ha reclamado esta bonificación.",
  },

  dialogEyebrow: "Comentario asistido por IA",
  dialogTitle: "Comentar sobre {name}",
  dialogBody: "Empiece con un borrador sugerido y edítelo para que refleje sus propias observaciones.",
  close: "Cerrar el cuadro de comentario",
  styleLabel: "Estilo del borrador",
  styles: { question: "Pregunta reflexiva", insight: "Sugerencia útil", appreciation: "Observación positiva" },
  commentLabel: "Su comentario",
  draftNote: "Borrador de IA basado en la historia de este negocio. Hágalo suyo.",
  drafting: "Redactando un borrador…",
  draftUnavailable: "Los borradores de IA no están disponibles en este momento. Puede escribir su comentario usted mismo.",
  draftLimit: "Ha usado los borradores de IA de hoy. Aún puede escribir su comentario usted mismo.",
  draftFailed: "Esta vez no se pudo redactar un borrador. Inténtelo de nuevo o escriba el suyo.",
  counterChars: "{count} / {max}",
  confirm: "He revisado y editado este comentario para que refleje mi propia opinión.",
  errShort: "Escriba al menos {min} caracteres.",
  errTooLong: "Su comentario no debe superar los {max} caracteres.",
  errLink: "No incluya enlaces en los comentarios que dan créditos.",
  errConfirm: "Confirme que ha revisado el borrador.",
  regenerate: "Generar otro borrador",
  submit: "Enviar comentario",
  submitting: "Publicando…",
};

const fr: EarnDiscoverCopy = {
  sectionLabel: "Découvrir et gagner des crédits",
  counter: "ENTREPRISE {n} SUR {total}",
  visitSite: "Visiter le site",
  photoAlt: "Image à la une de {name}",

  eyebrow: "Découvrir et gagner",
  title: "Soutenez des entreprises. Gagnez des crédits.",
  body: "Découvrez des entreprises, votez pour celles que vous aimez et laissez des commentaires réfléchis.",
  upvote: "Voter pour",
  upvoted: "Vote enregistré",
  comment: "Commenter avec l’IA",
  commented: "Commentaire envoyé",
  skip: "Passer cette entreprise",
  feedbackUpvoted: "✓ Vote enregistré",
  feedbackCommented: "✓ Commenté",
  aiNote: "Les brouillons de l’IA sont modifiables et doivent être relus par vous avant publication.",

  missionLead: "{upvotes} votes + {comments} commentaires =",
  missionReward: "{bonus} crédits bonus",
  upvotesLabel: "Votes",
  commentsLabel: "Commentaires",
  upvotesProgress: "Progression des votes",
  commentsProgress: "Progression des commentaires",
  noteOpen: "Atteignez les deux objectifs pour débloquer {bonus} crédits bonus.",
  noteReady: "Objectifs atteints ! Réclamez vos {bonus} crédits bonus.",
  noteClaimed: "{bonus} crédits bonus réclamés.",
  claim: "Réclamer {bonus} crédits bonus",

  queueTitle: "Découvrir des entreprises",
  queueHint: "Choisissez une entreprise, ou utilisez Suivante pour voir comment cela fonctionne.",
  previous: "Entreprise précédente",
  next: "Entreprise suivante",
  backToFirst: "Revenir à la première",
  railLabel: "Carrousel des entreprises",
  tileVote: "✓ Vote",
  tileComment: "✓ Commentaire",
  tileSkipped: "Passée",

  toastSkipped: "{name} passée. Voici l’entreprise suivante.",
  toastUpvoted: "Vous avez voté pour {name}. Ajoutez un commentaire ou passez à l’entreprise suivante.",
  toastCommented: "Commentaire publié pour {name}.",
  toastBonus: "{bonus} crédits bonus ont été ajoutés à votre solde.",
  errors: {
    failed: "Une erreur s’est produite. Veuillez réessayer.",
    not_found: "Cette entreprise n’est plus disponible.",
    rate_limited: "Vous avez publié plusieurs commentaires en peu de temps. Veuillez réessayer un peu plus tard.",
    not_allowed: "Gagner des crédits concerne votre propre espace de travail.",
    not_reached: "Atteignez les deux objectifs pour réclamer le bonus.",
    already_claimed: "Vous avez déjà réclamé ce bonus.",
  },

  dialogEyebrow: "Commentaire assisté par l’IA",
  dialogTitle: "Commenter {name}",
  dialogBody: "Partez d’un brouillon suggéré, puis modifiez-le pour qu’il reflète vos propres observations.",
  close: "Fermer la fenêtre de commentaire",
  styleLabel: "Style du brouillon",
  styles: { question: "Question réfléchie", insight: "Suggestion utile", appreciation: "Observation positive" },
  commentLabel: "Votre commentaire",
  draftNote: "Brouillon de l’IA fondé sur l’histoire de cette entreprise. Appropriez-le-vous.",
  drafting: "Rédaction d’un brouillon…",
  draftUnavailable: "Les brouillons de l’IA ne sont pas disponibles pour le moment. Vous pouvez rédiger votre commentaire vous-même.",
  draftLimit: "Vous avez utilisé les brouillons de l’IA du jour. Vous pouvez toujours rédiger votre commentaire vous-même.",
  draftFailed: "Aucun brouillon n’a pu être rédigé cette fois. Réessayez, ou rédigez le vôtre.",
  counterChars: "{count} / {max}",
  confirm: "J’ai relu et modifié ce commentaire pour qu’il reflète ma propre opinion.",
  errShort: "Veuillez écrire au moins {min} caractères.",
  errTooLong: "Votre commentaire ne doit pas dépasser {max} caractères.",
  errLink: "Veuillez ne pas mettre de liens dans les commentaires récompensés.",
  errConfirm: "Veuillez confirmer que vous avez relu le brouillon.",
  regenerate: "Générer un autre brouillon",
  submit: "Envoyer le commentaire",
  submitting: "Publication…",
};

const it: EarnDiscoverCopy = {
  sectionLabel: "Scopra e guadagni crediti",
  counter: "ATTIVITÀ {n} DI {total}",
  visitSite: "Visita il sito",
  photoAlt: "Immagine in evidenza di {name}",

  eyebrow: "Scopra e guadagni",
  title: "Sostenga le attività. Guadagni crediti.",
  body: "Esplori le attività, voti quelle che le piacciono e lasci commenti ponderati.",
  upvote: "Vota",
  upvoted: "Votato",
  comment: "Commenta con l’IA",
  commented: "Commento inviato",
  skip: "Salta questa attività",
  feedbackUpvoted: "✓ Votato",
  feedbackCommented: "✓ Commentato",
  aiNote: "Le bozze dell’IA sono modificabili e richiedono la sua revisione prima della pubblicazione.",

  missionLead: "{upvotes} voti + {comments} commenti =",
  missionReward: "{bonus} crediti bonus",
  upvotesLabel: "Voti",
  commentsLabel: "Commenti",
  upvotesProgress: "Avanzamento dei voti",
  commentsProgress: "Avanzamento dei commenti",
  noteOpen: "Completi entrambi gli obiettivi per sbloccare {bonus} crediti bonus.",
  noteReady: "Obiettivi raggiunti! Richieda i suoi {bonus} crediti bonus.",
  noteClaimed: "{bonus} crediti bonus richiesti.",
  claim: "Richiedi {bonus} crediti bonus",

  queueTitle: "Esplora le attività",
  queueHint: "Scelga un’attività qualsiasi, oppure usi Avanti per vedere come funziona.",
  previous: "Attività precedente",
  next: "Attività successiva",
  backToFirst: "Torna alla prima",
  railLabel: "Carosello delle attività",
  tileVote: "✓ Voto",
  tileComment: "✓ Commento",
  tileSkipped: "Saltata",

  toastSkipped: "{name} saltata. Ecco l’attività successiva.",
  toastUpvoted: "Ha votato {name}. Aggiunga un commento o passi all’attività successiva.",
  toastCommented: "Commento pubblicato per {name}.",
  toastBonus: "{bonus} crediti bonus aggiunti al suo saldo.",
  errors: {
    failed: "Qualcosa non ha funzionato. Riprovi.",
    not_found: "Questa attività non è più disponibile.",
    rate_limited: "Ha pubblicato diversi commenti in poco tempo. Riprovi tra un po’.",
    not_allowed: "Guadagna crediti è per il suo spazio di lavoro.",
    not_reached: "Completi entrambi gli obiettivi per richiedere il bonus.",
    already_claimed: "Ha già richiesto questo bonus.",
  },

  dialogEyebrow: "Commento assistito dall’IA",
  dialogTitle: "Commenta {name}",
  dialogBody: "Parta da una bozza suggerita, poi la modifichi perché rifletta le sue osservazioni.",
  close: "Chiudi la finestra del commento",
  styleLabel: "Stile della bozza",
  styles: { question: "Domanda ponderata", insight: "Suggerimento utile", appreciation: "Osservazione positiva" },
  commentLabel: "Il suo commento",
  draftNote: "Bozza dell’IA basata sulla storia di questa attività. La renda sua.",
  drafting: "Scrittura della bozza…",
  draftUnavailable: "Le bozze dell’IA non sono disponibili al momento. Può scrivere il commento da sé.",
  draftLimit: "Ha usato le bozze dell’IA di oggi. Può comunque scrivere il commento da sé.",
  draftFailed: "Questa volta non è stato possibile scrivere una bozza. Riprovi, oppure scriva la sua.",
  counterChars: "{count} / {max}",
  confirm: "Ho rivisto e modificato questo commento perché rifletta la mia opinione.",
  errShort: "Scriva almeno {min} caratteri.",
  errTooLong: "Il commento non deve superare {max} caratteri.",
  errLink: "Eviti i link nei commenti che danno crediti.",
  errConfirm: "Confermi di aver rivisto la bozza.",
  regenerate: "Rigenera la bozza",
  submit: "Invia il commento",
  submitting: "Pubblicazione…",
};

const de: EarnDiscoverCopy = {
  sectionLabel: "Entdecken und Credits verdienen",
  counter: "UNTERNEHMEN {n} VON {total}",
  visitSite: "Website besuchen",
  photoAlt: "Beitragsbild von {name}",

  eyebrow: "Entdecken & verdienen",
  title: "Unterstützen Sie Unternehmen. Verdienen Sie Credits.",
  body: "Entdecken Sie Unternehmen, stimmen Sie für die, die Ihnen gefallen, und hinterlassen Sie durchdachte Kommentare.",
  upvote: "Dafür stimmen",
  upvoted: "Abgestimmt",
  comment: "Mit KI kommentieren",
  commented: "Kommentar gesendet",
  skip: "Dieses Unternehmen überspringen",
  feedbackUpvoted: "✓ Abgestimmt",
  feedbackCommented: "✓ Kommentiert",
  aiNote: "KI-Entwürfe sind bearbeitbar und müssen vor der Veröffentlichung von Ihnen geprüft werden.",

  missionLead: "{upvotes} Stimmen + {comments} Kommentare =",
  missionReward: "{bonus} Bonus-Credits",
  upvotesLabel: "Stimmen",
  commentsLabel: "Kommentare",
  upvotesProgress: "Fortschritt der Stimmen",
  commentsProgress: "Fortschritt der Kommentare",
  noteOpen: "Erreichen Sie beide Ziele, um {bonus} Bonus-Credits freizuschalten.",
  noteReady: "Ziele erreicht! Fordern Sie Ihre {bonus} Bonus-Credits an.",
  noteClaimed: "{bonus} Bonus-Credits erhalten.",
  claim: "{bonus} Bonus-Credits anfordern",

  queueTitle: "Unternehmen entdecken",
  queueHint: "Wählen Sie ein beliebiges Unternehmen, oder sehen Sie mit „Weiter“, wie es funktioniert.",
  previous: "Vorheriges Unternehmen",
  next: "Nächstes Unternehmen",
  backToFirst: "Zurück zum ersten",
  railLabel: "Unternehmen im Überblick",
  tileVote: "✓ Stimme",
  tileComment: "✓ Kommentar",
  tileSkipped: "Übersprungen",

  toastSkipped: "{name} übersprungen. Das nächste Unternehmen wird angezeigt.",
  toastUpvoted: "Sie haben für {name} gestimmt. Fügen Sie einen Kommentar hinzu oder gehen Sie zum nächsten Unternehmen.",
  toastCommented: "Kommentar zu {name} veröffentlicht.",
  toastBonus: "{bonus} Bonus-Credits wurden Ihrem Guthaben gutgeschrieben.",
  errors: {
    failed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    not_found: "Dieses Unternehmen ist nicht mehr verfügbar.",
    rate_limited: "Sie haben in kurzer Zeit mehrere Kommentare veröffentlicht. Bitte versuchen Sie es etwas später erneut.",
    not_allowed: "„Credits verdienen“ gilt für Ihren eigenen Arbeitsbereich.",
    not_reached: "Erreichen Sie beide Ziele, um den Bonus anzufordern.",
    already_claimed: "Sie haben diesen Bonus bereits erhalten.",
  },

  dialogEyebrow: "KI-gestützter Kommentar",
  dialogTitle: "{name} kommentieren",
  dialogBody: "Beginnen Sie mit einem vorgeschlagenen Entwurf und passen Sie ihn so an, dass er Ihre eigenen Beobachtungen wiedergibt.",
  close: "Kommentarfenster schließen",
  styleLabel: "Stil des Entwurfs",
  styles: { question: "Durchdachte Frage", insight: "Hilfreicher Vorschlag", appreciation: "Positive Beobachtung" },
  commentLabel: "Ihr Kommentar",
  draftNote: "KI-Entwurf auf Grundlage der Geschichte dieses Unternehmens. Machen Sie ihn zu Ihrem eigenen.",
  drafting: "Entwurf wird geschrieben…",
  draftUnavailable: "KI-Entwürfe sind derzeit nicht verfügbar. Sie können Ihren Kommentar selbst schreiben.",
  draftLimit: "Sie haben die heutigen KI-Entwürfe aufgebraucht. Sie können Ihren Kommentar weiterhin selbst schreiben.",
  draftFailed: "Diesmal konnte kein Entwurf geschrieben werden. Versuchen Sie es erneut oder schreiben Sie Ihren eigenen.",
  counterChars: "{count} / {max}",
  confirm: "Ich habe diesen Kommentar geprüft und bearbeitet, sodass er meine eigene Meinung wiedergibt.",
  errShort: "Bitte schreiben Sie mindestens {min} Zeichen.",
  errTooLong: "Ihr Kommentar darf höchstens {max} Zeichen lang sein.",
  errLink: "Bitte verzichten Sie in Kommentaren, für die es Credits gibt, auf Links.",
  errConfirm: "Bitte bestätigen Sie, dass Sie den Entwurf geprüft haben.",
  regenerate: "Neuen Entwurf erstellen",
  submit: "Kommentar senden",
  submitting: "Wird veröffentlicht…",
};

export const EARN_DISCOVER_COPY: Record<Locale, EarnDiscoverCopy> = { en, es, fr, it, de };
