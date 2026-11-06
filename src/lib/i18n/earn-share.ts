import type { ShareChannel } from "@/lib/earn/share-templates";
import type { Locale } from "@/lib/i18n/config";

/**
 * The Earn Credits share kit's words (client design, 2026-11-05). The interface
 * uses the app's formal address; the templates are the customer's own message
 * to their own audience, so a WhatsApp message to a contact is informal.
 *
 * Templates: {link} and {code} are the reader's own (lib/earn/share-templates.ts).
 * Every template says the author may receive credits, the disclosure Earn
 * Credits asks of public posts, and none claims a result or an experience the
 * author has not had. They are starting points: the claim rule stays "in your own
 * words", and the kit says so. Rewards are always {credits} placeholders, read from
 * their canonical values.
 */
export type EarnShareCopy = {
  jump: string;
  artAlt: string;
  /** The words over the referral artwork, which has none drawn in. */
  artFriend: string;
  artCredits: string;

  eyebrow: string;
  title: string;
  body: string;
  flag: string;
  flagNote: string;

  tabsTitle: string;
  tabLabels: Record<ShareChannel, string>;
  draftLabels: Record<ShareChannel, string>;
  editable: string;
  /** "{count} characters" */
  count: string;
  /** "{count} of {limit} characters" */
  countLimit: string;
  xNote: string;
  overLimit: string;
  linkMissing: string;
  includesLink: string;
  honest: string;
  copyPost: string;
  copyOpen: string;
  reset: string;

  copied: string;
  restored: string;
  copyFailed: string;
  /** After Copy & Open: never says it was shared, because only the customer can do that. */
  openedPrefilled: string;
  openedPaste: string;
  editNote: string;

  sideEyebrow: string;
  sideTitle: string;
  steps: [string, string][];
  submitLink: string;
  guideTitle: string;
  guide: string;

  subject: string;
  templates: Record<ShareChannel, string>;
};

const en: EarnShareCopy = {
  jump: "Start from a ready-made post",
  artAlt: "Four people connected to RepGet, and a reward of {credits} credits when a friend completes their first paid month",
  artFriend: "Friend joined",
  artCredits: "Credits",

  eyebrow: "Your sharing toolkit",
  title: "Ready to share. Ready to earn.",
  body: "Choose a platform and start from a template. Each one is only a starting point: make it your own, then copy it.",
  flag: "+{credits} credits",
  flagNote: "For one approved social post",

  tabsTitle: "Choose where to share",
  tabLabels: { linkedin: "LinkedIn", facebook: "Facebook", x: "X", whatsapp: "WhatsApp", email: "Email" },
  draftLabels: { linkedin: "LinkedIn post", facebook: "Facebook post", x: "X post", whatsapp: "WhatsApp message", email: "Email message" },
  editable: "A starting point: edit it freely",
  count: "{count} characters",
  countLimit: "{count} of {limit} characters",
  xNote: "On X a link counts as 23 characters.",
  overLimit: "{platform} allows {limit} characters. Shorten this by {over} to open it there.",
  linkMissing: "Your referral link is no longer in this text. Add it back or reset the text: {link}",
  includesLink: "Includes your referral link",
  honest: "This is a starting point, not a script. Keep it honest and in your own words, and keep the note that you may receive credits.",
  copyPost: "Copy post",
  copyOpen: "Copy & open {platform}",
  reset: "Reset text",

  copied: "Copied to the clipboard.",
  restored: "Original message restored.",
  copyFailed: "Your browser blocked copying. The text is selected: press Ctrl+C (Cmd+C on a Mac) to copy it by hand.",
  openedPrefilled: "Text copied, and {platform} should open with it filled in. Nothing is posted or sent until you do it there.",
  openedPaste: "Text copied. Paste it into {platform}, which should open in a new tab. Nothing is posted or sent until you do it there.",
  editNote: "You can edit the text before posting. RepGet never posts or sends anything for you.",

  sideEyebrow: "How to earn",
  sideTitle: "Share your link. Collect credits.",
  steps: [
    ["Pick a starting point", "Choose LinkedIn, Facebook, X, WhatsApp or Email, then edit the text."],
    ["Copy and share it", "Each version already contains your personal referral link."],
    ["Submit an eligible public post", "To claim the reward, the post must be public and in your own words. Send its address and the RepGet team reviews it."],
  ],
  submitLink: "Submit a post link",
  guideTitle: "Two separate ways to earn",
  guide: "{post} credits for one approved public post, once per account. {referral} credits if someone joins through your link and completes their first paid month. Copying, sharing or sending a claim adds nothing by itself: the team reviews each claim, and a referral waits for its first payment.",

  subject: "A useful growth tool: RepGet",
  templates: {
    linkedin:
      "Running a business means staying visible across search and social, often with too many separate tools.\n\nRepGet brings SEO, AI search visibility, article planning, backlinks and social publishing together in one place.\n\nIf growing your online presence is a priority, take a look:\n{link}\n\nThis is my referral link: I may receive RepGet credits if you sign up.\n\n#SEO #DigitalMarketing #SmallBusiness",
    facebook:
      "Looking for a simpler way to grow your business online?\n\nRepGet brings together SEO tools, AI search visibility, articles, backlinks and social content, so you can manage more of your online presence from one platform.\n\nHave a look here: {link}\n\nThis is my referral link: I may receive RepGet credits if you sign up.",
    x: "SEO + AI search visibility + articles + backlinks + social publishing, all in one platform. Explore RepGet: {link}\n\nReferral link: I may receive RepGet credits.",
    whatsapp:
      "Hey! If you're trying to grow your business online, take a look at RepGet. It brings SEO, AI search visibility, content and social publishing into one place: {link}\n\nIt's my referral link, so I may receive RepGet credits if you sign up.",
    email:
      "Hi,\n\nI thought you might find this useful if you're working on growing your business online. RepGet brings together SEO, AI search visibility, article planning, backlinks and social publishing.\n\nYou can explore it here: {link}\nMy referral code is {code}.\n\nThis is my referral link, so I may receive RepGet credits if you sign up.\n\nBest,",
  },
};

const es: EarnShareCopy = {
  jump: "Empezar con una publicación ya redactada",
  artAlt: "Cuatro personas conectadas a RepGet, y una recompensa de {credits} créditos cuando alguien completa su primer mes pagado",
  artFriend: "Amigo registrado",
  artCredits: "Créditos",

  eyebrow: "Su kit para compartir",
  title: "Listo para compartir. Listo para ganar.",
  body: "Elija una plataforma y parta de una plantilla. Cada una es solo un punto de partida: hágala suya y luego cópiela.",
  flag: "+{credits} créditos",
  flagNote: "Por una publicación social aprobada",

  tabsTitle: "Elija dónde compartir",
  tabLabels: { linkedin: "LinkedIn", facebook: "Facebook", x: "X", whatsapp: "WhatsApp", email: "Correo" },
  draftLabels: { linkedin: "Publicación de LinkedIn", facebook: "Publicación de Facebook", x: "Publicación de X", whatsapp: "Mensaje de WhatsApp", email: "Mensaje de correo" },
  editable: "Un punto de partida: edítelo libremente",
  count: "{count} caracteres",
  countLimit: "{count} de {limit} caracteres",
  xNote: "En X un enlace cuenta como 23 caracteres.",
  overLimit: "{platform} permite {limit} caracteres. Acorte este texto en {over} para abrirlo allí.",
  linkMissing: "Su enlace de referido ya no está en este texto. Vuelva a añadirlo o restablezca el texto: {link}",
  includesLink: "Incluye su enlace de referido",
  honest: "Es un punto de partida, no un guion. Sea honesto y use sus propias palabras, y mantenga la nota de que puede recibir créditos.",
  copyPost: "Copiar publicación",
  copyOpen: "Copiar y abrir {platform}",
  reset: "Restablecer texto",

  copied: "Copiado al portapapeles.",
  restored: "Mensaje original restablecido.",
  copyFailed: "Su navegador ha bloqueado la copia. El texto está seleccionado: pulse Ctrl+C (Cmd+C en Mac) para copiarlo a mano.",
  openedPrefilled: "Texto copiado; {platform} debería abrirse con él ya escrito. No se publica ni se envía nada hasta que lo haga usted allí.",
  openedPaste: "Texto copiado. Péguelo en {platform}, que debería abrirse en una pestaña nueva. No se publica ni se envía nada hasta que lo haga usted allí.",
  editNote: "Puede editar el texto antes de publicarlo. RepGet nunca publica ni envía nada por usted.",

  sideEyebrow: "Cómo ganar",
  sideTitle: "Comparta su enlace. Reciba créditos.",
  steps: [
    ["Elija un punto de partida", "LinkedIn, Facebook, X, WhatsApp o correo, y luego edite el texto."],
    ["Cópiela y compártala", "Cada versión ya contiene su enlace de referido personal."],
    ["Envíe una publicación pública válida", "Para reclamar la recompensa, la publicación debe ser pública y con sus propias palabras. Envíe su dirección y el equipo de RepGet la revisará."],
  ],
  submitLink: "Enviar enlace de la publicación",
  guideTitle: "Dos formas distintas de ganar",
  guide: "{post} créditos por una publicación pública aprobada, una vez por cuenta. {referral} créditos si alguien se une con su enlace y completa su primer mes pagado. Copiar, compartir o enviar una solicitud no añade nada por sí solo: el equipo revisa cada solicitud, y un referido espera a su primer pago.",

  subject: "Una herramienta útil para crecer: RepGet",
  templates: {
    linkedin:
      "Dirigir un negocio significa mantenerse visible en buscadores y redes, a menudo con demasiadas herramientas separadas.\n\nRepGet reúne SEO, visibilidad en buscadores con IA, planificación de artículos, backlinks y publicación en redes en un solo lugar.\n\nSi hacer crecer la presencia online es una prioridad, vale la pena echarle un vistazo:\n{link}\n\nEste es mi enlace de referido: puedo recibir créditos de RepGet si alguien se registra con él.\n\n#SEO #MarketingDigital #Pymes",
    facebook:
      "¿Busca una forma más sencilla de hacer crecer su negocio en internet?\n\nRepGet reúne herramientas de SEO, visibilidad en buscadores con IA, artículos, backlinks y contenido para redes, para gestionar más presencia online desde una sola plataforma.\n\nPuede verlo aquí: {link}\n\nEste es mi enlace de referido: puedo recibir créditos de RepGet si se registra con él.",
    x: "SEO + visibilidad en buscadores con IA + artículos + backlinks + redes sociales, todo en una plataforma. Descubra RepGet: {link}\n\nEnlace de referido: puedo recibir créditos de RepGet.",
    whatsapp:
      "¡Hola! Si quieres hacer crecer tu negocio en internet, echa un vistazo a RepGet. Reúne SEO, visibilidad en buscadores con IA, contenido y redes sociales en un solo lugar: {link}\n\nEs mi enlace de referido, así que puedo recibir créditos de RepGet si te registras.",
    email:
      "Hola:\n\nPensé que esto podría serle útil si está trabajando en hacer crecer su negocio en internet. RepGet reúne SEO, visibilidad en buscadores con IA, planificación de artículos, backlinks y publicación en redes.\n\nPuede verlo aquí: {link}\nMi código de referido es {code}.\n\nEs mi enlace de referido, así que puedo recibir créditos de RepGet si se registra.\n\nUn saludo,",
  },
};

const fr: EarnShareCopy = {
  jump: "Partir d’une publication déjà rédigée",
  artAlt: "Quatre personnes reliées à RepGet, et une récompense de {credits} crédits lorsqu’une personne termine son premier mois payé",
  artFriend: "Ami inscrit",
  artCredits: "Crédits",

  eyebrow: "Votre kit de partage",
  title: "Prêt à partager. Prêt à gagner.",
  body: "Choisissez une plateforme et partez d’un modèle. Chacun n’est qu’un point de départ : appropriez-vous-le, puis copiez-le.",
  flag: "+{credits} crédits",
  flagNote: "Pour une publication sociale approuvée",

  tabsTitle: "Choisissez où partager",
  tabLabels: { linkedin: "LinkedIn", facebook: "Facebook", x: "X", whatsapp: "WhatsApp", email: "E-mail" },
  draftLabels: { linkedin: "Publication LinkedIn", facebook: "Publication Facebook", x: "Publication X", whatsapp: "Message WhatsApp", email: "Message e-mail" },
  editable: "Un point de départ : modifiez-le librement",
  count: "{count} caractères",
  countLimit: "{count} sur {limit} caractères",
  xNote: "Sur X, un lien compte pour 23 caractères.",
  overLimit: "{platform} autorise {limit} caractères. Raccourcissez ce texte de {over} pour l’y ouvrir.",
  linkMissing: "Votre lien de parrainage n’est plus dans ce texte. Ajoutez-le à nouveau ou réinitialisez le texte : {link}",
  includesLink: "Contient votre lien de parrainage",
  honest: "C’est un point de départ, pas un script. Restez honnête et utilisez vos propres mots, et gardez la mention indiquant que vous pouvez recevoir des crédits.",
  copyPost: "Copier la publication",
  copyOpen: "Copier et ouvrir {platform}",
  reset: "Réinitialiser le texte",

  copied: "Copié dans le presse-papiers.",
  restored: "Message d’origine rétabli.",
  copyFailed: "Votre navigateur a bloqué la copie. Le texte est sélectionné : appuyez sur Ctrl+C (Cmd+C sur Mac) pour le copier à la main.",
  openedPrefilled: "Texte copié ; {platform} devrait s’ouvrir avec le texte déjà saisi. Rien n’est publié ni envoyé tant que vous ne le faites pas là-bas.",
  openedPaste: "Texte copié. Collez-le dans {platform}, qui devrait s’ouvrir dans un nouvel onglet. Rien n’est publié ni envoyé tant que vous ne le faites pas là-bas.",
  editNote: "Vous pouvez modifier le texte avant de publier. RepGet ne publie et n’envoie jamais rien à votre place.",

  sideEyebrow: "Comment gagner",
  sideTitle: "Partagez votre lien. Récupérez des crédits.",
  steps: [
    ["Choisissez un point de départ", "LinkedIn, Facebook, X, WhatsApp ou e-mail, puis modifiez le texte."],
    ["Copiez-la et partagez-la", "Chaque version contient déjà votre lien de parrainage personnel."],
    ["Envoyez une publication publique éligible", "Pour réclamer la récompense, la publication doit être publique et avec vos propres mots. Envoyez son adresse et l’équipe RepGet l’examinera."],
  ],
  submitLink: "Envoyer le lien de la publication",
  guideTitle: "Deux façons distinctes de gagner",
  guide: "{post} crédits pour une publication publique approuvée, une fois par compte. {referral} crédits si une personne rejoint RepGet via votre lien et termine son premier mois payé. Copier, partager ou envoyer une demande n’ajoute rien en soi : l’équipe examine chaque demande, et un parrainage attend son premier paiement.",

  subject: "Un outil de croissance utile : RepGet",
  templates: {
    linkedin:
      "Diriger une entreprise, c’est rester visible dans la recherche et sur les réseaux, souvent avec trop d’outils séparés.\n\nRepGet réunit le SEO, la visibilité dans la recherche IA, la planification d’articles, les backlinks et la publication sur les réseaux au même endroit.\n\nSi développer votre présence en ligne est une priorité, jetez-y un œil :\n{link}\n\nC’est mon lien de parrainage : je peux recevoir des crédits RepGet si vous vous inscrivez.\n\n#SEO #MarketingDigital #PME",
    facebook:
      "Vous cherchez une façon plus simple de développer votre entreprise en ligne ?\n\nRepGet réunit des outils SEO, la visibilité dans la recherche IA, des articles, des backlinks et du contenu social, pour gérer davantage votre présence en ligne depuis une seule plateforme.\n\nÀ découvrir ici : {link}\n\nC’est mon lien de parrainage : je peux recevoir des crédits RepGet si vous vous inscrivez.",
    x: "SEO + visibilité dans la recherche IA + articles + backlinks + réseaux sociaux, sur une seule plateforme. Découvrez RepGet : {link}\n\nLien de parrainage : je peux recevoir des crédits RepGet.",
    whatsapp:
      "Salut ! Si tu cherches à développer ton activité en ligne, jette un œil à RepGet. Ça réunit SEO, visibilité dans la recherche IA, contenu et réseaux sociaux au même endroit : {link}\n\nC’est mon lien de parrainage, je peux donc recevoir des crédits RepGet si tu t’inscris.",
    email:
      "Bonjour,\n\nJ’ai pensé que cela pourrait vous être utile si vous travaillez à développer votre entreprise en ligne. RepGet réunit le SEO, la visibilité dans la recherche IA, la planification d’articles, les backlinks et la publication sur les réseaux.\n\nVous pouvez le découvrir ici : {link}\nMon code de parrainage est {code}.\n\nC’est mon lien de parrainage, je peux donc recevoir des crédits RepGet si vous vous inscrivez.\n\nBien cordialement,",
  },
};

const it: EarnShareCopy = {
  jump: "Parta da un post già scritto",
  artAlt: "Quattro persone collegate a RepGet, e un premio di {credits} crediti quando qualcuno completa il primo mese pagato",
  artFriend: "Amico iscritto",
  artCredits: "Crediti",

  eyebrow: "Il Suo kit di condivisione",
  title: "Pronto da condividere. Pronto a guadagnare.",
  body: "Scelga una piattaforma e parta da un modello. Ognuno è solo un punto di partenza: lo faccia Suo, poi lo copi.",
  flag: "+{credits} crediti",
  flagNote: "Per un post social approvato",

  tabsTitle: "Scelga dove condividere",
  tabLabels: { linkedin: "LinkedIn", facebook: "Facebook", x: "X", whatsapp: "WhatsApp", email: "Email" },
  draftLabels: { linkedin: "Post LinkedIn", facebook: "Post Facebook", x: "Post X", whatsapp: "Messaggio WhatsApp", email: "Messaggio email" },
  editable: "Un punto di partenza: lo modifichi liberamente",
  count: "{count} caratteri",
  countLimit: "{count} di {limit} caratteri",
  xNote: "Su X un link conta come 23 caratteri.",
  overLimit: "{platform} consente {limit} caratteri. Accorci il testo di {over} per aprirlo lì.",
  linkMissing: "Il Suo link di referral non è più in questo testo. Lo aggiunga di nuovo o ripristini il testo: {link}",
  includesLink: "Contiene il Suo link di referral",
  honest: "È un punto di partenza, non un copione. Sia onesto e usi parole Sue, e mantenga la nota che può ricevere crediti.",
  copyPost: "Copia post",
  copyOpen: "Copia e apri {platform}",
  reset: "Ripristina testo",

  copied: "Copiato negli appunti.",
  restored: "Messaggio originale ripristinato.",
  copyFailed: "Il browser ha bloccato la copia. Il testo è selezionato: prema Ctrl+C (Cmd+C su Mac) per copiarlo a mano.",
  openedPrefilled: "Testo copiato; {platform} dovrebbe aprirsi con il testo già inserito. Nulla viene pubblicato o inviato finché non lo fa Lei.",
  openedPaste: "Testo copiato. Lo incolli in {platform}, che dovrebbe aprirsi in una nuova scheda. Nulla viene pubblicato o inviato finché non lo fa Lei.",
  editNote: "Può modificare il testo prima di pubblicarlo. RepGet non pubblica né invia mai nulla al posto Suo.",

  sideEyebrow: "Come guadagnare",
  sideTitle: "Condivida il link. Riceva crediti.",
  steps: [
    ["Scelga un punto di partenza", "LinkedIn, Facebook, X, WhatsApp o email, poi modifichi il testo."],
    ["Lo copi e lo condivida", "Ogni versione contiene già il Suo link di referral personale."],
    ["Invii un post pubblico idoneo", "Per richiedere il premio, il post deve essere pubblico e con parole Sue. Invii l’indirizzo e il team RepGet lo esaminerà."],
  ],
  submitLink: "Invia il link del post",
  guideTitle: "Due modi distinti per guadagnare",
  guide: "{post} crediti per un post pubblico approvato, una volta per account. {referral} crediti se qualcuno si iscrive con il Suo link e completa il primo mese pagato. Copiare, condividere o inviare una richiesta non aggiunge nulla di per sé: il team esamina ogni richiesta, e un referral attende il primo pagamento.",

  subject: "Uno strumento utile per crescere: RepGet",
  templates: {
    linkedin:
      "Gestire un’attività significa restare visibili nella ricerca e sui social, spesso con troppi strumenti separati.\n\nRepGet riunisce SEO, visibilità nella ricerca con IA, pianificazione degli articoli, backlink e pubblicazione sui social in un unico posto.\n\nSe far crescere la presenza online è una priorità, vale la pena dare un’occhiata:\n{link}\n\nQuesto è il mio link di referral: posso ricevere crediti RepGet se qualcuno si iscrive.\n\n#SEO #MarketingDigitale #PMI",
    facebook:
      "Cerca un modo più semplice per far crescere la Sua attività online?\n\nRepGet riunisce strumenti SEO, visibilità nella ricerca con IA, articoli, backlink e contenuti social, per gestire più presenza online da un’unica piattaforma.\n\nPuò dare un’occhiata qui: {link}\n\nQuesto è il mio link di referral: posso ricevere crediti RepGet se si iscrive.",
    x: "SEO + visibilità nella ricerca con IA + articoli + backlink + social, tutto in una piattaforma. Scopri RepGet: {link}\n\nLink di referral: posso ricevere crediti RepGet.",
    whatsapp:
      "Ciao! Se vuoi far crescere la tua attività online, dai un’occhiata a RepGet. Riunisce SEO, visibilità nella ricerca con IA, contenuti e social in un unico posto: {link}\n\nÈ il mio link di referral, quindi posso ricevere crediti RepGet se ti iscrivi.",
    email:
      "Buongiorno,\n\nHo pensato che potesse esserLe utile se sta lavorando per far crescere la Sua attività online. RepGet riunisce SEO, visibilità nella ricerca con IA, pianificazione degli articoli, backlink e pubblicazione sui social.\n\nPuò scoprirlo qui: {link}\nIl mio codice di referral è {code}.\n\nÈ il mio link di referral, quindi posso ricevere crediti RepGet se si iscrive.\n\nCordiali saluti,",
  },
};

const de: EarnShareCopy = {
  jump: "Mit einem fertigen Beitrag beginnen",
  artAlt: "Vier Personen, verbunden mit RepGet, und eine Prämie von {credits} Credits, wenn jemand den ersten bezahlten Monat abschließt",
  artFriend: "Freund angemeldet",
  artCredits: "Credits",

  eyebrow: "Ihr Teilen-Kit",
  title: "Bereit zum Teilen. Bereit zum Verdienen.",
  body: "Wählen Sie eine Plattform und beginnen Sie mit einer Vorlage. Jede ist nur ein Ausgangspunkt: Machen Sie sie zu Ihrer eigenen und kopieren Sie sie dann.",
  flag: "+{credits} Credits",
  flagNote: "Für einen genehmigten Social-Beitrag",

  tabsTitle: "Wählen Sie, wo Sie teilen",
  tabLabels: { linkedin: "LinkedIn", facebook: "Facebook", x: "X", whatsapp: "WhatsApp", email: "E-Mail" },
  draftLabels: { linkedin: "LinkedIn-Beitrag", facebook: "Facebook-Beitrag", x: "X-Beitrag", whatsapp: "WhatsApp-Nachricht", email: "E-Mail-Nachricht" },
  editable: "Ein Ausgangspunkt: frei bearbeitbar",
  count: "{count} Zeichen",
  countLimit: "{count} von {limit} Zeichen",
  xNote: "Auf X zählt ein Link als 23 Zeichen.",
  overLimit: "{platform} erlaubt {limit} Zeichen. Kürzen Sie den Text um {over}, um ihn dort zu öffnen.",
  linkMissing: "Ihr Empfehlungslink steht nicht mehr in diesem Text. Fügen Sie ihn wieder ein oder setzen Sie den Text zurück: {link}",
  includesLink: "Enthält Ihren Empfehlungslink",
  honest: "Das ist ein Ausgangspunkt, kein Skript. Bleiben Sie ehrlich und bei Ihren eigenen Worten, und behalten Sie den Hinweis, dass Sie Credits erhalten können.",
  copyPost: "Beitrag kopieren",
  copyOpen: "Kopieren & {platform} öffnen",
  reset: "Text zurücksetzen",

  copied: "In die Zwischenablage kopiert.",
  restored: "Ursprüngliche Nachricht wiederhergestellt.",
  copyFailed: "Ihr Browser hat das Kopieren blockiert. Der Text ist markiert: Drücken Sie Strg+C (Cmd+C auf dem Mac), um ihn von Hand zu kopieren.",
  openedPrefilled: "Text kopiert; {platform} sollte sich mit dem ausgefüllten Text öffnen. Nichts wird veröffentlicht oder gesendet, bevor Sie es dort selbst tun.",
  openedPaste: "Text kopiert. Fügen Sie ihn in {platform} ein, das sich in einem neuen Tab öffnen sollte. Nichts wird veröffentlicht oder gesendet, bevor Sie es dort selbst tun.",
  editNote: "Sie können den Text vor dem Posten bearbeiten. RepGet postet oder sendet nie etwas für Sie.",

  sideEyebrow: "So verdienen Sie",
  sideTitle: "Link teilen. Credits sammeln.",
  steps: [
    ["Wählen Sie einen Ausgangspunkt", "LinkedIn, Facebook, X, WhatsApp oder E-Mail, dann bearbeiten Sie den Text."],
    ["Kopieren und teilen Sie ihn", "Jede Version enthält bereits Ihren persönlichen Empfehlungslink."],
    ["Reichen Sie einen geeigneten öffentlichen Beitrag ein", "Für die Prämie muss der Beitrag öffentlich und in Ihren eigenen Worten sein. Senden Sie seine Adresse, und das RepGet-Team prüft ihn."],
  ],
  submitLink: "Beitragslink einreichen",
  guideTitle: "Zwei getrennte Wege zu Credits",
  guide: "{post} Credits für einen genehmigten öffentlichen Beitrag, einmal pro Konto. {referral} Credits, wenn jemand über Ihren Link beitritt und den ersten bezahlten Monat abschließt. Kopieren, Teilen oder das Einreichen allein bringt nichts: Das Team prüft jede Einreichung, und eine Empfehlung wartet auf die erste Zahlung.",

  subject: "Ein nützliches Wachstumstool: RepGet",
  templates: {
    linkedin:
      "Ein Unternehmen zu führen heißt, in Suche und Social Media sichtbar zu bleiben, oft mit zu vielen getrennten Tools.\n\nRepGet vereint SEO, Sichtbarkeit in der KI-Suche, Artikelplanung, Backlinks und Social Publishing an einem Ort.\n\nWenn Online-Präsenz gerade Priorität hat, lohnt sich ein Blick:\n{link}\n\nDas ist mein Empfehlungslink: Ich kann RepGet-Credits erhalten, wenn sich jemand anmeldet.\n\n#SEO #DigitalMarketing #KMU",
    facebook:
      "Suchen Sie einen einfacheren Weg, Ihr Unternehmen online wachsen zu lassen?\n\nRepGet vereint SEO-Tools, Sichtbarkeit in der KI-Suche, Artikel, Backlinks und Social-Inhalte, damit Sie mehr von Ihrer Online-Präsenz auf einer Plattform steuern.\n\nHier ansehen: {link}\n\nDas ist mein Empfehlungslink: Ich kann RepGet-Credits erhalten, wenn Sie sich anmelden.",
    x: "SEO + Sichtbarkeit in der KI-Suche + Artikel + Backlinks + Social Publishing, alles auf einer Plattform. RepGet entdecken: {link}\n\nEmpfehlungslink: Ich kann RepGet-Credits erhalten.",
    whatsapp:
      "Hey! Falls du dein Unternehmen online wachsen lassen willst, schau dir RepGet an. Es vereint SEO, Sichtbarkeit in der KI-Suche, Inhalte und Social Publishing an einem Ort: {link}\n\nDas ist mein Empfehlungslink, ich kann also RepGet-Credits erhalten, wenn du dich anmeldest.",
    email:
      "Guten Tag,\n\nich dachte, das könnte für Sie nützlich sein, wenn Sie Ihr Unternehmen online wachsen lassen möchten. RepGet vereint SEO, Sichtbarkeit in der KI-Suche, Artikelplanung, Backlinks und Social Publishing.\n\nHier können Sie es ansehen: {link}\nMein Empfehlungscode ist {code}.\n\nDas ist mein Empfehlungslink, ich kann also RepGet-Credits erhalten, wenn Sie sich anmelden.\n\nFreundliche Grüße",
  },
};

export const EARN_SHARE_COPY: Record<Locale, EarnShareCopy> = { en, es, fr, it, de };
