import type { FactClaim, ProductionChoices, ReviewReason, ReviewStatus, ShotPlan, VideoScript } from "./formats";

/**
 * Factual honesty and brand safety for video ideas (client, 2026-11-12:
 * "Never invent facts, statistics, customer testimonials or results ...
 * core protections ... must remain active regardless of customer
 * preferences").
 *
 * The core protections are prompt rules that are not settings (lib/video/
 * strategy/prompt.ts). What is checked here, after the writer:
 *  - claims: each factual statement and its source in the material
 *    ("article:N" for the N-th public article given, "profile" for the
 *    business profile and Brand Voice facts); a source that is not in the
 *    material is dropped (null);
 *  - review: an unsourced figure, ranking or comparison needs a person's
 *    check (requireFactReview), a controversial angle an approval
 *    (requireControversyReview), and a legally/medically/financially
 *    sensitive topic always does;
 *  - an approval holds for the content it was given on: contentHash.
 *
 * No server imports: the Videos page shows the same state.
 */

export type ReviewSettings = { requireFactReview: boolean; requireControversyReview: boolean };

/** The parts of an idea that are published words. */
export type ReviewedContent = {
  script: VideoScript;
  caption: string;
  plan?: ShotPlan | null;
  production?: Pick<ProductionChoices, "ctaText"> | null;
};

/* 53-bit string hash (cyrb53): stable across Node and browsers, no imports. Not for security. */
function hash53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * A fingerprint of everything an approval vouches for: the script (its
 * figures included), the caption, the plan's on-screen texts (top captions
 * and reaction beats) and the closing CTA. Field order is fixed, so the same
 * content always gives the same hash.
 */
export function contentHash(idea: ReviewedContent): string {
  const script = idea.script;
  const canonical = JSON.stringify([
    script?.hook ?? "",
    (script?.points ?? []).map((point) => [point.title, point.detail, point.stat ? [point.stat.value, point.stat.suffix, point.stat.label] : null]),
    script?.proof ?? "",
    script?.cta ?? "",
    idea.caption ?? "",
    (idea.plan?.scenes ?? []).map((scene) => [scene.overlay ?? null, scene.reaction ?? null]),
    idea.production?.ctaText ?? null,
  ]);
  return `v1:${hash53(canonical)}${hash53(canonical, 7)}`;
}

export type ReviewState = ReviewedContent & { reviewStatus: string; reviewedHash: string | null };

/** Whether automatic publishing must wait for a person: review required, or approved for different content. */
export function reviewBlocksAutoPublish(idea: ReviewState): boolean {
  if (idea.reviewStatus === "required") return true;
  if (idea.reviewStatus === "approved") return idea.reviewedHash !== contentHash(idea);
  return false;
}

/* ------------------------------------------------------------- detection */

/** A figure: a number with a unit, a currency or a percentage (not a listicle's "3 tips"). */
const FIGURE =
  /(\d[\d.,]*\s*(%|‰|x\b|×|times\b|percent|per cent|procent|por ciento|per cento|pour cent|prozent|years?\b|ani\b|años\b|anni\b|ans\b|jahre\b|jaar\b|lat\b|clients?\b|customers?\b|clienți|clienti|clientes|kunden|klant|€|\$|£|eur\b|euro|usd\b|lei\b|ron\b|zł|pln\b|[km]\b|\+))|([€$£]\s*\d)/i;
/** Rankings and comparisons, in the content languages RepGet writes. */
const RANKING =
  /(#\s?1\b|\bnumber one\b|\bno\.? ?1\b|\bbest\b|\bleading\b|\bcheapest\b|\bfastest\b|\blargest\b|\bbiggest\b|\bthe only\b|\bbetter than\b|\bfaster than\b|\bcheaper than\b|\bversus\b|\bvs\.?\s|\bcompared (to|with)\b|cel mai bun|mai bun decât|mejor que|el mejor|il migliore|migliore di|le meilleur|meilleur que|der beste|besser als|o melhor|melhor que|de beste|beter dan|najlepsz|lepszy niż)/i;

export const hasFigure = (text: string) => FIGURE.test(text);
export const hasRankingOrComparison = (text: string) => RANKING.test(text);
const isFactual = (text: string) => hasFigure(text) || hasRankingOrComparison(text);

/** "article:3" -> 3; any other text -> null. */
const articleNumber = (source: string) => {
  const match = /^article:(\d{1,3})$/.exec(source.trim());
  return match ? Number(match[1]) : null;
};

/** The material the writer was given, as text: each article's (in order, "article:1" first) and the profile's. */
export type ClaimMaterial = { articles: string[]; profile: string };

/** The numbers in a text ("40", "1,200", "3.5"), without a trailing full stop or comma. */
const numbersIn = (text: string) => text.match(/\d(?:[\d.,]*\d)?/g) ?? [];

/**
 * The writer's claims with their sources checked against the material given:
 * a source that was not given becomes null, and so does one that does not
 * contain the claim's figures - a number "from article 2" must be in what
 * article 2 said.
 */
export function checkClaims(claims: FactClaim[], material: ClaimMaterial): FactClaim[] {
  return claims
    .filter((claim) => claim && typeof claim.text === "string" && claim.text.trim())
    .slice(0, 12)
    .map((claim) => {
      const text = claim.text.replace(/\s+/g, " ").trim().slice(0, 240);
      const raw = typeof claim.source === "string" ? claim.source.trim() : null;
      const n = raw ? articleNumber(raw) : null;
      const source = raw === "profile" ? "profile" : n !== null && n >= 1 && n <= material.articles.length ? `article:${n}` : null;
      if (!source) return { text, source: null };
      const said = source === "profile" ? material.profile : material.articles[(n ?? 1) - 1];
      const stated = numbersIn(text).every((number) => said.includes(number));
      return { text, source: stated ? source : null };
    });
}

/** The published words of a script and caption, one string. */
export function publishedText(content: ReviewedContent): string {
  const script = content.script;
  return [
    script.hook,
    ...script.points.flatMap((point) => [point.title, point.detail, point.stat ? `${point.stat.value}${point.stat.suffix} ${point.stat.label}` : ""]),
    script.proof,
    script.cta,
    content.caption,
    ...(content.plan?.scenes ?? []).flatMap((scene) => [scene.overlay ?? "", scene.reaction ?? ""]),
    content.production?.ctaText ?? "",
  ].join("\n");
}

/** Figures in the text that no sourced claim states. */
function unsourcedFigures(content: ReviewedContent, claims: FactClaim[]): boolean {
  const sourced = claims.filter((claim) => claim.source).map((claim) => claim.text);
  const covered = new Set(sourced.flatMap(numbersIn));
  const lines = publishedText(content).split("\n").filter(hasFigure);
  if (content.script.points.some((point) => point.stat && !covered.has(String(point.stat.value)))) return true;
  return lines.some((line) => numbersIn(line).some((number) => !covered.has(number)));
}

export type ReviewInput = {
  content: ReviewedContent;
  claims: FactClaim[];
  /** The writer's flags: a provocative/hot-take angle; a legal, medical, financial or safety topic. */
  controversial: boolean;
  sensitive: boolean;
  techniques: string[];
};

export type ReviewOutcome = { reviewStatus: ReviewStatus; reviewReasons: ReviewReason[] };

/** What a new idea needs before automatic publishing. */
export function assessReview(input: ReviewInput, settings: ReviewSettings): ReviewOutcome {
  const reasons = new Set<ReviewReason>();
  if (settings.requireFactReview) {
    const unsourced = input.claims.some((claim) => !claim.source && isFactual(claim.text));
    if (unsourced || unsourcedFigures(input.content, input.claims)) reasons.add("unverified_claim");
  }
  if (settings.requireControversyReview && (input.controversial || input.techniques.includes("hot_takes"))) reasons.add("controversial");
  // Not a setting: a sensitive topic is always checked by a person.
  if (input.sensitive) reasons.add("sensitive");
  const reviewReasons = [...reasons];
  return { reviewStatus: reviewReasons.length > 0 ? "required" : "none", reviewReasons };
}

/**
 * The review state after an edit: the reasons it had, plus a figure the edit
 * added that no sourced claim states; approved only while the content is the
 * one approved. An edit never clears a reason by itself.
 */
export function reviewAfterEdit(
  idea: { reviewStatus: string; reviewReasons: string[]; reviewedHash: string | null; claims: FactClaim[] },
  next: ReviewedContent,
  settings: ReviewSettings,
): ReviewOutcome {
  const reasons = new Set(idea.reviewReasons.filter((reason): reason is ReviewReason => ["unverified_claim", "controversial", "sensitive"].includes(reason)));
  if (settings.requireFactReview && unsourcedFigures(next, idea.claims)) reasons.add("unverified_claim");
  const reviewReasons = [...reasons];
  if (reviewReasons.length === 0) return { reviewStatus: idea.reviewStatus === "approved" ? "approved" : "none", reviewReasons };
  const stillApproved = idea.reviewStatus === "approved" && idea.reviewedHash === contentHash(next);
  return { reviewStatus: stillApproved ? "approved" : "required", reviewReasons };
}

/* --------------------------------------------------- trends and promises */

/**
 * Claims of current popularity without trend data (client: "Never label
 * something as currently trending unless we actually have verified data").
 * Phase 1 has no trend data, so any of these is refused.
 */
const TREND_PHRASES = [
  "trending", "viral right now", "going viral", "trend alert", "everyone is doing this", "everyone is talking about this", "the latest trend", "hottest trend", "in trend",
  "în trend", "la modă acum", "en tendencia", "es tendencia", "tendencia del momento", "di tendenza", "va di moda", "en tendance", "à la mode en ce moment",
  "im trend", "gerade angesagt", "em alta", "em tendência", "na czasie", "modne teraz",
];
/** A phrase as a whole word in any script (\b only knows ASCII letters: "în" would never match). */
const TREND_CLAIM = new RegExp(`(?<![\\p{L}\\p{N}])(${TREND_PHRASES.join("|")})(?![\\p{L}\\p{N}])`, "iu");

/** Promises of a result no one can promise (client: "It does not guarantee views ... or a viral result"). */
const PROMISE = /(\bguarantee[ds]?\b|\bwill go viral\b|\bgoes viral\b|\bmillions? of views\b|\bsure to (go|be) viral\b|\b100% (viral|views)\b|\bgarantat|\bgarantiz|\bgarantit|\bgaranti|\bgarantiert|\bgwarant)/i;

export const assertsTrend = (text: string) => TREND_CLAIM.test(text);
export const promisesResult = (text: string) => PROMISE.test(text);

/** The text without its sentences that claim a trend or promise a result; null when nothing is left. */
export function withoutClaimsOfTrendOrPromise(text: string | null): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((sentence) => !assertsTrend(sentence) && !promisesResult(sentence));
  const out = kept.join(" ").trim();
  return out || null;
}

/** Hashtags that claim popularity (#trending, #viral...) are left out. */
export const isClaimHashtag = (tag: string) => /^(trending|trend|trendingnow|viral|goviral|viralvideo|viralnow|viralpost)$/i.test(tag.replace(/^#/, ""));
