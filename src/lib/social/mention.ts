import { namesBrand } from "./rules";
import type { SocialPlatform } from "./platforms";

/**
 * WHEN A REPLY MAY NAME THE BUSINESS (Daniel, 2026-11-27: "Generated Reddit
 * replies are promotional. Any penalties fall on the customer... Reddit bans
 * fast"). A reply is a helpful answer from a person, and by default it never
 * names or links the business. It may name it - low-key, with the honest
 * disclosure (lib/social/rules.ts replyText) - only when ALL of these hold:
 *  - the account is past its warm-up;
 *  - the discussion itself asks for recommendations, tools, services or
 *    alternatives (asksForRecommendations);
 *  - the community is not one known to remove self-promotion
 *    (communityOf: a subreddit's name, as there is no rules text to read -
 *    discussions come from Google, not from Reddit's API);
 *  - and about one reply in MENTION_EVERY on that platform, over the last
 *    MENTION_WINDOW_DAYS, names the business (mayMention).
 * Enforced in code, not only asked of the model: suggest.ts drops a
 * disclosure written outside these conditions, and actions.ts refuses a
 * reply the customer edited to name the business outside them.
 *
 * No server imports: the Opportunities page shows the community warning too.
 */

/** At most one reply in this many names the business, per platform. */
export const MENTION_EVERY = 10;
/** The rolling window that ratio is counted over. */
export const MENTION_WINDOW_DAYS = 30;

/*
  "Which tool do you use?", "any recommendations?", "alternatives to X" -
  in the five languages websites are written in. Deliberately narrow: a
  thread that only describes a problem is answered with advice, not a name.
*/
const ASKS: RegExp[] = [
  // English
  /\brecommend(?:ation)?s?\b|\brecommend(?:ed|ing)?\b/i,
  /\b(?:any|which|what)\s+(?:good\s+|decent\s+|reliable\s+)?(?:tools?|apps?|software|services?|agenc(?:y|ies)|platforms?|compan(?:y|ies)|providers?|plugins?|vendors?|freelancers?|studios?)\b/i,
  /\balternatives?\s+(?:to|for)\b/i,
  /\b(?:suggestions?|options)\s+for\b/i,
  /\b(?:who|what)\s+do\s+(?:you|y'all|people)\s+use\b/i,
  /\bcan\s+(?:anyone|someone|you)\s+(?:suggest|recommend)\b/i,
  /\blooking\s+for\s+(?:a|an)\s+(?:good\s+)?(?:tool|app|service|agency|company|provider|freelancer|studio|platform|plugin)\b/i,
  /\bbest\s+(?:tools?|apps?|software|services?|agenc(?:y|ies)|platforms?|plugins?)\s+for\b/i,
  // Spanish
  /\brecomiend(?:a|an|as|e|en)\b|\brecomendaci(?:ón|ones)\b|\brecomendáis\b/i,
  /\b(?:alguna|algún|qué|que|cuál|cual)\s+(?:herramienta|app|aplicación|programa|agencia|empresa|servicio|plataforma|plugin)s?\b/i,
  /\balternativas?\s+a\b/i,
  /\bbusco\s+(?:una?\s+)?(?:herramienta|agencia|empresa|servicio|app|programa)\b/i,
  // French
  /\brecommand(?:ez|er|ation|ations|eriez)\b|\bvous\s+conseillez\b|\bme\s+conseiller\b/i,
  /\bquel(?:le)?s?\s+(?:outils?|logiciels?|applis?|applications?|agences?|services?|prestataires?|plateformes?)\b/i,
  /\balternatives?\s+à\s/i,
  /\bje\s+cherche\s+(?:un|une)\s+(?:outil|logiciel|agence|prestataire|service)\b/i,
  // Italian
  /\bmi\s+consigli(?:ate|ereste|i)\b|\bconsigli\s+su\b|\braccomand(?:ate|azioni)\b/i,
  /\b(?:qual(?:e|i)|che)\s+(?:strumenti?|software|app|agenzi(?:a|e)|servizi?|piattaform(?:a|e)|plugin)\b/i,
  /\balternativ[ae]\s+a\b/i,
  /\bcerco\s+(?:un|una|uno)\s+(?:strumento|software|agenzia|servizio|app)\b/i,
  // German
  /\bempfehl(?:en|ung|ungen|t)\b|\bempfiehlt\b/i,
  /\bwelche(?:s|n|r)?\s+(?:tools?|software|apps?|agentur(?:en)?|anbieter|dienste?|plattform(?:en)?|plugins?)\b/i,
  /\balternativen?\s+zu\b/i,
  /\bsuche\s+(?:ein|eine|einen)\s+(?:tool|agentur|anbieter|dienst|software|app)\b/i,
];

/** Whether a discussion asks for recommendations, tools, services or alternatives. */
export function asksForRecommendations(text: string): boolean {
  return ASKS.some((pattern) => pattern.test(text));
}

/*
  Large subreddits whose rules remove self-promotion (checked by name: no
  rules text is fetched). Lower case. A name that says it is for questions
  or help is treated the same way: people there want answers, not vendors.
*/
const NO_PROMOTION_SUBREDDITS = new Set([
  "askreddit",
  "explainlikeimfive",
  "lifeprotips",
  "legaladvice",
  "personalfinance",
  "entrepreneur",
  "smallbusiness",
  "startups",
  "marketing",
  "digital_marketing",
  "digitalmarketing",
  "socialmedia",
  "seo",
  "bigseo",
  "techseo",
  "webdev",
  "web_design",
  "wordpress",
  "freelance",
  "sales",
  "ecommerce",
  "shopify",
  "photography",
  "weddingplanning",
  "realestate",
  "fitness",
  "cooking",
  "travel",
]);
const QUESTION_COMMUNITY = /^ask|ask$|help|advice|questions|noob|beginners?$|support$|nopromo|noselfpromo/i;

export type Community = {
  /** "r/name" on Reddit; null where a platform has no communities with their own rules. */
  name: string | null;
  /** Where its rules are read. */
  rulesUrl: string | null;
  /** Known (or named) to remove self-promotion: the business is never named there. */
  noPromotion: boolean;
};

/** The community a discussion belongs to, and whether it is known to remove self-promotion. */
export function communityOf(platform: SocialPlatform | string, threadUrl: string | null | undefined): Community {
  if (platform !== "reddit" || !threadUrl) return { name: null, rulesUrl: null, noPromotion: false };
  const subreddit = threadUrl.match(/reddit\.com\/r\/([A-Za-z0-9_]{2,21})(?:\/|$)/i)?.[1];
  if (!subreddit) return { name: null, rulesUrl: null, noPromotion: false };
  const key = subreddit.toLowerCase();
  return {
    name: `r/${subreddit}`,
    rulesUrl: `https://www.reddit.com/r/${subreddit}/about/rules/`,
    noPromotion: NO_PROMOTION_SUBREDDITS.has(key) || QUESTION_COMMUNITY.test(key),
  };
}

/** A platform's replies in the window: how many were posted, and how many of them named the business. */
export type MentionHistory = { posted: number; mentions: number };

/** Counts a platform's replies posted in the window, and those that named the business. */
export function mentionHistory(
  replies: { body: string; postedAt: Date | null }[],
  brand: { brandName?: string | null; domain: string },
  now: Date,
): MentionHistory {
  const since = now.getTime() - MENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = replies.filter((reply) => reply.postedAt && reply.postedAt.getTime() >= since);
  return { posted: recent.length, mentions: recent.filter((reply) => namesBrand(reply.body, brand)).length };
}

/**
 * Whether one more reply may name the business: past the warm-up, in a
 * discussion that asks for recommendations, in a community that allows it,
 * and while that keeps the platform's mentions to one reply in MENTION_EVERY
 * (counting this one: the first is allowed after nine replies that named
 * nothing).
 */
export function mayMention(input: {
  warmup: boolean;
  asks: boolean;
  noPromotion: boolean;
  history: MentionHistory;
}): boolean {
  if (input.warmup || !input.asks || input.noPromotion) return false;
  return (input.history.mentions + 1) * MENTION_EVERY <= input.history.posted + 1;
}

/*
  What a person helping in a thread does not write: calls to action, sales
  words. A reply with any of them is dropped, whatever the model meant.
*/
const PROMOTIONAL: RegExp[] = [
  /\b(?:check\s+(?:us|me|it)\s+out|dm\s+me|message\s+me|hit\s+me\s+up|sign\s+up|free\s+trial|book\s+a\s+(?:call|demo|consultation)|link\s+in\s+(?:my\s+)?bio|visit\s+(?:our|my)\s+(?:site|website|page|shop|store)|use\s+(?:my|the)\s+code|discount\s+code|promo\s+code|limited[- ]time|game[- ]changer|best[- ]in[- ]class|cutting[- ]edge|world[- ]class|supercharge|skyrocket|unlock\s+your|elevate\s+your|feel\s+free\s+to\s+reach\s+out|reach\s+out\s+to\s+(?:us|me))\b/i,
  /\b(?:escr[ií]beme|cont[aá]cta(?:me|nos)|prueba\s+gratis|visita\s+(?:nuestra|mi)\s+(?:web|página|tienda)|c[oó]digo\s+de\s+descuento)\b/i,
  /(?:[ée]crivez[- ]moi|contactez[- ](?:moi|nous)|essai\s+gratuit|visitez\s+(?:notre|mon)\s+site|code\s+promo)\b/i,
  /\b(?:scrivimi|contattami|contattateci|prova\s+gratuita|visita\s+il\s+(?:nostro|mio)\s+sito|codice\s+sconto)\b/i,
  /\b(?:schreib\s+mir|kontaktiere\s+(?:mich|uns)|kostenlos\s+testen|besuche\s+(?:unsere|meine)\s+(?:website|seite)|rabattcode|gutscheincode)\b/i,
];

/** Whether a reply reads like an advert rather than a person helping. */
export function soundsPromotional(text: string): boolean {
  return PROMOTIONAL.some((pattern) => pattern.test(text));
}

/**
 * A reply in the way people type: no long dashes (the most recognisable
 * mark of machine-written text), no runs of blank lines.
 */
export function naturalise(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
