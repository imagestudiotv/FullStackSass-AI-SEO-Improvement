import "server-only";

import { and, desc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";

import { isAiConfigured } from "@/lib/ai/client";
import { mainLanguageCode } from "@/lib/articles/translation-languages";
import { db } from "@/lib/db";
import { articles, brandVoice, keywords, socialSuggestions, websites } from "@/lib/db/schema";
import { discussionSearch, isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { labsMarket } from "@/lib/providers/dataforseo-markets";
import { PRICING, track } from "@/lib/usage";

import { inWarmup, listAccounts, socialAccess, type SocialAccount } from "./accounts";
import { isBundleConfigured } from "./bundle";
import { PLATFORMS, SUGGESTIONS_PER_DAY, threadFromUrl, type SocialPlatform, type Thread } from "./platforms";
import { checkDraft, isRepeat, linksIn, mayLink, namesBrand, OWN_POSTS_PER_ACCOUNT, postingTime, replyText } from "./rules";
import { writeDrafts, type BusinessProfile, type PostSlot, type ThreadInput } from "./write";

/**
 * A website's suggestions for the day (client, 2026-10-27: 10 a day per
 * website), topped up to SUGGESTIONS_PER_DAY - so the daily run, a retry and
 * a run after a new connection never add more than the day's ten.
 *
 * Own posts first, one per account (OWN_POSTS_PER_ACCOUNT), at most half the
 * day's ten; the rest are replies to public discussions found on Google for
 * the website's keywords (DataForSEO, `site:reddit.com <keyword>`). Every
 * draft passes the anti-ban rules (lib/social/rules.ts) or is dropped.
 *
 * Own posts on an account connected through bundle.social are "scheduled":
 * RepGet publishes them later that day (lib/social/publish.ts) unless the
 * customer edits or skips them first. Everything else waits for the
 * customer's one click.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Google searches a day, on average per platform, rotating through the website's keywords (findDiscussions). */
const KEYWORDS_PER_PLATFORM = 2;
/** The most of them one platform gets, however little it finds. */
const MAX_SEARCHES_PER_PLATFORM = 3;
/** Discussions offered to the model beyond what is needed: it skips the ones it cannot help with. */
const SPARE_THREADS = 4;

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
};

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** websites.services is untyped jsonb: a list of strings when set. */
const servicesOf = (site: { services: unknown }): string[] =>
  Array.isArray(site.services) ? site.services.filter((service): service is string => typeof service === "string") : [];

type Candidate = Thread & { title: string; snippet: string; warmup: boolean };

export async function suggestForWebsite(websiteId: string, deps: Partial<SuggestDeps> = {}): Promise<SuggestResult> {
  const now = deps.now ?? new Date();
  const search = deps.search ?? discussionSearch;
  const write = deps.write ?? writeDrafts;
  const random = deps.random ?? Math.random;
  const day = utcDay(now);

  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site || site.status !== "ready") return { created: 0, scheduled: [], reason: "website not ready" };

  const access = await socialAccess(websiteId);
  const accounts = (await listAccounts(websiteId)).filter((account) =>
    access.platforms.includes(account.platform as SocialPlatform),
  );
  if (accounts.length === 0) return { created: 0, scheduled: [], reason: access.level === "none" ? "no plan" : "no accounts" };

  const remaining = SUGGESTIONS_PER_DAY - (await countOnDay(websiteId, day));
  if (remaining <= 0) return { created: 0, scheduled: [], reason: "today's suggestions are made" };
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

  // ---- Own posts: OWN_POSTS_PER_ACCOUNT per account a day (accounts are one per platform), at most half the day's ten.
  const live = await db
    .select({ title: articles.title, url: articles.publishedUrl, imageUrl: articles.imageUrl })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.publishedUrl), isNotNull(articles.firstLiveAt)))
    .orderBy(desc(articles.firstLiveAt))
    .limit(10);

  const slots: (PostSlot & { account: SocialAccount; imageUrl: string | null })[] = [];
  for (const account of accounts) {
    const platform = account.platform as SocialPlatform;
    if (!PLATFORMS[platform].ownPosts) continue;
    const postedToday = recent.filter((row) => row.kind === "post" && row.platform === platform && row.day === day).length;
    if (postedToday >= OWN_POSTS_PER_ACCOUNT) continue;
    if (slots.length >= Math.ceil(remaining / 2)) break;

    const warmup = inWarmup(account, now);
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
  const candidates =
    replyBudget > 0 && isDataForSeoConfigured()
      ? await findDiscussions(site, accounts, replyBudget + SPARE_THREADS, now, search)
      : [];
  if (slots.length === 0 && candidates.length === 0) return { created: 0, scheduled: [], reason: "nothing to suggest" };

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
  const threads: ThreadInput[] = candidates.map((candidate) => ({
    platform: candidate.platform,
    title: candidate.title,
    snippet: candidate.snippet,
    warmup: candidate.warmup,
  }));

  const { drafts, usage } = await write(profile, threads, slots);
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
    // Only a post whose slot offered a link may carry one (LINK_EVERY), even to the website itself.
    if (!slot.link && linksIn(`${title ?? ""} ${body}`).length > 0) continue;
    const auto = Boolean(
      slot.account.bundleAccountId &&
        slot.account.autoPost &&
        !slot.account.pausedAt &&
        // A Pin needs its board; without one it waits for the customer's click.
        (slot.platform !== "pinterest" || slot.account.target) &&
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
  for (const draft of drafts.replies) {
    if (replies >= replyBudget) break;
    const thread = candidates[draft.thread - 1];
    if (!thread || rows.some((row) => row.threadUrl === thread.url)) continue;
    // The business is named only in a disclosure saying it is the writer's own (replyText).
    const body = replyText(draft.body.trim(), draft.disclosure, brand);
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
    replies += 1;
  }

  return save(websiteId, day, rows);
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
    .select({ title: articles.title, url: articles.publishedUrl, imageUrl: articles.imageUrl })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        isNotNull(articles.publishedUrl),
        isNotNull(articles.firstLiveAt),
        isNotNull(articles.imageUrl),
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

/**
 * Saves the drafts, re-counting the day under a per-website lock so two runs
 * at once still add up to the day's ten, and skipping a discussion another
 * run has just suggested.
 */
async function save(websiteId: string, day: string, rows: (typeof socialSuggestions.$inferInsert)[]): Promise<SuggestResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`social:${websiteId}`}))`);
    const room = SUGGESTIONS_PER_DAY - (await countOnDay(websiteId, day, tx));
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
 */
async function findDiscussions(
  site: typeof websites.$inferSelect,
  accounts: SocialAccount[],
  wanted: number,
  now: Date,
  search: SuggestDeps["search"],
): Promise<Candidate[]> {
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
  const topics = terms.length > 0 ? terms : [site.industry, ...servicesOf(site)].filter((topic): topic is string => Boolean(topic));
  if (topics.length === 0) return [];

  const market = labsMarket(site.country ?? "", site.language ?? "English");
  const language = mainLanguageCode(site.language);
  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  const replying = accounts.filter((account) => PLATFORMS[account.platform as SocialPlatform].replies);
  if (replying.length === 0) return [];

  const perPlatform = new Map<SocialPlatform, Candidate[]>(replying.map((account) => [account.platform as SocialPlatform, []]));
  const searches = new Map<SocialPlatform, number>();
  const seen = new Set<string>();
  const share = Math.ceil(wanted / replying.length);
  const searchesPerPlatform = Math.min(MAX_SEARCHES_PER_PLATFORM, topics.length);

  const searchFor = async (index: number) => {
    const platform = replying[index].platform as SocialPlatform;
    const k = searches.get(platform) ?? 0;
    searches.set(platform, k + 1);
    const term = topics[(dayIndex * MAX_SEARCHES_PER_PLATFORM + index + k) % topics.length];
    let items: { url: string; title: string; description: string }[];
    try {
      ({ items } = await search(`${PLATFORMS[platform].search} ${term}`, market.location, market.language, (costUsd) =>
        track(site.organizationId, {
          kind: "seo_api",
          provider: "dataforseo",
          websiteId: site.id,
          costUsd,
          metadata: { purpose: "social_discovery", platform, costBasis: costUsd === undefined ? "unknown" : "provider_reported" },
        }),
      ));
    } catch (error) {
      // One search failing costs that search's discussions, not the day's suggestions.
      console.error("[social] discussion search failed", { websiteId: site.id, platform, error });
      return;
    }

    const found: Candidate[] = [];
    for (const item of items) {
      for (const account of replying) {
        const thread = threadFromUrl(account.platform as SocialPlatform, item.url);
        // A Quora question in another language than the website's is not one to answer.
        if (!thread || seen.has(thread.url) || (thread.language && thread.language !== language)) continue;
        seen.add(thread.url);
        found.push({ ...thread, title: item.title, snippet: item.description, warmup: inWarmup(account, now) });
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
      if (!known.has(candidate.url)) perPlatform.get(candidate.platform)!.push(candidate);
    }
  };

  for (const index of replying.keys()) await searchFor(index);
  for (let left = KEYWORDS_PER_PLATFORM * replying.length - replying.length; left > 0; left -= 1) {
    // The platform furthest short of its share; of two, the one searched less.
    const next = [...replying.keys()]
      .map((index) => {
        const platform = replying[index].platform as SocialPlatform;
        return { index, have: perPlatform.get(platform)!.length, done: searches.get(platform) ?? 0 };
      })
      .filter((entry) => entry.have < share && entry.done < searchesPerPlatform)
      .sort((a, b) => a.have - b.have || a.done - b.done)[0];
    if (!next) break;
    await searchFor(next.index);
  }

  // Round-robin across the platforms.
  const queues = [...perPlatform.values()];
  const picked: Candidate[] = [];
  while (picked.length < wanted && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < wanted) picked.push(next);
    }
  }
  return picked;
}
