import "server-only";

import { randomUUID } from "node:crypto";

import * as cheerio from "cheerio";
import { and, eq, sql } from "drizzle-orm";

import { MODELS } from "@/lib/ai/client";
import { siteScope } from "@/lib/articles/link-guard";
import { reviewStatusForNewDraft } from "@/lib/articles/review";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { articles, articleTranslationAttempts, spendReservations, websites } from "@/lib/db/schema";
import { articleAllowanceKey, track } from "@/lib/usage";
import { normalizeLanguage } from "@/lib/websites/languages";

import { languageName } from "./translation-languages";
import { translateArticle, TranslationError } from "./translate-article";

/**
 * A customer's articles in the website's other languages (client,
 * 2026-10-20, Image Studio: "note that we have other 2 additional
 * languages: italian and spanish").
 *
 * Article Settings, "Also publish in", lists the languages the site's own
 * inventory found (websites.site_languages, from its hreflang links). Each
 * article that goes live from then on is translated into each chosen one -
 * once, from the text that went live, so a review or an edit before it went
 * out is in the translation - and saved as an article of its own:
 * articles.translation_of names the original, language_code the language.
 *
 *  - Sent only by the WordPress plugin, 1.9.0 or later, which files it under
 *    its language in WPML, linked to the original's post (repget-connector,
 *    "Translations"); no other path publishes one (claimDispatch holds it).
 *    Nothing is translated for a site without that plugin.
 *  - It takes no article from the plan: a released reservation of its own
 *    covers it in the article ledger (lib/usage.ts uncoveredArticles), so
 *    neither the allowance trigger nor the count charges it.
 *  - Not on the free articles: like every other paid call after them, it
 *    needs an active plan (isEntitledToSpend).
 *  - The RepGet team's review applies as to any new draft
 *    (reviewStatusForNewDraft); without it, it goes out on the next check.
 *  - Claude Haiku 5.5 (lib/articles/translate-article.ts), about $0.01-0.03
 *    each, recorded in usage_events against the website. At most
 *    TRANSLATION_MAX_TRIES tries per article and language, an hour apart.
 */

export const TRANSLATION_MAX_TRIES = 3;
export const TRANSLATION_RETRY_MS = 60 * 60 * 1000;
export const TRANSLATIONS_PER_RUN = 10;

export type TranslationDue = { articleId: string; websiteId: string; organizationId: string; language: string };

/**
 * Live originals still missing a chosen language, oldest first: on a site
 * whose RepGet plugin is 1.9.0 or later, live since the language was
 * chosen, and not tried TRANSLATION_MAX_TRIES times or within the hour.
 */
export async function translationsDue(limit = TRANSLATIONS_PER_RUN, now: Date = new Date()): Promise<TranslationDue[]> {
  const retryAfter = new Date(now.getTime() - TRANSLATION_RETRY_MS);
  const result = await db.execute(sql`
    select a.id as "articleId", a.website_id as "websiteId", w.organization_id as "organizationId", l.code as "language"
    from ${articles} a
    join ${websites} w on w.id = a.website_id
    cross join lateral jsonb_array_elements_text(w.extra_languages) as l(code)
    where a.translation_of is null
      and a.status = 'published'
      and a.published_url is not null
      and a.body_html is not null
      and a.first_live_at is not null
      and w.extra_languages_since is not null
      and a.first_live_at >= w.extra_languages_since
      and not exists (select 1 from ${articles} t where t.translation_of = a.id and t.language_code = l.code)
      and not exists (
        select 1 from ${articleTranslationAttempts} x
        where x.article_id = a.id and x.language = l.code
          and (x.attempts >= ${TRANSLATION_MAX_TRIES} or x.last_tried_at > ${retryAfter.toISOString()}::timestamp)
      )
      and exists (
        select 1 from integration_keys k
        where k.website_id = w.id and k.revoked_at is null
          and string_to_array(substring(k.site_info from 'plugin ([0-9]+[.][0-9]+[.][0-9]+)'), '.')::int[] >= array[1, 9, 0]
      )
    order by a.first_live_at asc
    limit ${limit}`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as TranslationDue[];
  return rows.map((row) => ({ articleId: row.articleId, websiteId: row.websiteId, organizationId: row.organizationId, language: row.language }));
}

const wordsIn = (html: string) => cheerio.load(`<div>${html}</div>`)("div").text().split(/\s+/).filter(Boolean).length;

export type TranslationOutcome =
  | { status: "made"; translationId: string; costUsd: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string; costUsd: number };

/** Translates one live article into one language and saves it. Never throws for a translation that fails: the outcome says so. */
export async function translateLiveArticle(due: TranslationDue): Promise<TranslationOutcome> {
  const entitled = await isEntitledToSpend(due.websiteId);
  if (!entitled.ok) return { status: "skipped", reason: "no active plan" };

  const [row] = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      language: websites.language,
      url: websites.url,
      domain: websites.domain,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .where(and(eq(articles.id, due.articleId), eq(articles.websiteId, due.websiteId)))
    .limit(1);
  const to = languageName(due.language);
  if (!row?.bodyHtml || !to) return { status: "skipped", reason: !to ? "not a language RepGet writes" : "no article" };

  // The try counts before anything is spent: a job that dies mid-call still used one.
  const [tried] = await db
    .insert(articleTranslationAttempts)
    .values({ articleId: due.articleId, language: due.language, attempts: 1, lastTriedAt: new Date() })
    .onConflictDoUpdate({
      target: [articleTranslationAttempts.articleId, articleTranslationAttempts.language],
      set: { attempts: sql`${articleTranslationAttempts.attempts} + 1`, lastTriedAt: new Date() },
    })
    .returning({ attempts: articleTranslationAttempts.attempts });
  if (tried.attempts > TRANSLATION_MAX_TRIES) return { status: "skipped", reason: "tried enough" };

  const record = (usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number; calls: number }, extra: Record<string, unknown>) =>
    usage.calls === 0
      ? Promise.resolve()
      : track(due.organizationId, {
          kind: "llm",
          websiteId: due.websiteId,
          provider: "anthropic",
          model: MODELS.ARTICLE_TRANSLATION,
          quantity: usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
          costUsd: usage.costUsd,
          metadata: { purpose: "article_translation", originalId: due.articleId, language: due.language, ...usage, ...extra },
        });

  let translated;
  try {
    translated = await translateArticle({
      title: row.title,
      slug: row.slug,
      metaDescription: row.metaDescription,
      imageAlt: row.imageAlt,
      bodyHtml: row.bodyHtml,
      from: normalizeLanguage(row.language) ?? "English",
      to,
      siteHosts: siteScope({ url: row.url, domain: row.domain }).hosts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The translation failed.";
    const usage = error instanceof TranslationError ? error.usage : null;
    if (usage) await record(usage, { outcome: "failed" });
    await db
      .update(articleTranslationAttempts)
      .set({ lastError: message.slice(0, 500) })
      .where(and(eq(articleTranslationAttempts.articleId, due.articleId), eq(articleTranslationAttempts.language, due.language)));
    return { status: "failed", error: message, costUsd: usage?.costUsd ?? 0 };
  }

  const translationId = randomUUID();
  const saved = await db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.translationOf, due.articleId), eq(articles.languageCode, due.language)))
      .limit(1);
    if (taken) return false;
    /*
      Its own reservation, released at once: the article ledger then knows
      this row and does not charge it (the allowance trigger and
      uncoveredArticles skip an article whose own reservation exists, in any
      state; only reserved and consumed ones count).
    */
    const now = new Date();
    await tx.insert(spendReservations).values({
      key: articleAllowanceKey(due.websiteId),
      operation: "article.translation",
      organizationId: due.organizationId,
      websiteId: due.websiteId,
      state: "released",
      limitValue: 0,
      countedAt: now,
      releasedAt: now,
      releaseReason: "translation_takes_no_article",
      subjectId: translationId,
      metadata: { articleId: translationId, originalId: due.articleId, language: due.language },
    });
    await tx.insert(articles).values({
      id: translationId,
      websiteId: due.websiteId,
      translationOf: due.articleId,
      languageCode: due.language,
      title: translated.title,
      slug: translated.slug,
      metaDescription: translated.metaDescription,
      bodyHtml: translated.bodyHtml,
      wordCount: wordsIn(translated.bodyHtml),
      status: "draft",
      imageUrl: row.imageUrl,
      imageAlt: translated.imageAlt ?? row.imageAlt,
      reviewStatus: await reviewStatusForNewDraft(tx, due.websiteId),
    });
    return true;
  });
  await record(translated.usage, { outcome: saved ? "made" : "duplicate", articleId: saved ? translationId : undefined });
  if (!saved) return { status: "skipped", reason: "already translated" };
  return { status: "made", translationId, costUsd: translated.usage.costUsd };
}
