import type { EarnKind } from "@/lib/earn/ways";
import type { Locale } from "@/lib/i18n/config";

/**
 * The Earn Credits page's words (client design, 2026-11-02). Five languages,
 * formal address, like the rest of the app. {placeholders} are filled with
 * format() (lib/i18n/format.ts).
 */
export type EarnCopy = {
  title: string;
  eyebrow: string;
  subtitle: string;
  /** "{count} available" beside the title. */
  available: string;
  viewCredits: string;

  inviteEyebrow: string;
  program: string;
  heroTitle: string;
  /** "Earn {credits} credits." */
  heroEm: string;
  heroBody: string;
  codeLabel: string;
  ready: string;
  copyCode: string;
  copyLink: string;
  share: string;
  codeCopied: string;
  linkCopied: string;
  copyFailed: string;
  metaPerReferral: string;
  metaAfterPayment: string;
  shareTitle: string;
  shareBody: string;
  shareEmail: string;
  shareSubject: string;
  /** "… {code}: {link}" */
  shareMessage: string;

  dailyTitle: string;
  dailyBody: string;
  perDay: string;
  todayLabel: string;
  /** "+{count} added" */
  todayAdded: string;
  dailyActive: string;
  dailyNone: string;

  waysTitle: string;
  waysBody: string;
  reviewedTag: string;
  ways: Record<EarnKind, { title: string; body: string; cta: string; details: string; messageLabel: string }>;
  linkLabel: string;
  linkOptional: string;
  submit: string;
  sending: string;
  sent: string;
  statusPending: string;
  /** "+{credits} added" */
  statusApproved: string;
  /** "Not approved: {reason}. You can send it again." */
  statusDeclined: string;
  errors: { link: string; message: string; already: string; approved: string; kind: string; generic: string };

  activityTitle: string;
  activityBody: string;
  referred: string;
  awaiting: string;
  earned: string;
  referredBusinesses: string;
  noneTitle: string;
  noneBody: string;
  unavailable: string;

  howTitle: string;
  howIntro: string;
  /** Three steps; {credits} in the third. */
  steps: [string, string][];
  howNote: string;

  haveCode: string;
  haveCodeBody: string;
  codePlaceholder: string;
  apply: string;
  applied: string;
  codeErrors: { unknown_code: string; self_referral: string; not_new: string; already_referred: string; generic: string };

  faqTitle: string;
  /** {credits} may appear (the referral reward). */
  faq: [string, string][];

  /** The credit history's label for an approved claim. */
  ledgerReward: string;
  /** The pointer left on Settings where the referral card was. */
  movedTitle: string;
  movedBody: string;
  movedLink: string;
};

const en: EarnCopy = {
  title: "Earn Credits",
  eyebrow: "Rewards & referrals",
  subtitle: "A little extra fuel for everything you create and grow with RepGet.",
  available: "{count} available",
  viewCredits: "View credits",

  inviteEyebrow: "Invite & earn",
  program: "Referral program",
  heroTitle: "Share RepGet.",
  heroEm: "Earn {credits} credits.",
  heroBody: "Help a business discover RepGet. When they sign up with your link or code and pay for their first month, you receive {credits} credits.",
  codeLabel: "Your referral code",
  ready: "Ready to share",
  copyCode: "Copy code",
  copyLink: "Copy link",
  share: "Share",
  codeCopied: "Code copied",
  linkCopied: "Link copied",
  copyFailed: "Copying failed. Select the text and copy it by hand.",
  metaPerReferral: "{credits} credits per qualifying referral",
  metaAfterPayment: "Reward after their first paid month",
  shareTitle: "Share your referral",
  shareBody: "Invite another business with your link or code. You earn {credits} credits after their first paid month.",
  shareEmail: "Email",
  shareSubject: "RepGet, a tool you might find useful",
  shareMessage: "I think RepGet could help your business grow. Sign up with my referral code {code}: {link}",

  dailyTitle: "A little boost, every day.",
  dailyBody: "Your daily credits, added automatically when your plan includes them.",
  perDay: "credits / day",
  todayLabel: "Today's credits",
  todayAdded: "+{count} added",
  dailyActive: "Active",
  dailyNone: "Your current plan has no daily credits.",

  waysTitle: "More ways to earn",
  waysBody: "Help other businesses discover and learn RepGet. The RepGet team reviews each one, and each pays once.",
  reviewedTag: "Reviewed by the RepGet team",
  ways: {
    story: {
      title: "Share your story",
      body: "Tell us how you use RepGet and what changed for your business.",
      cta: "Share your experience",
      details: "A genuine short case study in your own words. Honest, critical experiences qualify too. You may add a link to screenshots or a published version.",
      messageLabel: "Your story",
    },
    post: {
      title: "Post about RepGet",
      body: "Share an honest post on your social account about your experience with RepGet.",
      cta: "Submit a post link",
      details: "A real, public post in your own words on LinkedIn, Instagram, X, Threads or another channel that says you may receive RepGet credits for it. It does not have to be positive.",
      messageLabel: "A few words about the post",
    },
    tutorial: {
      title: "Create a quick tutorial",
      body: "Teach other businesses a useful RepGet workflow with a short video or guide.",
      cta: "Share a tutorial",
      details: "One original, public video or guide that teaches a RepGet feature and says you may receive credits for it. We review it for usefulness, not praise.",
      messageLabel: "What does it teach?",
    },
    feedback: {
      title: "Help improve RepGet",
      body: "Send a practical feature idea, bug report or workflow improvement from real use.",
      cta: "Send your idea",
      details: "A specific idea, a problem we can reproduce, or a workflow improvement. Criticism is welcome. Duplicates and one-line messages are not rewarded.",
      messageLabel: "Your idea or problem",
    },
  },
  linkLabel: "Public link",
  linkOptional: "Link (optional)",
  submit: "Send for review",
  sending: "Sending…",
  sent: "Sent. The RepGet team will review it soon.",
  statusPending: "Waiting for review",
  statusApproved: "+{credits} added",
  statusDeclined: "Not approved: {reason}. You can send it again.",
  errors: {
    link: "Add the public link (https://…).",
    message: "Write a little more so the team can review it.",
    already: "You already sent this one. It is waiting for review.",
    approved: "This one has already been rewarded.",
    kind: "This way to earn is not available.",
    generic: "Could not send it. Please try again.",
  },

  activityTitle: "Your referral activity",
  activityBody: "People who discovered RepGet through your link or code.",
  referred: "People referred",
  awaiting: "Awaiting first payment",
  earned: "Credits earned",
  referredBusinesses: "Referred businesses",
  noneTitle: "Your referral story starts here.",
  noneBody: "Share your link. New sign-ups and earned credits appear here.",
  unavailable: "Your referral details could not be loaded. Reload the page to try again.",

  howTitle: "How referrals work",
  howIntro: "Three steps from invitation to reward.",
  steps: [
    ["Send your link", "Invite a business owner or anyone who would benefit from RepGet."],
    ["They sign up with your link or code", "Then they pay for their first month."],
    ["You earn {credits} credits", "Added to your balance after their first payment."],
  ],
  howNote: "Credits are account credit, not cash, and cannot be withdrawn.",

  haveCode: "Were you recommended by someone?",
  haveCodeBody: "Enter their referral code before your first payment, and they earn credits when you start your plan.",
  codePlaceholder: "Referral code",
  apply: "Apply code",
  applied: "Code applied. Thank you!",
  codeErrors: {
    unknown_code: "That code was not found. Check it and try again.",
    self_referral: "That is your own code.",
    not_new: "A code can only be entered by a new account before its first payment.",
    already_referred: "A referral code is already applied to your account.",
    generic: "Could not apply the code. Please try again.",
  },

  faqTitle: "Good to know",
  faq: [
    ["When do I receive my referral credits?", "When the business you referred pays for its first month: {credits} credits. Sign-ups that have not paid yet show as awaiting their first payment. If that payment is refunded in full, the reward is taken back."],
    ["Do I need to claim my daily credits?", "No. When your plan includes daily credits, they are added automatically every day."],
    ["What can I use credits for?", "Everything in RepGet that has a credit price, such as social content, extra articles and Partner Network links. Every action shows its price before you confirm, and credits never expire."],
    ["How are the other ways to earn reviewed?", "The RepGet team checks each submission, usually within a few working days. Only original, genuine submissions are rewarded, each way once per account. Public posts and tutorials must say you may receive RepGet credits for them, and we never ask for a positive review."],
    ["Can I withdraw credits as money?", "No. Credits are account credit, not cash, and cannot be withdrawn or transferred."],
  ],

  ledgerReward: "Earn Credits reward",
  movedTitle: "Referral program",
  movedBody: "Your referral link, what it has earned and more ways to earn credits are now on the Earn Credits page.",
  movedLink: "Open Earn Credits",
};

const es: EarnCopy = {
  title: "Ganar créditos",
  eyebrow: "Recompensas y referidos",
  subtitle: "Un impulso extra para todo lo que crea y hace crecer con RepGet.",
  available: "{count} disponibles",
  viewCredits: "Ver créditos",

  inviteEyebrow: "Invite y gane",
  program: "Programa de referidos",
  heroTitle: "Comparta RepGet.",
  heroEm: "Gane {credits} créditos.",
  heroBody: "Ayude a una empresa a descubrir RepGet. Cuando se registre con su enlace o código y pague su primer mes, usted recibe {credits} créditos.",
  codeLabel: "Su código de referido",
  ready: "Listo para compartir",
  copyCode: "Copiar código",
  copyLink: "Copiar enlace",
  share: "Compartir",
  codeCopied: "Código copiado",
  linkCopied: "Enlace copiado",
  copyFailed: "No se pudo copiar. Seleccione el texto y cópielo a mano.",
  metaPerReferral: "{credits} créditos por cada referido válido",
  metaAfterPayment: "Recompensa tras su primer mes pagado",
  shareTitle: "Comparta su referido",
  shareBody: "Invite a otra empresa con su enlace o código. Gana {credits} créditos tras su primer mes pagado.",
  shareEmail: "Correo",
  shareSubject: "RepGet, una herramienta que le puede ser útil",
  shareMessage: "Creo que RepGet puede ayudar a crecer a su negocio. Regístrese con mi código de referido {code}: {link}",

  dailyTitle: "Un pequeño impulso, cada día.",
  dailyBody: "Sus créditos diarios, añadidos automáticamente cuando su plan los incluye.",
  perDay: "créditos / día",
  todayLabel: "Créditos de hoy",
  todayAdded: "+{count} añadidos",
  dailyActive: "Activo",
  dailyNone: "Su plan actual no incluye créditos diarios.",

  waysTitle: "Más formas de ganar",
  waysBody: "Ayude a otras empresas a descubrir y aprender RepGet. El equipo de RepGet revisa cada una, y cada una se paga una vez.",
  reviewedTag: "Revisado por el equipo de RepGet",
  ways: {
    story: {
      title: "Comparta su historia",
      body: "Cuéntenos cómo usa RepGet y qué cambió en su negocio.",
      cta: "Compartir su experiencia",
      details: "Un caso breve y real con sus propias palabras. Las experiencias honestas y críticas también cuentan. Puede añadir un enlace a capturas o a una versión publicada.",
      messageLabel: "Su historia",
    },
    post: {
      title: "Publique sobre RepGet",
      body: "Comparta una publicación honesta en su red social sobre su experiencia con RepGet.",
      cta: "Enviar el enlace",
      details: "Una publicación real y pública con sus propias palabras en LinkedIn, Instagram, X, Threads u otro canal, que indique que puede recibir créditos de RepGet por ella. No tiene por qué ser positiva.",
      messageLabel: "Unas palabras sobre la publicación",
    },
    tutorial: {
      title: "Cree un tutorial rápido",
      body: "Enseñe a otras empresas un flujo útil de RepGet con un vídeo o una guía breve.",
      cta: "Compartir un tutorial",
      details: "Un vídeo o guía original y público que enseñe una función de RepGet e indique que puede recibir créditos por ello. Lo valoramos por su utilidad, no por los elogios.",
      messageLabel: "¿Qué enseña?",
    },
    feedback: {
      title: "Ayude a mejorar RepGet",
      body: "Envíe una idea práctica, un error o una mejora de flujo basada en el uso real.",
      cta: "Enviar su idea",
      details: "Una idea concreta, un problema que podamos reproducir o una mejora de flujo. Las críticas son bienvenidas. Los duplicados y los mensajes de una línea no se recompensan.",
      messageLabel: "Su idea o problema",
    },
  },
  linkLabel: "Enlace público",
  linkOptional: "Enlace (opcional)",
  submit: "Enviar para revisión",
  sending: "Enviando…",
  sent: "Enviado. El equipo de RepGet lo revisará pronto.",
  statusPending: "Pendiente de revisión",
  statusApproved: "+{credits} añadidos",
  statusDeclined: "No aprobado: {reason}. Puede enviarlo de nuevo.",
  errors: {
    link: "Añada el enlace público (https://…).",
    message: "Escriba un poco más para que el equipo pueda revisarlo.",
    already: "Ya lo envió. Está pendiente de revisión.",
    approved: "Esta ya fue recompensada.",
    kind: "Esta forma de ganar no está disponible.",
    generic: "No se pudo enviar. Inténtelo de nuevo.",
  },

  activityTitle: "Su actividad de referidos",
  activityBody: "Personas que descubrieron RepGet con su enlace o código.",
  referred: "Personas referidas",
  awaiting: "Esperando el primer pago",
  earned: "Créditos ganados",
  referredBusinesses: "Empresas referidas",
  noneTitle: "Su historia de referidos empieza aquí.",
  noneBody: "Comparta su enlace. Los nuevos registros y los créditos ganados aparecerán aquí.",
  unavailable: "No se pudieron cargar sus datos de referidos. Recargue la página para intentarlo de nuevo.",

  howTitle: "Cómo funcionan los referidos",
  howIntro: "Tres pasos de la invitación a la recompensa.",
  steps: [
    ["Envíe su enlace", "Invite a un empresario o a cualquiera a quien RepGet pueda ayudar."],
    ["Se registran con su enlace o código", "Después pagan su primer mes."],
    ["Usted gana {credits} créditos", "Se añaden a su saldo tras su primer pago."],
  ],
  howNote: "Los créditos son saldo de la cuenta, no dinero, y no se pueden retirar.",

  haveCode: "¿Alguien le recomendó RepGet?",
  haveCodeBody: "Introduzca su código de referido antes de su primer pago, y esa persona ganará créditos cuando usted empiece su plan.",
  codePlaceholder: "Código de referido",
  apply: "Aplicar código",
  applied: "Código aplicado. ¡Gracias!",
  codeErrors: {
    unknown_code: "No se encontró ese código. Revíselo e inténtelo de nuevo.",
    self_referral: "Ese es su propio código.",
    not_new: "Solo una cuenta nueva puede introducir un código, antes de su primer pago.",
    already_referred: "Su cuenta ya tiene un código de referido aplicado.",
    generic: "No se pudo aplicar el código. Inténtelo de nuevo.",
  },

  faqTitle: "Conviene saber",
  faq: [
    ["¿Cuándo recibo mis créditos por referidos?", "Cuando la empresa que refirió paga su primer mes: {credits} créditos. Los registros que aún no han pagado aparecen como pendientes del primer pago. Si ese pago se reembolsa por completo, la recompensa se retira."],
    ["¿Tengo que reclamar mis créditos diarios?", "No. Cuando su plan incluye créditos diarios, se añaden automáticamente cada día."],
    ["¿Para qué puedo usar los créditos?", "Para todo lo que en RepGet tiene un precio en créditos, como contenido social, artículos extra y enlaces de la Partner Network. Cada acción muestra su precio antes de confirmar, y los créditos no caducan."],
    ["¿Cómo se revisan las otras formas de ganar?", "El equipo de RepGet revisa cada envío, normalmente en pocos días laborables. Solo se recompensan envíos originales y auténticos, cada forma una vez por cuenta. Las publicaciones y tutoriales públicos deben indicar que puede recibir créditos de RepGet, y nunca pedimos una opinión positiva."],
    ["¿Puedo retirar los créditos como dinero?", "No. Los créditos son saldo de la cuenta, no dinero, y no se pueden retirar ni transferir."],
  ],

  ledgerReward: "Recompensa de Ganar créditos",
  movedTitle: "Programa de referidos",
  movedBody: "Su enlace de referido, lo que ha ganado y más formas de ganar créditos están ahora en la página Ganar créditos.",
  movedLink: "Abrir Ganar créditos",
};

const fr: EarnCopy = {
  title: "Gagner des crédits",
  eyebrow: "Récompenses et parrainage",
  subtitle: "Un petit supplément pour tout ce que vous créez et développez avec RepGet.",
  available: "{count} disponibles",
  viewCredits: "Voir les crédits",

  inviteEyebrow: "Invitez et gagnez",
  program: "Programme de parrainage",
  heroTitle: "Partagez RepGet.",
  heroEm: "Gagnez {credits} crédits.",
  heroBody: "Faites découvrir RepGet à une entreprise. Lorsqu’elle s’inscrit avec votre lien ou votre code et paie son premier mois, vous recevez {credits} crédits.",
  codeLabel: "Votre code de parrainage",
  ready: "Prêt à partager",
  copyCode: "Copier le code",
  copyLink: "Copier le lien",
  share: "Partager",
  codeCopied: "Code copié",
  linkCopied: "Lien copié",
  copyFailed: "La copie a échoué. Sélectionnez le texte et copiez-le à la main.",
  metaPerReferral: "{credits} crédits par parrainage valide",
  metaAfterPayment: "Récompense après son premier mois payé",
  shareTitle: "Partagez votre parrainage",
  shareBody: "Invitez une autre entreprise avec votre lien ou votre code. Vous gagnez {credits} crédits après son premier mois payé.",
  shareEmail: "E-mail",
  shareSubject: "RepGet, un outil qui pourrait vous être utile",
  shareMessage: "Je pense que RepGet peut aider votre entreprise à se développer. Inscrivez-vous avec mon code de parrainage {code} : {link}",

  dailyTitle: "Un petit coup de pouce, chaque jour.",
  dailyBody: "Vos crédits quotidiens, ajoutés automatiquement lorsque votre formule les inclut.",
  perDay: "crédits / jour",
  todayLabel: "Crédits du jour",
  todayAdded: "+{count} ajoutés",
  dailyActive: "Actif",
  dailyNone: "Votre formule actuelle n’inclut pas de crédits quotidiens.",

  waysTitle: "Plus de façons de gagner",
  waysBody: "Aidez d’autres entreprises à découvrir et à apprendre RepGet. L’équipe RepGet examine chaque envoi, et chacun est récompensé une fois.",
  reviewedTag: "Examiné par l’équipe RepGet",
  ways: {
    story: {
      title: "Partagez votre histoire",
      body: "Racontez-nous comment vous utilisez RepGet et ce qui a changé pour votre entreprise.",
      cta: "Partager votre expérience",
      details: "Un court témoignage authentique, avec vos propres mots. Les expériences honnêtes et critiques comptent aussi. Vous pouvez ajouter un lien vers des captures ou une version publiée.",
      messageLabel: "Votre histoire",
    },
    post: {
      title: "Publiez sur RepGet",
      body: "Partagez une publication honnête sur votre réseau social à propos de votre expérience avec RepGet.",
      cta: "Envoyer le lien",
      details: "Une vraie publication publique, avec vos propres mots, sur LinkedIn, Instagram, X, Threads ou un autre canal, qui indique que vous pouvez recevoir des crédits RepGet pour elle. Elle n’a pas besoin d’être positive.",
      messageLabel: "Quelques mots sur la publication",
    },
    tutorial: {
      title: "Créez un tutoriel rapide",
      body: "Montrez à d’autres entreprises un usage utile de RepGet avec une courte vidéo ou un guide.",
      cta: "Partager un tutoriel",
      details: "Une vidéo ou un guide original et public qui explique une fonction de RepGet et indique que vous pouvez recevoir des crédits pour cela. Nous l’évaluons pour son utilité, pas pour les éloges.",
      messageLabel: "Qu’enseigne-t-il ?",
    },
    feedback: {
      title: "Aidez à améliorer RepGet",
      body: "Envoyez une idée concrète, un bug ou une amélioration issue d’un usage réel.",
      cta: "Envoyer votre idée",
      details: "Une idée précise, un problème que nous pouvons reproduire ou une amélioration de méthode. Les critiques sont les bienvenues. Les doublons et les messages d’une ligne ne sont pas récompensés.",
      messageLabel: "Votre idée ou votre problème",
    },
  },
  linkLabel: "Lien public",
  linkOptional: "Lien (facultatif)",
  submit: "Envoyer pour examen",
  sending: "Envoi…",
  sent: "Envoyé. L’équipe RepGet l’examinera bientôt.",
  statusPending: "En attente d’examen",
  statusApproved: "+{credits} ajoutés",
  statusDeclined: "Non approuvé : {reason}. Vous pouvez l’envoyer à nouveau.",
  errors: {
    link: "Ajoutez le lien public (https://…).",
    message: "Écrivez un peu plus pour que l’équipe puisse l’examiner.",
    already: "Vous l’avez déjà envoyé. Il est en attente d’examen.",
    approved: "Celui-ci a déjà été récompensé.",
    kind: "Cette façon de gagner n’est pas disponible.",
    generic: "L’envoi a échoué. Veuillez réessayer.",
  },

  activityTitle: "Votre activité de parrainage",
  activityBody: "Les personnes qui ont découvert RepGet grâce à votre lien ou votre code.",
  referred: "Personnes parrainées",
  awaiting: "En attente du premier paiement",
  earned: "Crédits gagnés",
  referredBusinesses: "Entreprises parrainées",
  noneTitle: "Votre histoire de parrainage commence ici.",
  noneBody: "Partagez votre lien. Les nouvelles inscriptions et les crédits gagnés apparaîtront ici.",
  unavailable: "Vos informations de parrainage n’ont pas pu être chargées. Rechargez la page pour réessayer.",

  howTitle: "Comment fonctionne le parrainage",
  howIntro: "Trois étapes de l’invitation à la récompense.",
  steps: [
    ["Envoyez votre lien", "Invitez un chef d’entreprise ou toute personne à qui RepGet serait utile."],
    ["Elle s’inscrit avec votre lien ou votre code", "Puis elle paie son premier mois."],
    ["Vous gagnez {credits} crédits", "Ajoutés à votre solde après son premier paiement."],
  ],
  howNote: "Les crédits sont un avoir sur votre compte, pas de l’argent, et ne peuvent pas être retirés.",

  haveCode: "Quelqu’un vous a recommandé RepGet ?",
  haveCodeBody: "Saisissez son code de parrainage avant votre premier paiement : cette personne gagnera des crédits lorsque vous démarrerez votre formule.",
  codePlaceholder: "Code de parrainage",
  apply: "Appliquer le code",
  applied: "Code appliqué. Merci !",
  codeErrors: {
    unknown_code: "Ce code est introuvable. Vérifiez-le et réessayez.",
    self_referral: "C’est votre propre code.",
    not_new: "Seul un nouveau compte peut saisir un code, avant son premier paiement.",
    already_referred: "Un code de parrainage est déjà appliqué à votre compte.",
    generic: "Le code n’a pas pu être appliqué. Veuillez réessayer.",
  },

  faqTitle: "Bon à savoir",
  faq: [
    ["Quand vais-je recevoir mes crédits de parrainage ?", "Lorsque l’entreprise que vous avez parrainée paie son premier mois : {credits} crédits. Les inscriptions qui n’ont pas encore payé apparaissent en attente du premier paiement. Si ce paiement est entièrement remboursé, la récompense est reprise."],
    ["Dois-je réclamer mes crédits quotidiens ?", "Non. Lorsque votre formule inclut des crédits quotidiens, ils sont ajoutés automatiquement chaque jour."],
    ["À quoi servent les crédits ?", "À tout ce qui a un prix en crédits dans RepGet, comme le contenu social, des articles supplémentaires et les liens de la Partner Network. Chaque action affiche son prix avant confirmation, et les crédits n’expirent jamais."],
    ["Comment les autres façons de gagner sont-elles examinées ?", "L’équipe RepGet vérifie chaque envoi, généralement sous quelques jours ouvrés. Seuls les envois originaux et authentiques sont récompensés, chaque façon une fois par compte. Les publications et tutoriels publics doivent indiquer que vous pouvez recevoir des crédits RepGet, et nous ne demandons jamais d’avis positif."],
    ["Puis-je retirer des crédits en argent ?", "Non. Les crédits sont un avoir sur votre compte, pas de l’argent, et ne peuvent être ni retirés ni transférés."],
  ],

  ledgerReward: "Récompense Gagner des crédits",
  movedTitle: "Programme de parrainage",
  movedBody: "Votre lien de parrainage, ce qu’il vous a rapporté et d’autres façons de gagner des crédits se trouvent désormais sur la page Gagner des crédits.",
  movedLink: "Ouvrir Gagner des crédits",
};

const it: EarnCopy = {
  title: "Guadagni crediti",
  eyebrow: "Premi e referral",
  subtitle: "Una spinta in più per tutto ciò che crea e fa crescere con RepGet.",
  available: "{count} disponibili",
  viewCredits: "Vedi crediti",

  inviteEyebrow: "Inviti e guadagni",
  program: "Programma referral",
  heroTitle: "Condivida RepGet.",
  heroEm: "Guadagni {credits} crediti.",
  heroBody: "Aiuti un’azienda a scoprire RepGet. Quando si iscrive con il Suo link o codice e paga il primo mese, Lei riceve {credits} crediti.",
  codeLabel: "Il Suo codice referral",
  ready: "Pronto da condividere",
  copyCode: "Copia codice",
  copyLink: "Copia link",
  share: "Condividi",
  codeCopied: "Codice copiato",
  linkCopied: "Link copiato",
  copyFailed: "Copia non riuscita. Selezioni il testo e lo copi a mano.",
  metaPerReferral: "{credits} crediti per ogni referral valido",
  metaAfterPayment: "Premio dopo il suo primo mese pagato",
  shareTitle: "Condivida il Suo referral",
  shareBody: "Inviti un’altra azienda con il Suo link o codice. Guadagna {credits} crediti dopo il suo primo mese pagato.",
  shareEmail: "Email",
  shareSubject: "RepGet, uno strumento che potrebbe esserLe utile",
  shareMessage: "Credo che RepGet possa aiutare la Sua attività a crescere. Si iscriva con il mio codice referral {code}: {link}",

  dailyTitle: "Una piccola spinta, ogni giorno.",
  dailyBody: "I Suoi crediti giornalieri, aggiunti automaticamente quando il Suo piano li include.",
  perDay: "crediti / giorno",
  todayLabel: "Crediti di oggi",
  todayAdded: "+{count} aggiunti",
  dailyActive: "Attivo",
  dailyNone: "Il Suo piano attuale non include crediti giornalieri.",

  waysTitle: "Altri modi per guadagnare",
  waysBody: "Aiuti altre aziende a scoprire e imparare RepGet. Il team RepGet verifica ognuno, e ciascuno viene premiato una volta.",
  reviewedTag: "Verificato dal team RepGet",
  ways: {
    story: {
      title: "Racconti la Sua storia",
      body: "Ci racconti come usa RepGet e cosa è cambiato per la Sua attività.",
      cta: "Condivida la Sua esperienza",
      details: "Un breve caso reale, con parole Sue. Anche le esperienze oneste e critiche contano. Può aggiungere un link a screenshot o a una versione pubblicata.",
      messageLabel: "La Sua storia",
    },
    post: {
      title: "Pubblichi su RepGet",
      body: "Condivida un post onesto sul Suo profilo social sulla Sua esperienza con RepGet.",
      cta: "Invii il link del post",
      details: "Un post reale e pubblico, con parole Sue, su LinkedIn, Instagram, X, Threads o un altro canale, che dica che potrebbe ricevere crediti RepGet per esso. Non deve essere per forza positivo.",
      messageLabel: "Due parole sul post",
    },
    tutorial: {
      title: "Crei un breve tutorial",
      body: "Insegni ad altre aziende un uso utile di RepGet con un breve video o una guida.",
      cta: "Condivida un tutorial",
      details: "Un video o una guida originale e pubblica che insegni una funzione di RepGet e dica che potrebbe ricevere crediti per questo. Lo valutiamo per l’utilità, non per gli elogi.",
      messageLabel: "Cosa insegna?",
    },
    feedback: {
      title: "Aiuti a migliorare RepGet",
      body: "Invii un’idea pratica, una segnalazione di errore o un miglioramento nato dall’uso reale.",
      cta: "Invii la Sua idea",
      details: "Un’idea precisa, un problema che possiamo riprodurre o un miglioramento del flusso. Le critiche sono benvenute. Duplicati e messaggi di una riga non vengono premiati.",
      messageLabel: "La Sua idea o il problema",
    },
  },
  linkLabel: "Link pubblico",
  linkOptional: "Link (facoltativo)",
  submit: "Invia per la verifica",
  sending: "Invio…",
  sent: "Inviato. Il team RepGet lo verificherà a breve.",
  statusPending: "In attesa di verifica",
  statusApproved: "+{credits} aggiunti",
  statusDeclined: "Non approvato: {reason}. Può inviarlo di nuovo.",
  errors: {
    link: "Aggiunga il link pubblico (https://…).",
    message: "Scriva qualcosa in più perché il team possa verificarlo.",
    already: "Lo ha già inviato. È in attesa di verifica.",
    approved: "Questo è già stato premiato.",
    kind: "Questo modo di guadagnare non è disponibile.",
    generic: "Invio non riuscito. Riprovi.",
  },

  activityTitle: "La Sua attività referral",
  activityBody: "Le persone che hanno scoperto RepGet con il Suo link o codice.",
  referred: "Persone invitate",
  awaiting: "In attesa del primo pagamento",
  earned: "Crediti guadagnati",
  referredBusinesses: "Aziende invitate",
  noneTitle: "La Sua storia di referral inizia qui.",
  noneBody: "Condivida il Suo link. Le nuove iscrizioni e i crediti guadagnati compariranno qui.",
  unavailable: "Non è stato possibile caricare i dati referral. Ricarichi la pagina per riprovare.",

  howTitle: "Come funzionano i referral",
  howIntro: "Tre passi dall’invito al premio.",
  steps: [
    ["Invii il Suo link", "Inviti un imprenditore o chiunque possa trarre vantaggio da RepGet."],
    ["Si iscrive con il Suo link o codice", "Poi paga il primo mese."],
    ["Lei guadagna {credits} crediti", "Aggiunti al Suo saldo dopo il suo primo pagamento."],
  ],
  howNote: "I crediti sono un credito sull’account, non denaro, e non possono essere prelevati.",

  haveCode: "Qualcuno Le ha consigliato RepGet?",
  haveCodeBody: "Inserisca il suo codice referral prima del Suo primo pagamento: quella persona guadagnerà crediti quando Lei avvierà il piano.",
  codePlaceholder: "Codice referral",
  apply: "Applica codice",
  applied: "Codice applicato. Grazie!",
  codeErrors: {
    unknown_code: "Codice non trovato. Lo controlli e riprovi.",
    self_referral: "Questo è il Suo codice.",
    not_new: "Un codice può essere inserito solo da un nuovo account, prima del primo pagamento.",
    already_referred: "Al Suo account è già applicato un codice referral.",
    generic: "Non è stato possibile applicare il codice. Riprovi.",
  },

  faqTitle: "Da sapere",
  faq: [
    ["Quando ricevo i crediti referral?", "Quando l’azienda che ha invitato paga il primo mese: {credits} crediti. Le iscrizioni che non hanno ancora pagato risultano in attesa del primo pagamento. Se quel pagamento viene rimborsato per intero, il premio viene ritirato."],
    ["Devo richiedere i crediti giornalieri?", "No. Quando il Suo piano include crediti giornalieri, vengono aggiunti automaticamente ogni giorno."],
    ["Per cosa posso usare i crediti?", "Per tutto ciò che in RepGet ha un prezzo in crediti, come contenuti social, articoli extra e link della Partner Network. Ogni azione mostra il prezzo prima della conferma, e i crediti non scadono mai."],
    ["Come vengono verificati gli altri modi per guadagnare?", "Il team RepGet controlla ogni invio, di solito entro pochi giorni lavorativi. Vengono premiati solo invii originali e autentici, ogni modo una volta per account. Post e tutorial pubblici devono dire che potrebbe ricevere crediti RepGet, e non chiediamo mai una recensione positiva."],
    ["Posso prelevare i crediti come denaro?", "No. I crediti sono un credito sull’account, non denaro, e non possono essere prelevati né trasferiti."],
  ],

  ledgerReward: "Premio Guadagni crediti",
  movedTitle: "Programma referral",
  movedBody: "Il Suo link referral, quanto ha guadagnato e altri modi per guadagnare crediti sono ora nella pagina Guadagni crediti.",
  movedLink: "Apri Guadagni crediti",
};

const de: EarnCopy = {
  title: "Credits verdienen",
  eyebrow: "Prämien & Empfehlungen",
  subtitle: "Ein kleiner Extra-Schub für alles, was Sie mit RepGet erstellen und wachsen lassen.",
  available: "{count} verfügbar",
  viewCredits: "Credits ansehen",

  inviteEyebrow: "Einladen & verdienen",
  program: "Empfehlungsprogramm",
  heroTitle: "Empfehlen Sie RepGet.",
  heroEm: "Verdienen Sie {credits} Credits.",
  heroBody: "Helfen Sie einem Unternehmen, RepGet zu entdecken. Wenn es sich mit Ihrem Link oder Code anmeldet und den ersten Monat bezahlt, erhalten Sie {credits} Credits.",
  codeLabel: "Ihr Empfehlungscode",
  ready: "Bereit zum Teilen",
  copyCode: "Code kopieren",
  copyLink: "Link kopieren",
  share: "Teilen",
  codeCopied: "Code kopiert",
  linkCopied: "Link kopiert",
  copyFailed: "Kopieren fehlgeschlagen. Markieren Sie den Text und kopieren Sie ihn von Hand.",
  metaPerReferral: "{credits} Credits pro gültiger Empfehlung",
  metaAfterPayment: "Prämie nach dem ersten bezahlten Monat",
  shareTitle: "Empfehlung teilen",
  shareBody: "Laden Sie ein anderes Unternehmen mit Ihrem Link oder Code ein. Sie erhalten {credits} Credits nach dessen erstem bezahlten Monat.",
  shareEmail: "E-Mail",
  shareSubject: "RepGet, ein Tool, das Ihnen nützen könnte",
  shareMessage: "Ich glaube, RepGet kann Ihrem Unternehmen beim Wachsen helfen. Melden Sie sich mit meinem Empfehlungscode {code} an: {link}",

  dailyTitle: "Ein kleiner Schub, jeden Tag.",
  dailyBody: "Ihre täglichen Credits, automatisch gutgeschrieben, wenn Ihr Tarif sie enthält.",
  perDay: "Credits / Tag",
  todayLabel: "Heutige Credits",
  todayAdded: "+{count} gutgeschrieben",
  dailyActive: "Aktiv",
  dailyNone: "Ihr aktueller Tarif enthält keine täglichen Credits.",

  waysTitle: "Weitere Wege, Credits zu verdienen",
  waysBody: "Helfen Sie anderen Unternehmen, RepGet zu entdecken und zu lernen. Das RepGet-Team prüft jede Einsendung, und jede wird einmal belohnt.",
  reviewedTag: "Vom RepGet-Team geprüft",
  ways: {
    story: {
      title: "Erzählen Sie Ihre Geschichte",
      body: "Erzählen Sie uns, wie Sie RepGet nutzen und was sich für Ihr Unternehmen verändert hat.",
      cta: "Erfahrung teilen",
      details: "Eine kurze, echte Fallgeschichte in Ihren eigenen Worten. Ehrliche, kritische Erfahrungen zählen ebenso. Sie können einen Link zu Screenshots oder einer veröffentlichten Fassung hinzufügen.",
      messageLabel: "Ihre Geschichte",
    },
    post: {
      title: "Posten Sie über RepGet",
      body: "Teilen Sie einen ehrlichen Beitrag in Ihrem Social-Media-Konto über Ihre Erfahrung mit RepGet.",
      cta: "Beitragslink senden",
      details: "Ein echter, öffentlicher Beitrag in Ihren eigenen Worten auf LinkedIn, Instagram, X, Threads oder einem anderen Kanal, der angibt, dass Sie dafür RepGet-Credits erhalten können. Er muss nicht positiv sein.",
      messageLabel: "Ein paar Worte zum Beitrag",
    },
    tutorial: {
      title: "Erstellen Sie ein kurzes Tutorial",
      body: "Zeigen Sie anderen Unternehmen einen nützlichen RepGet-Ablauf in einem kurzen Video oder einer Anleitung.",
      cta: "Tutorial teilen",
      details: "Ein eigenes, öffentliches Video oder eine Anleitung, die eine RepGet-Funktion erklärt und angibt, dass Sie dafür Credits erhalten können. Wir bewerten den Nutzen, nicht das Lob.",
      messageLabel: "Was wird erklärt?",
    },
    feedback: {
      title: "Helfen Sie, RepGet zu verbessern",
      body: "Senden Sie eine praktische Idee, einen Fehlerbericht oder eine Verbesserung aus der echten Nutzung.",
      cta: "Idee senden",
      details: "Eine konkrete Idee, ein Problem, das wir nachvollziehen können, oder eine Verbesserung eines Ablaufs. Kritik ist willkommen. Doppelte Einsendungen und Einzeiler werden nicht belohnt.",
      messageLabel: "Ihre Idee oder Ihr Problem",
    },
  },
  linkLabel: "Öffentlicher Link",
  linkOptional: "Link (optional)",
  submit: "Zur Prüfung senden",
  sending: "Wird gesendet…",
  sent: "Gesendet. Das RepGet-Team prüft es in Kürze.",
  statusPending: "Wartet auf Prüfung",
  statusApproved: "+{credits} gutgeschrieben",
  statusDeclined: "Nicht angenommen: {reason}. Sie können es erneut senden.",
  errors: {
    link: "Fügen Sie den öffentlichen Link hinzu (https://…).",
    message: "Schreiben Sie etwas mehr, damit das Team es prüfen kann.",
    already: "Sie haben dies bereits gesendet. Es wartet auf Prüfung.",
    approved: "Dies wurde bereits belohnt.",
    kind: "Dieser Weg ist nicht verfügbar.",
    generic: "Senden fehlgeschlagen. Bitte versuchen Sie es erneut.",
  },

  activityTitle: "Ihre Empfehlungen",
  activityBody: "Personen, die RepGet über Ihren Link oder Code entdeckt haben.",
  referred: "Empfohlene Personen",
  awaiting: "Warten auf erste Zahlung",
  earned: "Verdiente Credits",
  referredBusinesses: "Empfohlene Unternehmen",
  noneTitle: "Ihre Empfehlungsgeschichte beginnt hier.",
  noneBody: "Teilen Sie Ihren Link. Neue Anmeldungen und verdiente Credits erscheinen hier.",
  unavailable: "Ihre Empfehlungsdaten konnten nicht geladen werden. Laden Sie die Seite neu, um es erneut zu versuchen.",

  howTitle: "So funktionieren Empfehlungen",
  howIntro: "Drei Schritte von der Einladung zur Prämie.",
  steps: [
    ["Senden Sie Ihren Link", "Laden Sie Unternehmer oder alle ein, denen RepGet helfen würde."],
    ["Anmeldung mit Ihrem Link oder Code", "Danach wird der erste Monat bezahlt."],
    ["Sie erhalten {credits} Credits", "Gutgeschrieben nach der ersten Zahlung."],
  ],
  howNote: "Credits sind Guthaben auf Ihrem Konto, kein Geld, und können nicht ausgezahlt werden.",

  haveCode: "Hat Ihnen jemand RepGet empfohlen?",
  haveCodeBody: "Geben Sie den Empfehlungscode vor Ihrer ersten Zahlung ein, dann erhält diese Person Credits, wenn Sie Ihren Tarif starten.",
  codePlaceholder: "Empfehlungscode",
  apply: "Code anwenden",
  applied: "Code angewendet. Vielen Dank!",
  codeErrors: {
    unknown_code: "Dieser Code wurde nicht gefunden. Prüfen Sie ihn und versuchen Sie es erneut.",
    self_referral: "Das ist Ihr eigener Code.",
    not_new: "Einen Code kann nur ein neues Konto vor seiner ersten Zahlung eingeben.",
    already_referred: "Ihrem Konto ist bereits ein Empfehlungscode zugeordnet.",
    generic: "Der Code konnte nicht angewendet werden. Bitte versuchen Sie es erneut.",
  },

  faqTitle: "Gut zu wissen",
  faq: [
    ["Wann erhalte ich meine Empfehlungs-Credits?", "Wenn das empfohlene Unternehmen seinen ersten Monat bezahlt: {credits} Credits. Anmeldungen ohne Zahlung erscheinen als „Warten auf erste Zahlung“. Wird diese Zahlung vollständig erstattet, wird die Prämie zurückgebucht."],
    ["Muss ich meine täglichen Credits anfordern?", "Nein. Wenn Ihr Tarif tägliche Credits enthält, werden sie jeden Tag automatisch gutgeschrieben."],
    ["Wofür kann ich Credits nutzen?", "Für alles in RepGet mit einem Credit-Preis, etwa Social-Content, zusätzliche Artikel und Partner-Network-Links. Jede Aktion zeigt ihren Preis vor der Bestätigung, und Credits verfallen nie."],
    ["Wie werden die anderen Wege geprüft?", "Das RepGet-Team prüft jede Einsendung, meist innerhalb weniger Werktage. Belohnt werden nur eigene, echte Einsendungen, jeder Weg einmal pro Konto. Öffentliche Beiträge und Tutorials müssen angeben, dass Sie dafür RepGet-Credits erhalten können, und wir verlangen nie eine positive Bewertung."],
    ["Kann ich Credits als Geld auszahlen lassen?", "Nein. Credits sind Guthaben auf Ihrem Konto, kein Geld, und können weder ausgezahlt noch übertragen werden."],
  ],

  ledgerReward: "Prämie „Credits verdienen“",
  movedTitle: "Empfehlungsprogramm",
  movedBody: "Ihr Empfehlungslink, was er eingebracht hat, und weitere Wege, Credits zu verdienen, finden Sie jetzt auf der Seite „Credits verdienen“.",
  movedLink: "„Credits verdienen“ öffnen",
};

export const EARN_COPY: Record<Locale, EarnCopy> = { en, es, fr, it, de };
