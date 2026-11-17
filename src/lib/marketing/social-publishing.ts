import type { Locale } from "@/lib/i18n/config";

/**
 * The social-publishing landing page, /it/social-publishing: the destination
 * of the proposed Italian Google Ads pilot (review-reports/2026-11-16,
 * campaign package, brief "Pianifica i prossimi post social"). Italian only
 * for now (LOCALE_ONLY_PATHS in lib/i18n/config.ts); the other languages'
 * briefs are future candidates and take the same shape.
 *
 * EVERY CLAIM IS ONE THE PRODUCT BACKS, checked against the code on
 * 2026-11-16:
 *  - Publishing is the "Contenuti social" product (/websites/<id>/videos):
 *    RepGet makes a Reel or a carousel (5-7 slides of 1080x1350) from an
 *    idea its AI writes and the customer approves (lib/video/formats.ts),
 *    and publishes it to the channels connected there (VIDEO_PLATFORMS).
 *  - THE PROMISE IS CONTENT REPGET CREATES, scheduled by the customer - not
 *    a scheduler for posts made elsewhere (review of PR #133, 2026-11-17).
 *    Title, intro and metadata say so, and the scope box and first question
 *    say plainly what cannot be done.
 *  - STORIES ARE NOT ADVERTISED. The product makes them (one file, no
 *    caption) and bundle.social lists Instagram Stories, but Meta's own rules
 *    for which professional accounts may publish Stories through the API
 *    could not be read (developers.facebook.com unreachable, 2026-11-17).
 *    Add them back once publishing one is verified with a real account.
 *  - There is NO upload-your-own-post scheduler: a finished photo plus a
 *    caption cannot be scheduled. The customer's own pictures or clips can
 *    be added to an idea before it is made (addMediaToIdea), and the page
 *    says so plainly rather than implying a general Instagram scheduler.
 *  - The caption is editable until the content is made (editVideoIdea only
 *    accepts "new" or "failed"), then shown read-only.
 *  - Publish now, at the next best time, or at a chosen date and time up to
 *    60 days ahead (lib/video/publish-actions.ts); a schedule can be undone.
 *    Automatic publishing is opt-in (publishMode defaults to "manual"), at
 *    most MAX_POSTS_PER_DAY (3) per channel a day.
 *  - Statuses are the app's own words (lib/i18n/videos.ts): Pronto,
 *    Programmato, Pubblicazione, Pubblicato.
 *  - Instagram: the page asks for a professional (Business or Creator)
 *    account, as guidance rather than a statement of Meta's rules (not
 *    re-read from Meta). RepGet requests no connection method by default, so
 *    bundle.social's applies; its docs describe Facebook Login, with a
 *    Facebook Page to pick, as its default path, and Reels' native music only
 *    through Facebook Login (info.bundle.social, oauth-options and the
 *    Instagram pages, read 2026-11-17). Hence "may" ask for a Page.
 *  - Every plan includes it (lib/i18n/home/pricing.ts "Pubblicazione
 *    social"), and a trialing subscription is entitled like a paid one
 *    (videoAccess). No price, no trial length and no offer is written here:
 *    whether a checkout offers a trial depends on the workspace, and prices
 *    live on the pricing page and the checkout.
 *  - Making approved content uses plan credits, returned if it fails; the
 *    credit price is an admin setting, so no number is given.
 *
 * No customer results, reach, follower or ranking claims, no competitor
 * comparisons and no account screenshots: there are none to show truthfully.
 */

export const SOCIAL_PUBLISHING_PATH = "/social-publishing";

export type SocialPublishingCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: { label: string; href: string };
  scope: { title: string; can: string[]; cannot: string[]; canLabel: string; cannotLabel: string };
  stepsTitle: string;
  steps: { title: string; body: string }[];
  statusTitle: string;
  statusBody: string;
  statuses: string[];
  detailsTitle: string;
  details: { title: string; body: string }[];
  faqTitle: string;
  faq: { question: string; answer: string }[];
  closingTitle: string;
  closingBody: string;
};

const IT: SocialPublishingCopy = {
  metaTitle: "Reel e caroselli creati con l’IA da RepGet, da programmare sui Suoi social",
  metaDescription:
    "RepGet crea con l’IA Reel e caroselli con didascalia a partire dal Suo sito. Lei li rivede e li programma sui canali collegati: subito, all’orario migliore o in una data scelta.",
  eyebrow: "Contenuti social creati con l’IA",
  title: "RepGet crea i Suoi contenuti social. Lei sceglie quando pubblicarli",
  intro:
    "Dal Suo sito RepGet realizza con l’IA Reel e caroselli con didascalia. Lei li rivede, collega i canali e li programma. Non serve per programmare post già pronti creati altrove: quelli non si possono caricare.",
  primaryCta: "Crei il Suo account RepGet",
  secondaryCta: { label: "Veda piani e prezzi", href: "/pricing" },
  scope: {
    title: "Cosa crea e programma RepGet",
    canLabel: "Sì",
    cannotLabel: "Non incluso",
    can: [
      "Reel con didascalia, realizzati da RepGet con l’IA a partire da un’idea che Lei approva",
      "Caroselli di 5–7 immagini con didascalia, realizzati allo stesso modo",
      "Sue foto o clip aggiunte a un’idea prima della realizzazione",
      "Pubblicazione subito, all’orario migliore o in una data e un’ora scelte",
    ],
    cannot: [
      "Caricare un post già pronto, creato altrove (una Sua foto con la Sua didascalia), e programmarlo così com’è",
      "Modificare la didascalia dopo che il contenuto è stato realizzato",
    ],
  },
  stepsTitle: "Dall’idea alla pubblicazione, in cinque passaggi",
  steps: [
    {
      title: "Crei i contenuti",
      body: "RepGet propone idee a partire dal Suo sito, ognuna con titolo, testo e didascalia. Sceglie il formato, Reel o carosello, e approva quelle da realizzare.",
    },
    {
      title: "Li riveda e li modifichi",
      body: "Prima della realizzazione può cambiare titolo, testo, didascalia e formato, e aggiungere Sue foto o clip. Con le impostazioni predefinite nulla viene pubblicato senza la Sua conferma.",
    },
    {
      title: "Colleghi i Suoi account",
      body: "Dalla pagina Contenuti social collega Instagram, TikTok, YouTube, Facebook, Pinterest, LinkedIn o X accedendo con l’account della piattaforma: RepGet non riceve la Sua password.",
    },
    {
      title: "Programmi la pubblicazione",
      body: "Pubblica subito, all’orario migliore o in una data e un’ora scelte, fino a 60 giorni in anticipo. Una programmazione si può annullare. Se lo desidera, attiva la pubblicazione automatica con la frequenza che preferisce.",
    },
    {
      title: "Controlli lo stato",
      body: "Ogni contenuto mostra il suo stato e, una volta pubblicato, su quali canali è uscito.",
    },
  ],
  statusTitle: "Gli stati che vede nell’app",
  statusBody: "Le stesse parole della pagina Contenuti social, per ogni contenuto e per ogni canale.",
  statuses: ["Pronto", "Programmato", "Pubblicazione", "Pubblicato"],
  detailsTitle: "Prima di iniziare",
  details: [
    {
      title: "Account Instagram",
      body: "Colleghi un account Instagram professionale (Business o Creator); un profilo personale si converte nelle impostazioni di Instagram. Il collegamento può passare dall’accesso con Facebook e chiederLe di scegliere una Pagina Facebook.",
    },
    {
      title: "Formati per canale",
      body: "Su Instagram RepGet pubblica Reel e caroselli. Non tutti i formati sono disponibili su ogni canale: Pinterest, per esempio, riceve solo video. L’app indica quali canali accettano il formato scelto.",
    },
    {
      title: "Piani e prova",
      body: "Contenuti social è incluso in tutti i piani RepGet: Launch, Grow e Scale. Se al momento dell’acquisto Le viene offerto un periodo di prova, la funzione è disponibile anche durante la prova. Prezzi e condizioni sono nella pagina dei piani e al checkout.",
    },
    {
      title: "Crediti e limiti",
      body: "Realizzare un contenuto approvato usa crediti del piano; se la realizzazione non riesce, il credito viene restituito. RepGet pubblica al massimo 3 contenuti al giorno per canale.",
    },
  ],
  faqTitle: "Domande frequenti",
  faq: [
    {
      question: "Posso programmare un post Instagram che ho già pronto?",
      answer:
        "No. RepGet programma i contenuti che realizza per Lei, Reel e caroselli. Può aggiungere Sue foto o clip a un’idea prima della realizzazione, ma non caricare un post finito, creato altrove, e pubblicarlo così com’è.",
    },
    {
      question: "Che tipo di account Instagram serve?",
      answer:
        "Un account professionale, Business o Creator. Il collegamento può passare dall’accesso con Facebook e chiederLe di scegliere una Pagina Facebook. La musica nativa di Instagram nei Reel richiede il collegamento tramite Facebook.",
    },
    {
      question: "RepGet pubblica qualcosa senza la mia approvazione?",
      answer:
        "No, con le impostazioni predefinite ogni contenuto aspetta che Lei lo pubblichi o lo programmi. La pubblicazione automatica si attiva solo se la sceglie Lei nelle impostazioni, e riguarda solo contenuti già realizzati.",
    },
    {
      question: "Posso modificare la didascalia?",
      answer:
        "Sì, prima che il contenuto venga realizzato: titolo, testo, didascalia e formato si modificano dall’idea. Dopo la realizzazione la didascalia resta quella approvata.",
    },
    {
      question: "Su quali canali posso pubblicare?",
      answer:
        "Instagram, TikTok, YouTube, Facebook, Pinterest, LinkedIn e X, collegati dalla pagina Contenuti social. Ogni canale accetta i formati che supporta.",
    },
    {
      question: "Dove vedo se un post è stato pubblicato?",
      answer:
        "Nella pagina Contenuti social: ogni contenuto è Pronto, Programmato, in Pubblicazione o Pubblicato, con la data programmata e i canali su cui è uscito.",
    },
    {
      question: "È incluso nel mio piano?",
      answer:
        "Sì, in tutti i piani RepGet. La realizzazione dei contenuti approvati usa crediti del piano. I prezzi aggiornati sono nella pagina dei piani.",
    },
  ],
  closingTitle: "Lasci a RepGet la creazione dei prossimi post",
  closingBody: "Crei un account, colleghi il Suo sito e i Suoi canali, approvi i contenuti e scelga quando pubblicarli.",
};

const COPY: Partial<Record<Locale, SocialPublishingCopy>> = { it: IT };

/** The page's words in a language it exists in, or null (the route answers 404). */
export function socialPublishingCopy(locale: Locale): SocialPublishingCopy | null {
  return COPY[locale] ?? null;
}
