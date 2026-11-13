import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import {
  acquireLease,
  consumeReservation,
  paidCall,
  releaseLease,
  releaseReservation,
  releaseUnspent,
  reserveAll,
  usedInWindow,
  type Lease,
  type QuotaRule,
} from "@/lib/billing/spend-quota";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";
import { readCache, writeCache } from "@/lib/providers/cache";
import { trackGuestUsage } from "@/lib/usage";
import { fetchHomepage } from "@/lib/websites/crawl";
import { InvalidUrlError, isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

import {
  FREE_SOCIAL_SPECS,
  MAX_URL_CHARS,
  type FreeSocialGoal,
  type FreeSocialOutcome,
  type FreeSocialPlatform,
  type FreeSocialPost,
  type FreeSocialSource,
  type FreeSocialStatus,
  type FreeSocialTone,
} from "./social-posts-shared";

/**
 * The free AI Social Media Post Generator (client, 2026-11-13,
 * repget-free-ai-social-media-post-generator.html): one public page - a
 * homepage or an article - read once, and three posts for one platform
 * written from it, for a visitor without an account. It never publishes.
 *
 * ONE FREE BATCH PER VISITOR, kept by the server (the browser's copy is only
 * for showing the posts again after a reload). Visitors are identified as
 * everywhere else on the public site (lib/visitor-key.ts), and every count is
 * a spend reservation (lib/billing/spend-quota.ts) - atomic across server
 * instances, so two requests at once from one visitor get one batch:
 *
 *  - batch      1 per visitor per FREE_SOCIAL_LIMITS.windowDays: held while
 *               the posts are written, consumed when they are delivered,
 *               handed back when they could not be;
 *  - attempt    2 per visitor per window: counted the moment the model is
 *               called, whatever happens next - so a failure leaves exactly
 *               one retry, and a second failure ends the free use;
 *  - fetch      per visitor per hour, counted on every request that reads a
 *               page, so the tool cannot be used to fetch page after page;
 *  - global     every visitor together per hour, through paidCall: a call
 *               that may have been billed stays counted.
 * Bounded concurrency besides: at most FREE_SOCIAL_LIMITS.concurrentCalls
 * requests are writing at once, across every instance (expiring leases).
 *
 * The page is read by the free tools' reader (lib/websites/crawl.ts): one
 * page, no crawling, through the SSRF-guarded transport, redirects
 * re-checked hop by hop, 2 MB and 15 seconds at most. Its text goes to the
 * model as material, never as instructions (lib/ai/untrusted.ts).
 */
export const FREE_SOCIAL_LIMITS = {
  batchesPerVisitor: 1,
  /** The batch and one retry after a failure. */
  attemptsPerVisitor: 2,
  /** How long "one free batch" lasts for one visitor. */
  windowDays: 30,
  /** Pages one visitor may have read in an hour (bad addresses included). */
  fetchesPerVisitorPerHour: 10,
  /** Every visitor together: a few cents a batch, about a dollar an hour at most. */
  globalPerHour: 60,
  /** Batches being written at once, across every instance. */
  concurrentCalls: 4,
  /** How long one request may hold its concurrency slot: longer than its fetch and model deadlines. */
  leaseSeconds: 120,
  /** Page text given to the model. */
  pageChars: 5_000,
  /** Less text than this is not enough to write from. */
  minPageChars: 80,
  /** Three posts, the longest about 1,500 characters each, in any language - and no thinking. */
  maxTokens: 2_000,
  /** The model call's own deadline. */
  timeoutMs: 45_000,
  cacheDays: 1,
};

/** The generation model, without extended thinking: the posts are short, and thinking would eat max_tokens. */
const MODEL = MODELS.GENERATION;
const OPERATION = "public.free_social_posts";
const USAGE_PURPOSE = "free_social_posts";
const CACHE_PROVIDER = "free-social-posts-page";

export type FreeSocialRequest = {
  url: string;
  platform: FreeSocialPlatform;
  goal: FreeSocialGoal;
  tone: FreeSocialTone;
  hashtags: boolean;
  emoji: boolean;
  /** The page's language: the angle labels', and the posts' when the page gives no clue. */
  locale: Locale;
};

type Create = (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

const defaultCreate: Create = (body) =>
  anthropic.messages.create(body, { timeout: FREE_SOCIAL_LIMITS.timeoutMs, maxRetries: 1 });

/** What is kept of a page: what the prompt reads, not the crawler's whole snapshot. */
export type SourcePage = {
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  text: string;
};

function rules(visitor: string) {
  const window = { seconds: FREE_SOCIAL_LIMITS.windowDays * 86_400 };
  return {
    batch: { key: `free-social-posts:batch:${visitor}`, limit: FREE_SOCIAL_LIMITS.batchesPerVisitor, window },
    attempt: { key: `free-social-posts:attempt:${visitor}`, limit: FREE_SOCIAL_LIMITS.attemptsPerVisitor, window },
    fetch: { key: `free-social-posts:fetch:${visitor}`, limit: FREE_SOCIAL_LIMITS.fetchesPerVisitorPerHour, window: { seconds: 3_600 } },
    global: { key: "free-social-posts:global", limit: FREE_SOCIAL_LIMITS.globalPerHour, window: { seconds: 3_600 } },
  } satisfies Record<string, QuotaRule>;
}

/** Whether this visitor may still generate their free batch. A batch being written counts as used. */
export async function freeSocialStatus(visitor: string): Promise<FreeSocialStatus> {
  const { batch, attempt } = rules(visitor);
  const [batches, attempts] = await Promise.all([usedInWindow(batch), usedInWindow(attempt)]);
  return { available: batches < batch.limit && attempts < attempt.limit };
}

/** Tracking parameters, dropped from an article's address. */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src)$/i;

/**
 * The address to read, or null when it is not a public http(s) website or
 * article. The website rules (lib/websites/url.ts: no private or internal
 * hosts, no credentials, no social profiles) plus an article's own query
 * string (?p=123), without tracking parameters.
 */
export function sourceUrl(input: string): { url: string; domain: string } | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed || trimmed.length > MAX_URL_CHARS) return null;
  // An address with a user name or password is never a public page (normalisation would silently drop them).
  if (/^(?:https?:\/\/)?[^/?#]*@/i.test(trimmed)) return null;
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(trimmed);
  } catch (error) {
    if (error instanceof InvalidUrlError) return null;
    throw error;
  }
  let url = normalized.url;
  try {
    const typed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const kept = [...typed.searchParams].filter(([name]) => !TRACKING.test(name));
    const base = new URL(url);
    // Only when the path survived normalisation (an admin path is dropped to the root, and its query with it).
    if (kept.length > 0 && base.pathname === (typed.pathname.replace(/\/+$/, "") || "/")) {
      base.search = new URLSearchParams(kept).toString();
      url = base.toString();
    }
  } catch {
    // normalizeWebsiteUrl parsed it; the query is a nicety.
  }
  if (url.length > MAX_URL_CHARS || !isPublicWebsiteUrl(url)) return null;
  return { url, domain: normalized.domain };
}

/** The page, read once a day per address; null when it cannot be read. */
async function readPage(url: string): Promise<SourcePage | null> {
  const params = { url };
  try {
    const cached = await readCache<SourcePage>(CACHE_PROVIDER, "page", params);
    if (cached) return cached;
  } catch {
    // A cache that cannot be read is only slower.
  }
  let page: SourcePage;
  try {
    const snapshot = await fetchHomepage(url, isPublicWebsiteUrl);
    page = {
      finalUrl: snapshot.finalUrl,
      title: snapshot.title,
      metaDescription: snapshot.metaDescription,
      h1: snapshot.h1,
      headings: snapshot.headings.slice(0, 15),
      text: snapshot.text.slice(0, FREE_SOCIAL_LIMITS.pageChars),
    };
  } catch {
    return null;
  }
  await writeCache(CACHE_PROVIDER, "page", params, page, FREE_SOCIAL_LIMITS.cacheDays).catch(() => {});
  return page;
}

/** How each platform's posts are written. */
const STYLE: Record<FreeSocialPlatform, string> = {
  instagram: "An Instagram caption: a strong first line (it is all that shows before \"more\"), short paragraphs separated by line breaks, a call to action at the end.",
  linkedin: "A LinkedIn post: a hook on the first line, short paragraphs, a professional but human voice, one clear takeaway.",
  x: "A single post on X: one idea, direct and punchy. Not a thread.",
  facebook: "A Facebook post: friendly and conversational, two to four short paragraphs.",
  threads: "A Threads post: conversational, like talking to a peer, one idea.",
  tiktok: "A TikTok video caption: the first line is the on-screen hook for the video, then a blank line, then the caption.",
  pinterest: "A Pin: the first line is the Pin title (at most 100 characters), then a blank line, then the Pin description, keyword-rich and evergreen.",
  reddit:
    "A Reddit post: the first line is the post title (at most 300 characters), then a blank line, then the body. Reddit communities dislike promotion: lead with something genuinely useful or a real question, and mention the business at most once, plainly.",
  bluesky: "A Bluesky post: one idea, conversational.",
};

/** The length to aim for: the platform's limit for the short ones, a readable length for the long ones. */
const TARGET: Record<FreeSocialPlatform, number> = {
  instagram: 1_000,
  linkedin: 1_300,
  x: 270,
  facebook: 800,
  threads: 450,
  tiktok: 600,
  pinterest: 500,
  reddit: 1_500,
  bluesky: 280,
};

const HASHTAGS: Record<FreeSocialPlatform, string> = {
  instagram: "3 to 6 relevant hashtags at the end",
  linkedin: "2 or 3 relevant hashtags at the end",
  x: "at most 2 hashtags, only if they fit naturally",
  facebook: "1 or 2 relevant hashtags at the end",
  threads: "at most 1 hashtag",
  tiktok: "3 to 5 relevant hashtags at the end",
  pinterest: "2 to 4 relevant hashtags at the end",
  reddit: "no hashtags (Reddit does not use them)",
  bluesky: "at most 2 hashtags, only if they fit naturally",
};

const GOALS: Record<FreeSocialGoal, string> = {
  introduce: "introduce the business: what it does and for whom",
  traffic: "bring readers to the page: give them a reason to visit, and include the page's address once in each post",
  engage: "start conversations: end each post with a genuine question to the audience",
  educate: "share useful insights from the page that the audience can use, with the business in the background",
};

const TONES: Record<FreeSocialTone, string> = {
  natural: "clear and natural",
  professional: "professional",
  friendly: "friendly and warm",
  bold: "bold and confident",
};

export function systemPrompt(request: Pick<FreeSocialRequest, "platform" | "goal" | "tone" | "hashtags" | "emoji" | "locale">, address: string): string {
  const spec = FREE_SOCIAL_SPECS[request.platform];
  const target = Math.min(TARGET[request.platform], spec.max);
  return [
    "You write social media posts for a business, from one page of its website, for RepGet's free social media post generator. The posts are drafts the visitor will edit and publish themselves.",
    "",
    "Rules:",
    `- Write exactly 3 posts for ${spec.name}. Each takes a clearly different angle.`,
    `- Format: ${STYLE[request.platform]}`,
    `- Length: at most ${target} characters per post, hashtags included. ${spec.name} allows ${spec.max}; never go over it.`,
    `- Goal: ${GOALS[request.goal]}.`,
    `- Tone: ${TONES[request.tone]}.`,
    `- Hashtags: ${request.hashtags ? HASHTAGS[request.platform] : "none"}.`,
    `- Emoji: ${request.emoji && request.platform !== "reddit" ? "a few, where they fit naturally" : "none"}.`,
    `- Write the posts in the language the page is written in. If you cannot tell, write in ${LANGUAGE_NAMES_EN[request.locale]}.`,
    `- Give each post an "angle": a label of 2 to 4 words naming its approach (such as "Brand story" or "Quick tip"), written in ${LANGUAGE_NAMES_EN[request.locale]}.`,
    "- Use only what the page says about the business. Never invent prices, offers, discounts, statistics, results, customer names, reviews or guarantees. If the page gives little detail, stay general rather than making things up.",
    `- The only web address you may use is ${address}. No placeholders such as [link] or [your name], and no @mentions of accounts you were not given.`,
    `- ${dataRule("website_page")}`,
    "",
    'Return ONLY a JSON object, with no other text: {"posts": [{"angle": "...", "text": "..."}, {"angle": "...", "text": "..."}, {"angle": "...", "text": "..."}]}',
  ].join("\n");
}

export function pageMessage(page: SourcePage): string {
  return dataBlock(
    "website_page",
    [
      `Address: ${page.finalUrl}`,
      `Title: ${page.title ?? "(none)"}`,
      `Meta description: ${page.metaDescription ?? "(none)"}`,
      `Main heading: ${page.h1 ?? "(none)"}`,
      page.headings.length > 0 ? `Headings: ${page.headings.join(" | ")}` : "Headings: (none)",
      "",
      page.text.slice(0, FREE_SOCIAL_LIMITS.pageChars),
    ].join("\n"),
  );
}

/** Strips the markdown fencing models sometimes wrap JSON in. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/** The three posts from the model's answer, or null when it is not three usable posts. */
export function parsePosts(raw: string): FreeSocialPost[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return null;
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { posts?: unknown } | null)?.posts;
  if (!Array.isArray(list)) return null;
  const posts: FreeSocialPost[] = [];
  for (const item of list) {
    const post = item as { angle?: unknown; text?: unknown } | null;
    const text = typeof post?.text === "string" ? post.text.trim().slice(0, 10_000) : "";
    if (!text) continue;
    const angle = typeof post?.angle === "string" ? post.angle.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    posts.push({ angle, text });
    if (posts.length === 3) break;
  }
  return posts.length === 3 ? posts : null;
}

/** Takes one of the concurrency slots, or null when every one is held. */
async function acquireSlot(): Promise<Lease | null> {
  const slots = FREE_SOCIAL_LIMITS.concurrentCalls;
  // A random start, so requests arriving together do not all queue on slot 0.
  const start = Math.floor(Math.random() * slots);
  for (let i = 0; i < slots; i++) {
    const lease = await acquireLease(`free-social-posts:slot:${(start + i) % slots}`, FREE_SOCIAL_LIMITS.leaseSeconds);
    if (lease) return lease;
  }
  return null;
}

/**
 * The free batch for a visitor. `visitor` is visitorKey() of the request;
 * the caller reads the headers. `create` is the model call (a test double
 * in tests).
 */
export async function generateFreeSocialPosts(request: FreeSocialRequest, visitor: string, create: Create = defaultCreate): Promise<FreeSocialOutcome> {
  const source = sourceUrl(request.url);
  if (!source) return { ok: false, reason: "invalid_url" };
  if (!isAiConfigured()) return { ok: false, reason: "unavailable" };

  const r = rules(visitor);
  let reserved;
  try {
    reserved = await reserveAll([r.batch, r.attempt, r.fetch, r.global], { operation: OPERATION, metadata: { visitor, platform: request.platform } });
  } catch (error) {
    // The quota store cannot be reached: nothing is fetched or written (fails closed).
    console.warn("[free-social-posts] quota unavailable", error);
    return { ok: false, reason: "unavailable" };
  }
  if (!reserved.ok) {
    if (reserved.rule.key === r.global.key) return { ok: false, reason: "busy" };
    if (reserved.rule.key === r.fetch.key) return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "limit" };
  }
  const [batch, attempt, fetched, global] = reserved.reservations;

  let delivered = false;
  let attempted = false;
  let lease: Lease | null = null;
  let outcome: FreeSocialOutcome;
  try {
    // A page read is counted from here, whatever the network does next.
    await consumeReservation(fetched.id, "paid");
    lease = await acquireSlot().catch(() => null);
    outcome = await (async (): Promise<FreeSocialOutcome> => {
      if (!lease) return { ok: false, reason: "busy" };

      const page = await readPage(source.url);
      if (!page || page.text.trim().length < FREE_SOCIAL_LIMITS.minPageChars) return { ok: false, reason: "extraction_failed" };

      // The model is called: this attempt counts, whatever happens next (one retry after a failure, no more).
      attempted = true;
      await consumeReservation(attempt.id, "paid");

      let response: Anthropic.Message;
      try {
        response = await paidCall([global], () =>
          create({
            model: MODEL,
            max_tokens: FREE_SOCIAL_LIMITS.maxTokens,
            thinking: { type: "disabled" },
            system: systemPrompt(request, page.finalUrl),
            messages: [{ role: "user", content: pageMessage(page) }],
          }),
        );
      } catch (error) {
        console.warn("[free-social-posts] no answer", error);
        return { ok: false, reason: "provider_failed" };
      }

      if (response.usage) {
        await trackGuestUsage([batch.id, attempt.id, global.id], {
          purpose: USAGE_PURPOSE,
          provider: "anthropic",
          model: MODEL,
          inputTokens: response.usage.input_tokens ?? 0,
          outputTokens: response.usage.output_tokens ?? 0,
        });
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const posts = parsePosts(text);
      if (!posts) return { ok: false, reason: "provider_failed" };

      await consumeReservation(batch.id, "paid");
      delivered = true;
      const finalDomain = (() => {
        try {
          return new URL(page.finalUrl).hostname.replace(/^www\./, "");
        } catch {
          return source.domain;
        }
      })();
      const result: FreeSocialSource = { url: page.finalUrl, domain: finalDomain, title: page.title };
      return { ok: true, platform: request.platform, posts, source: result };
    })();
  } catch (error) {
    console.warn("[free-social-posts] failed", error);
    outcome = { ok: false, reason: attempted ? "provider_failed" : "unavailable" };
  } finally {
    if (lease) await releaseLease(lease);
    // Undelivered: the batch comes back (the attempt, once made, does not).
    if (!delivered) await releaseReservation(batch.id, attempted ? "generation_failed" : "not_attempted");
    if (!attempted) await releaseReservation(attempt.id, "not_attempted");
    // Only a call that never reached the model leaves the hourly cap untouched.
    await releaseUnspent([global], "not_spent");
  }

  if (!outcome.ok && outcome.reason === "provider_failed") {
    const status = await freeSocialStatus(visitor).catch(() => ({ available: false }));
    return { ...outcome, retryAvailable: status.available };
  }
  return outcome;
}
