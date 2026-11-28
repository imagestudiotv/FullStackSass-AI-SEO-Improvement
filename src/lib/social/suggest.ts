import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, notInArray, sql } from "drizzle-orm";

import { isAiConfigured } from "@/lib/ai/client";
import { customerTitleSql, publicRevisionSql, publicFieldSql } from "@/lib/articles/review";
import { mainLanguageCode } from "@/lib/articles/translation-languages";
import { db } from "@/lib/db";
import { articles, brandVoice, keywords, socialSuggestions, websites } from "@/lib/db/schema";
import { discussionSearch, isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { calendarMonth } from "@/lib/billing/entitlement-period";
import { FREE_PLAN } from "@/lib/plans/free-plan";
import { isFreePlanWebsite } from "@/lib/plans/free-plan-server";
import { labsMarket } from "@/lib/providers/dataforseo-markets";
import { PRICING, track } from "@/lib/usage";

import { autoPostAllowed, inWarmup, listAccounts, socialAccess, type SocialAccount } from "./accounts";
import { isBundleConfigured } from "./bundle";
import {
  PLATFORMS,
  SEARCH_WITHOUT_ACCOUNT,
  SOCIAL_PLATFORMS,
  SUGGESTIONS_PER_DAY,
  threadFromUrl,
  type SocialPlatform,
  type Thread,
} from "./platforms";
import { asksForRecommendations, communityOf, mayMention, mentionHistory, MENTION_WINDOW_DAYS, naturalise, soundsPromotional, type MentionHistory } from "./mention";
import { checkDraft, isRepeat, linksIn, mayLink, namesBrand, OWN_POSTS_PER_ACCOUNT, postingTime, replyText } from "./rules";
import { writeDrafts, type BusinessProfile, type PostSlot, type ThreadInput } from "./write";

/**
 * A website's suggestions for the day (client, 2026-10-27: 10 a day per
 * website), topped up to SUGGESTIONS_PER_DAY - so the daily run, a retry and
 * a run after a new connection never add more than the day's ten.
 *
 * NO ACCOUNT IS NEEDED (Daniel, 2026-11-24: "enable suggestions without
 * social accounts connected, based on the website information"). Every
 * platform the plan includes gets suggestions written from the website's
 * profile, keywords and articles; those for a platform with no account are
 * posted by hand (text copied, platform opened) and written as for an account
 * in its warm-up - no links, no product names - because RepGet knows nothing
 * about the account they will go out on. Connected accounts come first in the
 * day's ten.
 *
 * Own posts first, one per platform (OWN_POSTS_PER_ACCOUNT), at most half the
 * day's ten; the rest are replies to public discussions found on Google for
 * the website's keywords (DataForSEO, `site:reddit.com <keyword>`). Every
 * draft passes the anti-ban rules (lib/social/rules.ts) or is dropped.
 *
 * Own posts on an account connected through bundle.social are "scheduled":
 * RepGet publishes them later that day (lib/social/publish.ts) unless the
 * customer edits or skips them first - except LinkedIn's, which are one click
 * unless SOCIAL_LINKEDIN_AUTOPOST=1 (accounts.ts autoPostAllowed). Everything
 * else waits for the customer's one click.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Google searches a day, on average per platform, rotating through the website's keywords (findDiscussions). */
const KEYWORDS_PER_PLATFORM = 2;
/** The most of them one platform gets, however little it finds. */
const MAX_SEARCHES_PER_PLATFORM = 3;
/** Discussions offered to the model beyond what is needed: it skips the ones it cannot help with. */
const SPARE_THREADS = 4;
/** The Reddit discussions offered, when there are that many: two a day were too few to survive the model's choice. */
const REDDIT_THREADS = 5;
/** No account connected and this many suggestions still waiting: the daily run writes no more until they are used or a week old. */
export const DORMANT_WAITING = SUGGESTIONS_PER_DAY;
/** How long a suggestion stays on the Opportunities page. */
const WAITING_MS = 7 * DAY_MS;

export type SuggestDeps = {
  search: typeof discussionSearch;
  write: typeof writeDrafts;
  now: Date;
  random: () => number;
};

export type SuggestResult = {
  created: number;
  /** Own posts to publish, with when. */
  scheduled: { id: string; at: Date }[];
  /** Why nothing was written, when nothing was. */
  reason?: string;
  /** What each platform's search gave, for the job's log: why a day has no conversations. */
  discussions?: DiscussionStats;
};

export type DiscussionStats = Partial<
  Record<
    SocialPlatform,
    {
      searches: number;
      /** Searches the provider refused, "no results" among them. */
      failed: number;
      /** Results that are a discussion on this platform. */
      found: number;
      /** Left out: too old to comment on. */
      old: number;
      /** Left out: suggested before. */
      known: number;
      /** Given to the model. */
      offered: number;
      /** Replies the model wrote, and those that passed the checks. */
      written: number;
      kept: number;
    }
  >
>;

/** A platform this website gets suggestions for, with its account when one is connected. */
type Channel = { platform: SocialPlatform; account: SocialAccount | null; warmup: boolean };

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** websites.services is untyped jsonb: a list of strings when set. */
const servicesOf = (site: { services: unknown }): string[] =>
  Array.isArray(site.services) ? site.services.filter((service): service is string => typeof service === "string") : [];

type Candidate = Thread & { title: string; snippet: string; warmup: boolean };

export async function suggestForWebsite(
  websiteId: string,
  deps: Partial<SuggestDeps> = {},
  /** daily: the morning run rather than the customer asking (Find suggestions, a new connection). */
  options: { daily?: boolean } = {},
): Promise<SuggestResult> {
  const now = deps.now ?? new Date();
  const search = deps.search ?? discussionSearch;
  const write = deps.write ?? writeDrafts;
  const random = deps.random ?? Math.random;
  const day = utcDay(now);

  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site || site.status !== "ready") return { created: 0, scheduled: [], reason: "website not ready" };

  const access = await socialAccess(websiteId);
  if (access.platforms.length === 0) return { created: 0, scheduled: [], reason: "no plan" };
  const accounts = await listAccounts(websiteId);
  const channels: Channel[] = SOCIAL_PLATFORMS.filter((platform) => access.platforms.includes(platform))
    .map((platform) => {
      const account = accounts.find((row) => row.platform === platform) ?? null;
      return { platform, account, warmup: account ? inWarmup(account, now) : true };
    })
    .sort((a, b) => Number(Boolean(b.account)) - Number(Boolean(a.account)));
  // Nobody has connected an account and last time's are still waiting: no more searches and model calls for an unread page.
  if (options.daily && channels.every((channel) => !channel.account) && (await countWaiting(websiteId, now)) >= DORMANT_WAITING) {
    return { created: 0, scheduled: [], reason: "earlier suggestions are still waiting" };
  }

  /*
    The Free plan gets its month's drafts (FREE_PLAN.socialSuggestionsPerMonth),
    not ten a day: each run is a model call and Google searches, paid by RepGet,
    for a plan that posts FREE_PLAN.socialPostsPerMonth a month.
  */
  const free = await isFreePlanWebsite(websiteId);
  const remaining = await roomFor(websiteId, day, free, now);
  if (remaining <= 0) {
    const monthDone = free && (await countInMonth(websiteId, now)) >= FREE_PLAN.socialSuggestionsPerMonth;
    return { created: 0, scheduled: [], reason: monthDone ? "this month's Free suggestions are made" : "today's suggestions are made" };
  }
  if (!isAiConfigured()) return { created: 0, scheduled: [], reason: "AI is not configured" };

  const brand = { brandName: site.brandName, domain: site.domain };
  const recent = await db
    .select({
      platform: socialSuggestions.platform,
      kind: socialSuggestions.kind,
      day: socialSuggestions.day,
      body: socialSuggestions.body,
      link: socialSuggestions.link,
    })
    .from(socialSuggestions)
    .where(eq(socialSuggestions.websiteId, websiteId))
    .orderBy(desc(socialSuggestions.createdAt))
    .limit(200);

  // ---- Own posts: OWN_POSTS_PER_ACCOUNT per platform a day, at most half the day's ten.
  const live = await db
    .select({ title: customerTitleSql, url: articles.publishedUrl, imageUrl: publicFieldSql(articles.imageUrl, "imageUrl") })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.publishedUrl), isNotNull(articles.firstLiveAt), sql`${publicRevisionSql}`))
    .orderBy(desc(articles.firstLiveAt))
    .limit(10);

  const slots: (PostSlot & { account: SocialAccount | null; imageUrl: string | null })[] = [];
  for (const { platform, account, warmup } of channels) {
    if (!PLATFORMS[platform].ownPosts) continue;
    const postedToday = recent.filter((row) => row.kind === "post" && row.platform === platform && row.day === day).length;
    if (postedToday >= OWN_POSTS_PER_ACCOUNT) continue;
    if (slots.length >= Math.ceil(remaining / 2)) break;

    const own = recent.filter((row) => row.kind === "post" && row.platform === platform);
    const sinceLink = own.findIndex((row) => row.link || linksIn(row.body).length > 0);
    const linkAllowed = mayLink(warmup, sinceLink === -1 ? own.length : sinceLink);

    if (platform === "pinterest") {
      // A Pin is a picture: the website's own article images, newest first, each pinned ONCE -
      // Pinterest bans repetitive pins (checked 2026-10-28), and cycling through a few images
      // pinned the same ones again and again. All pinned, no Pin until the next article.
      const article = await nextPinImage(websiteId);
      if (!article) continue;
      slots.push({
        platform,
        account,
        warmup,
        // Pins are links by nature: every Pin after the warm-up links to its article.
        link: !warmup && article.url ? { url: article.url, title: article.title } : null,
        topic: article.title,
        imageUrl: article.imageUrl,
      });
    } else {
      const article = live.length > 0 ? live[own.length % live.length] : null;
      slots.push({
        platform,
        account,
        warmup,
        link: linkAllowed && article?.url ? { url: article.url, title: article.title } : null,
        imageUrl: null,
      });
    }
  }

  // ---- Replies: discussions on Google for the website's keywords.
  const replyBudget = remaining - slots.length;
  const { picked: candidates, stats } =
    replyBudget > 0 && isDataForSeoConfigured()
      ? await findDiscussions(site, channels, replyBudget + SPARE_THREADS, live.map((article) => article.title), now, search)
      : { picked: [] as Candidate[], stats: {} as DiscussionStats };
  if (slots.length === 0 && candidates.length === 0) return { created: 0, scheduled: [], reason: "nothing to suggest", discussions: stats };

  const [voice] = await db
    .select({ tone: brandVoice.tone, avoid: brandVoice.avoid })
    .from(brandVoice)
    .where(eq(brandVoice.websiteId, websiteId));
  const profile: BusinessProfile = {
    brandName: site.brandName,
    domain: site.domain,
    description: site.description,
    industry: site.industry,
    services: servicesOf(site),
    targetAudience: site.targetAudience,
    country: site.country,
    language: site.language || "English",
    tone: voice?.tone ?? null,
    avoid: voice?.avoid ?? null,
  };
  // Which discussions may name the business at all (lib/social/mention.ts): decided here, in code, before the model writes.
  const mentions = await replyMentionHistory(websiteId, brand, now);
  const allowed = new Set<number>();
  const communities = candidates.map((candidate) => communityOf(candidate.platform, candidate.url));
  candidates.forEach((candidate, index) => {
    const history = mentions.get(candidate.platform) ?? { posted: 0, mentions: 0 };
    const asks = asksForRecommendations(`${candidate.title}
${candidate.snippet}`);
    if (!mayMention({ warmup: candidate.warmup, asks, noPromotion: communities[index].noPromotion, history })) return;
    allowed.add(index);
    // Held for this one, so two discussions of the same day cannot both take the platform's one in ten.
    mentions.set(candidate.platform, { ...history, mentions: history.mentions + 1 });
  });
  const threads: ThreadInput[] = candidates.map((candidate, index) => ({
    platform: candidate.platform,
    title: candidate.title,
    snippet: candidate.snippet,
    warmup: candidate.warmup,
    mayMention: allowed.has(index),
    community: communities[index].name,
  }));

  const { drafts, usage } = await write(profile, threads, slots, replyBudget);
  const price = PRICING.llm[usage.model as keyof typeof PRICING.llm];
  await track(site.organizationId, {
    kind: "llm",
    websiteId,
    provider: "anthropic",
    model: usage.model,
    quantity: usage.inputTokens + usage.outputTokens,
    costUsd: price ? (usage.inputTokens / 1000) * price.inputPer1k + (usage.outputTokens / 1000) * price.outputPer1k : undefined,
    metadata: { purpose: "social_suggestions", threads: threads.length, slots: slots.length },
  });

  // ---- Checked in code, then saved.
  const earlier = recent.map((row) => row.body);
  type Row = typeof socialSuggestions.$inferInsert;
  const rows: Row[] = [];
  const keep = (row: Row) => {
    if (isRepeat(row.body, earlier)) return;
    earlier.push(row.body);
    rows.push(row);
  };

  for (const draft of drafts.posts) {
    const slot = slots[draft.slot - 1];
    if (!slot || rows.some((row) => row.kind === "post" && row.platform === slot.platform)) continue;
    const title = draft.title?.trim() || null;
    if (PLATFORMS[slot.platform].titleMax && !title) continue;
    const link = slot.platform === "pinterest" ? (slot.link?.url ?? null) : null;
    const body = draft.body.trim();
    if (!checkDraft({ platform: slot.platform, title, body, link }, { ...brand, warmup: slot.warmup }).ok) continue;
    // An own post with sales words or a call to action is not suggested either (as replies, below).
    if (soundsPromotional(`${title ?? ""}
${body}`)) continue;
    // Only a post whose slot offered a link may carry one (LINK_EVERY), even to the website itself.
    if (!slot.link && linksIn(`${title ?? ""} ${body}`).length > 0) continue;
    const auto = Boolean(
      !access.manualOnly &&
        slot.account?.bundleAccountId &&
        slot.account.autoPost &&
        // LinkedIn: one click only unless deliberately turned on (accounts.ts autoPostAllowed).
        autoPostAllowed(slot.platform) &&
        !slot.account.pausedAt &&
        // A Pin needs its board; without one it waits for the customer's click.
        (slot.platform !== "pinterest" || slot.account.target) &&
        // LinkedIn needs its profile or page chosen on bundle.social's page (accounts.ts linkedinTargetOf).
        (slot.platform !== "linkedin" || slot.account.target) &&
        isBundleConfigured(),
    );
    keep({
      websiteId,
      platform: slot.platform,
      kind: "post",
      day,
      title,
      body,
      link,
      imageUrl: slot.imageUrl,
      warmup: slot.warmup,
      status: auto ? "scheduled" : "new",
      scheduledFor: auto ? postingTime(now, random()) : null,
    });
  }

  let replies = 0;
  // In the discussions' order, which goes round the platforms: none takes the whole budget.
  for (const draft of [...drafts.replies].sort((a, b) => a.thread - b.thread)) {
    const thread = candidates[draft.thread - 1];
    if (!thread) continue;
    if (stats[thread.platform]) stats[thread.platform]!.written += 1;
    if (replies >= replyBudget || rows.some((row) => row.threadUrl === thread.url)) continue;
    // The business is named only in a disclosure saying it is the writer's own (replyText), and only
    // where the discussion was allowed one: any other disclosure is dropped, and a body naming it with it.
    const disclosure = allowed.has(draft.thread - 1) ? draft.disclosure : null;
    const answer = naturalise(draft.body);
    // A person helping does not write calls to action or sales words; a reply that does is not suggested.
    if (soundsPromotional(answer)) continue;
    const body = replyText(answer, disclosure, brand);
    if (!body) continue;
    // A reply never carries a link: that is what gets an account banned from a community.
    if (linksIn(body).length > 0) continue;
    if (!checkDraft({ platform: thread.platform, body }, { ...brand, warmup: thread.warmup }).ok) continue;
    keep({
      websiteId,
      platform: thread.platform,
      kind: "reply",
      day,
      threadUrl: thread.url,
      threadTitle: thread.title.slice(0, 500),
      threadSnippet: thread.snippet.slice(0, 1000),
      body,
      warmup: thread.warmup,
      status: "new",
    });
    if (rows.at(-1)?.threadUrl !== thread.url) continue;
    replies += 1;
    if (stats[thread.platform]) stats[thread.platform]!.kept += 1;
  }

  return { ...(await save(websiteId, day, rows, free, now)), discussions: stats };
}

/**
 * Per platform, the website's replies of the last MENTION_WINDOW_DAYS: those
 * posted, and how many named the business. Replies still waiting that name it
 * count as mentions too, so a week of suggestions cannot add up to more than
 * the one in ten once they are all posted.
 */
async function replyMentionHistory(
  websiteId: string,
  brand: { brandName: string | null; domain: string },
  now: Date,
): Promise<Map<SocialPlatform, MentionHistory>> {
  const rows = await db
    .select({ platform: socialSuggestions.platform, status: socialSuggestions.status, body: socialSuggestions.body, postedAt: socialSuggestions.postedAt })
    .from(socialSuggestions)
    .where(
      and(
        eq(socialSuggestions.websiteId, websiteId),
        eq(socialSuggestions.kind, "reply"),
        inArray(socialSuggestions.status, ["posted", "new", "draft"]),
        gte(socialSuggestions.createdAt, new Date(now.getTime() - MENTION_WINDOW_DAYS * DAY_MS)),
      ),
    );
  const result = new Map<SocialPlatform, MentionHistory>();
  for (const platform of SOCIAL_PLATFORMS) {
    const own = rows.filter((row) => row.platform === platform);
    const history = mentionHistory(own.filter((row) => row.status === "posted"), brand, now);
    const waiting = own.filter((row) => row.status !== "posted" && namesBrand(row.body, brand)).length;
    result.set(platform, { posted: history.posted, mentions: history.mentions + waiting });
  }
  return result;
}

/**
 * The newest live article whose image has never been pinned for this website.
 * A Pin the customer dismissed, or one the platform refused, was not pinned.
 */
async function nextPinImage(websiteId: string): Promise<{ title: string; url: string | null; imageUrl: string } | null> {
  const pinned = new Set(
    (
      await db
        .select({ imageUrl: socialSuggestions.imageUrl })
        .from(socialSuggestions)
        .where(
          and(
            eq(socialSuggestions.websiteId, websiteId),
            eq(socialSuggestions.platform, "pinterest"),
            isNotNull(socialSuggestions.imageUrl),
            notInArray(socialSuggestions.status, ["dismissed", "failed"]),
          ),
        )
    ).map((row) => row.imageUrl),
  );
  const candidates = await db
    .select({ title: customerTitleSql, url: articles.publishedUrl, imageUrl: publicFieldSql(articles.imageUrl, "imageUrl") })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        isNotNull(articles.publishedUrl),
        isNotNull(articles.firstLiveAt),
        isNotNull(articles.imageUrl),
        sql`${publicRevisionSql}`,
      ),
    )
    .orderBy(desc(articles.firstLiveAt))
    .limit(200);
  const next = candidates.find((article) => article.imageUrl && !pinned.has(article.imageUrl));
  return next?.imageUrl ? { title: next.title, url: next.url, imageUrl: next.imageUrl } : null;
}

/** Today's suggestions so far. */
async function countOnDay(websiteId: string, day: string, executor: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(socialSuggestions)
    .where(and(eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.day, day)));
  return Number(row?.n ?? 0);
}

/** Suggestions of the last week nobody has posted, edited or skipped. */
async function countWaiting(websiteId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(socialSuggestions)
    .where(
      and(
        eq(socialSuggestions.websiteId, websiteId),
        inArray(socialSuggestions.status, ["new", "failed"]),
        gte(socialSuggestions.day, utcDay(new Date(now.getTime() - WAITING_MS))),
      ),
    );
  return Number(row?.n ?? 0);
}

/** This UTC month's suggestions so far (the Free plan's allowance of them). */
async function countInMonth(websiteId: string, now: Date, executor: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(socialSuggestions)
    .where(and(eq(socialSuggestions.websiteId, websiteId), gte(socialSuggestions.day, calendarMonth(now).start.toISOString().slice(0, 10))));
  return Number(row?.n ?? 0);
}

/** How many more suggestions may be written today: the day's ten, and on Free what is left of the month's. */
async function roomFor(websiteId: string, day: string, free: boolean, now: Date, executor: Pick<typeof db, "select"> = db): Promise<number> {
  const today = SUGGESTIONS_PER_DAY - (await countOnDay(websiteId, day, executor));
  return free ? Math.min(today, FREE_PLAN.socialSuggestionsPerMonth - (await countInMonth(websiteId, now, executor))) : today;
}

/**
 * Saves the drafts, re-counting the day (and on Free the month) under a
 * per-website lock so two runs at once still add up to the day's ten, and
 * skipping a discussion another run has just suggested.
 */
async function save(websiteId: string, day: string, rows: (typeof socialSuggestions.$inferInsert)[], free: boolean, now: Date): Promise<SuggestResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`social:${websiteId}`}))`);
    const room = await roomFor(websiteId, day, free, now, tx);
    if (room <= 0 || rows.length === 0) return { created: 0, scheduled: [], reason: rows.length === 0 ? "no draft passed the checks" : undefined };
    const saved = await tx
      .insert(socialSuggestions)
      .values(rows.slice(0, room))
      .onConflictDoNothing()
      .returning({ id: socialSuggestions.id, status: socialSuggestions.status, scheduledFor: socialSuggestions.scheduledFor });
    return {
      created: saved.length,
      scheduled: saved.flatMap((row) => (row.status === "scheduled" && row.scheduledFor ? [{ id: row.id, at: row.scheduledFor }] : [])),
    };
  });
}

/**
 * Public discussions for the website's keywords, one platform after another
 * so no platform takes the whole day. Each search is `<site:platform>
 * <keyword>` in the website's market; the keywords rotate day by day through
 * its twenty best, brand names left out (answering a question about yourself
 * is not a conversation).
 *
 * The day's searches (KEYWORDS_PER_PLATFORM per platform) are spent where
 * they find something. Google sometimes ignores "site:" and returns other
 * websites (it gave Quora none in the 2026-10-29 test), and a failed search
 * finds nothing but is still charged. So every platform is searched once,
 * then the rest go to the platforms still short of discussions; one with
 * plenty is not searched again. A discussion counts for its own platform
 * whichever search found it: the Reddit search turned up a Quora question.
 *
 * REDDIT COMES FIRST, AND IS ASKED IN MORE THAN ONE WAY (Daniel, 2026-11-24:
 * "missing the part to find opportunities to reply on reddit posts"). Since
 * 2026-11-04 only threads of the last five months are asked for (an archived
 * one takes no comments). A long keyword, inside one site, inside five months
 * is often an empty result page - which DataForSEO reports as an ERROR
 * (40102), so the day's searches failed one after another in the same way and
 * Reddit was left with own posts only. Every further Reddit search now widens
 * (searchQuery): fewer words, then without "site:", with the date written in
 * the query instead of the filter. The number of searches is unchanged.
 *
 * A platform with no account is searched only where Google lists its
 * discussions well (SEARCH_WITHOUT_ACCOUNT): each search costs money.
 */
async function findDiscussions(
  site: typeof websites.$inferSelect,
  channels: Channel[],
  wanted: number,
  articleTitles: string[],
  now: Date,
  search: SuggestDeps["search"],
): Promise<{ picked: Candidate[]; stats: DiscussionStats }> {
  const terms = (
    await db
      .select({ term: keywords.term })
      .from(keywords)
      .where(eq(keywords.websiteId, site.id))
      .orderBy(sql`${keywords.priorityScore} desc nulls last`, sql`${keywords.volume} desc nulls last`)
      .limit(20)
  )
    .map((row) => row.term)
    .filter((term) => !namesBrand(term, { brandName: site.brandName, domain: site.domain }));
  const fallback = [site.industry, ...servicesOf(site)].filter((topic): topic is string => Boolean(topic?.trim()));
  const topics = terms.length > 0 ? terms : fallback.length > 0 ? fallback : articleTitles.map(shortTopic).filter(Boolean);
  if (topics.length === 0) return { picked: [], stats: {} };

  const market = labsMarket(site.country ?? "", site.language ?? "English");
  const language = mainLanguageCode(site.language);
  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  const replying = channels
    .filter(({ platform, account }) => PLATFORMS[platform].replies && (account || SEARCH_WITHOUT_ACCOUNT.includes(platform)))
    .sort((a, b) => Number(b.platform === "reddit") - Number(a.platform === "reddit"));
  if (replying.length === 0) return { picked: [], stats: {} };

  const stats: DiscussionStats = {};
  for (const { platform } of replying) stats[platform] = { searches: 0, failed: 0, found: 0, old: 0, known: 0, offered: 0, written: 0, kept: 0 };
  const perPlatform = new Map<SocialPlatform, Candidate[]>(replying.map(({ platform }) => [platform, []]));
  const searches = new Map<SocialPlatform, number>();
  const seen = new Set<string>();
  const evenShare = Math.ceil(wanted / replying.length);
  const shareOf = (platform: SocialPlatform) => (platform === "reddit" ? Math.max(evenShare, REDDIT_THREADS) : evenShare);
  /** The most searches a platform gets: no more than there are different ones to make (Reddit's widen, so always all). */
  const searchesFor = (platform: SocialPlatform) =>
    PLATFORMS[platform].maxAgeMonths ? MAX_SEARCHES_PER_PLATFORM : Math.min(MAX_SEARCHES_PER_PLATFORM, topics.length);

  const searchFor = async (index: number) => {
    const { platform } = replying[index];
    const k = searches.get(platform) ?? 0;
    searches.set(platform, k + 1);
    stats[platform]!.searches += 1;
    const term = topics[(dayIndex * MAX_SEARCHES_PER_PLATFORM + index + k) % topics.length];
    const { query, options } = searchQuery(platform, term, k, now);
    let items: { url: string; title: string; description: string; postedAt?: Date | null }[];
    try {
      ({ items } = await search(query, market.location, market.language, (costUsd) =>
        track(site.organizationId, {
          kind: "seo_api",
          provider: "dataforseo",
          websiteId: site.id,
          costUsd,
          metadata: { purpose: "social_discovery", platform, costBasis: costUsd === undefined ? "unknown" : "provider_reported" },
        }),
        options,
      ));
    } catch (error) {
      // One search failing costs that search's discussions, not the day's suggestions. "No results" arrives here too.
      stats[platform]!.failed += 1;
      console.error("[social] discussion search failed", { websiteId: site.id, platform, error });
      return;
    }

    const found: Candidate[] = [];
    for (const item of items) {
      for (const channel of replying) {
        const thread = threadFromUrl(channel.platform, item.url);
        // A Quora question in another language than the website's is not one to answer.
        if (!thread || seen.has(thread.url) || (thread.language && thread.language !== language)) continue;
        seen.add(thread.url);
        stats[channel.platform]!.found += 1;
        // Google's date filter goes by the page's date; one dated too long ago to take comments is dropped whichever search found it.
        const maxAgeMonths = PLATFORMS[channel.platform].maxAgeMonths;
        if (maxAgeMonths && item.postedAt && now.getTime() - item.postedAt.getTime() > maxAgeMonths * 30 * DAY_MS) {
          stats[channel.platform]!.old += 1;
          continue;
        }
        found.push({ ...thread, title: item.title, snippet: item.description, warmup: channel.warmup });
      }
    }
    // Leave out discussions already suggested on an earlier day: they do not count towards a platform's share.
    const known = new Set(
      found.length === 0
        ? []
        : (
            await db
              .select({ url: socialSuggestions.threadUrl })
              .from(socialSuggestions)
              .where(and(eq(socialSuggestions.websiteId, site.id), inArray(socialSuggestions.threadUrl, found.map((candidate) => candidate.url))))
          ).map((row) => row.url),
    );
    for (const candidate of found) {
      if (known.has(candidate.url)) stats[candidate.platform]!.known += 1;
      else perPlatform.get(candidate.platform)!.push(candidate);
    }
  };

  const emptyReddit = (entry: { platform: SocialPlatform; have: number }) => entry.platform === "reddit" && entry.have === 0;
  for (const index of replying.keys()) await searchFor(index);
  for (let left = KEYWORDS_PER_PLATFORM * replying.length - replying.length; left > 0; left -= 1) {
    // Reddit while it has nothing (its searches widen); then the platform furthest short of its share; of two, the one searched less.
    const next = [...replying.keys()]
      .map((index) => {
        const { platform } = replying[index];
        return { index, platform, have: perPlatform.get(platform)!.length, done: searches.get(platform) ?? 0 };
      })
      .filter((entry) => entry.have < shareOf(entry.platform) && entry.done < searchesFor(entry.platform))
      .sort((a, b) => Number(emptyReddit(b)) - Number(emptyReddit(a)) || a.have - b.have || a.done - b.done)[0];
    if (!next) break;
    await searchFor(next.index);
  }

  // Round-robin across the platforms.
  const queues = [...perPlatform.values()];
  const picked: Candidate[] = [];
  while (picked.length < wanted && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= wanted) break;
      const next = queue.shift();
      if (next) picked.push(next);
    }
  }
  // Reddit's spares, after everybody's: used only where the model skipped the others.
  const reddit = perPlatform.get("reddit") ?? [];
  while (reddit.length > 0 && picked.filter((candidate) => candidate.platform === "reddit").length < REDDIT_THREADS) picked.push(reddit.shift()!);
  for (const candidate of picked) stats[candidate.platform]!.offered += 1;
  return { picked, stats };
}

/**
 * A platform's k-th search of the day. Where threads close (Reddit), each one
 * widens the one before, because the narrowest is so often empty:
 *  1. the keyword, on the site, Google's "past five months" filter;
 *  2. its main words, on the site, with the date as a query word (`after:`);
 *  3. its main words and the platform's name, anywhere: "site:" is sometimes
 *     ignored or returns nothing, and Google's discussions block still lists
 *     the threads.
 * Other platforms ask the same way each time, with the next keyword.
 */
export function searchQuery(
  platform: SocialPlatform,
  term: string,
  k: number,
  now: Date,
): { query: string; options: { maxAgeMonths?: number } } {
  const { search: site, maxAgeMonths, name } = PLATFORMS[platform];
  if (!maxAgeMonths) return { query: `${site} ${term}`, options: {} };
  if (k === 0) return { query: `${site} ${term}`, options: { maxAgeMonths } };
  const after = `after:${utcDay(new Date(now.getTime() - maxAgeMonths * 30 * DAY_MS))}`;
  const topic = shortTopic(term) || term;
  return { query: k === 1 ? `${site} ${topic} ${after}` : `${topic} ${name.toLowerCase()} ${after}`, options: {} };
}

/** Words that narrow a search without saying what it is about, in the languages websites are written in. */
const FILLER = new Set(
  (
    "a an and are as at be best by can cheap cost costs do does for from guide how i in is it me my near of on or our price prices step tips to top vs what when where which who why will with you your " +
    "como con cual cuales de del donde el en es guia la las lo los mejor mejores mi para por precio precios que se su un una y " +
    "au aux avec ce comment dans des du est et le les meilleur meilleure meilleurs notre ou par pour prix quel quelle sur une votre " +
    "al alla che come da dei della delle di e gli il migliore migliori nel o per prezzi prezzo quale quali " +
    "am auf aus bei beste besten der die das den dem ein eine einen fur für im ist kosten mit oder preis preise und von was welche wie zu zum zur"
  ).split(" "),
);

/** A keyword's main words, three at most: "how to choose a wedding photographer in 2026" -> "choose wedding photographer". */
export function shortTopic(term: string): string {
  return term
    .toLowerCase()
    .split(/[^\p{L}\p{N}'+#.-]+/u)
    .filter((word) => word && !FILLER.has(word) && !/^(?:19|20)\d\d$/.test(word))
    .slice(0, 3)
    .join(" ");
}
