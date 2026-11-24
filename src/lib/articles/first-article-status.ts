import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { startsLeft } from "@/lib/articles/pace";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { member, user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, articles, calendarItems, websites } from "@/lib/db/schema";
import { FIRST_PLAN_ATTEMPTS, FIRST_PLAN_WAITS_MS, FIRST_PLAN_WINDOW_MS, researchRuns } from "@/lib/keywords/first-plan";
import { researchInFlight } from "@/lib/keywords/research-state";
import { checkLimit } from "@/lib/usage";

/**
 * Why a website has no article yet, for administrators (client, 2026-11-24:
 * three websites signed up together and one got its article; nothing showed
 * why). Read from the same rules that decide it - the plan, the first content
 * plan (lib/keywords/first-plan.ts), the pace (lib/articles/pace.ts) - and
 * changing nothing.
 *
 * English, for the admin: `message` is a whole sentence, `waiting` says
 * whether RepGet goes on by itself or a person has to act. No personal data.
 */
export type FirstArticleCode =
  | "written"
  | "writing"
  | "writing_failed"
  | "analysing"
  | "analysis_failed"
  | "email_unconfirmed"
  | "no_plan"
  | "plan_inactive"
  | "free_paused"
  | "researching"
  | "research_not_started"
  | "research_waiting"
  | "research_gave_up"
  | "manual"
  | "articles_used"
  | "due_later"
  | "due_now";

export type FirstArticleStatus = {
  code: FirstArticleCode;
  message: string;
  /** True: RepGet continues by itself. False: somebody has to do something (or nothing is wrong, for "written"). */
  waiting: boolean;
};

const said = (code: FirstArticleCode, message: string, waiting: boolean): FirstArticleStatus => ({ code, message, waiting });

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Null for a website that does not exist. */
export async function firstArticleStatus(websiteId: string, now: Date = new Date()): Promise<FirstArticleStatus | null> {
  const [site] = await db
    .select({
      id: websites.id,
      organizationId: websites.organizationId,
      status: websites.status,
      updatedAt: websites.updatedAt,
      createdAt: websites.createdAt,
      generationMode: websites.generationMode,
    })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  if (!site) return null;

  const own = await db
    .select({ status: articles.status, written: sql<boolean>`(${articles.bodyHtml} is not null)`, error: articles.error })
    .from(articles)
    .where(and(eq(articles.websiteId, site.id), isNull(articles.translationOf)))
    .orderBy(asc(articles.createdAt));
  if (own.some((article) => article.written)) return said("written", "It has an article.", false);
  if (own.some((article) => article.status === "queued" || article.status === "generating")) {
    return said("writing", "Its first article is being written.", true);
  }

  if (site.status === "pending" || site.status === "crawling") return said("analysing", "The website is still being analysed.", true);
  if (site.status === "failed") return said("analysis_failed", "The website could not be analysed. It has to be checked again.", false);

  const limit = await checkLimit(site.id, "articles");
  if (limit.reason === "no_active_plan") {
    const [owner] = await db
      .select({ verified: user.emailVerified })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, site.organizationId))
      .orderBy(sql`case when ${member.role} = 'owner' then 0 else 1 end`, asc(member.createdAt))
      .limit(1);
    if (owner && !owner.verified) return said("email_unconfirmed", "The owner has not confirmed the email address, so neither Free nor a plan has started.", false);
    return said("no_plan", "No plan was started: neither Free nor a paid one. Nothing is written until the customer starts one.", false);
  }
  if (limit.reason === "subscription_inactive") return said("plan_inactive", "Its subscription is not active.", false);

  const failed = own.filter((article) => article.status === "failed");
  const reason = failed.at(-1)?.error ? ` Last error: ${failed.at(-1)!.error!.slice(0, 160)}` : "";

  const [calendar] = await db
    .select({
      total: sql<number>`count(*)::int`,
      next: sql<string | null>`to_char(min(${calendarItems.scheduledFor}) filter (where ${calendarItems.status} = 'planned'
        and not exists (select 1 from articles a where a.calendar_item_id = calendar_items.id)), 'YYYY-MM-DD')`,
      unstarted: sql<number>`(count(*) filter (where ${calendarItems.status} = 'planned'
        and not exists (select 1 from articles a where a.calendar_item_id = calendar_items.id)))::int`,
    })
    .from(calendarItems)
    .where(eq(calendarItems.websiteId, site.id));

  if (!calendar || Number(calendar.total) === 0) {
    if (researchInFlight(site, now)) return said("researching", "Its search terms are being researched; the content plan follows.", true);
    const [agency] = await db
      .select({ id: agencyWorkspaces.id })
      .from(agencyWorkspaces)
      .where(eq(agencyWorkspaces.organizationId, site.organizationId))
      .limit(1);
    if (agency) return said("research_not_started", "An agency website: its content plan is started by hand.", false);
    if (!(await isEntitledToSpend(site.id, { freeArticles: true })).ok) {
      return said("free_paused", "Free's AI budget is used up for now; its content plan starts when it renews.", true);
    }
    const runs = await researchRuns(site.id);
    if (runs.spent >= FIRST_PLAN_ATTEMPTS) {
      return said("research_gave_up", `The research ran ${runs.spent} times and brought no content plan. It has to be looked at.`, false);
    }
    if (now.getTime() - site.createdAt.getTime() > FIRST_PLAN_WINDOW_MS) {
      return said("research_not_started", "It was added more than two weeks ago and never got a content plan: somebody has to start the research.", false);
    }
    if (runs.total > 0) {
      const next = new Date((runs.last?.getTime() ?? now.getTime()) + FIRST_PLAN_WAITS_MS[Math.min(runs.total, FIRST_PLAN_WAITS_MS.length) - 1]);
      return said("research_waiting", `The research brought no content plan; the next try is due ${next <= now ? "now" : `at ${next.toISOString().slice(0, 16).replace("T", " ")} UTC`}.`, true);
    }
    return said("research_not_started", "Its research has not started yet; it starts within ten minutes.", true);
  }

  if (failed.length > 0) return said("writing_failed", `Its first article could not be written. RepGet tries again a few times, then goes on to the next topic.${reason}`, true);
  if (site.generationMode !== "automatic") return said("manual", "Automatic writing is switched off in its settings: articles are written when the customer presses Write.", false);
  if (Number(calendar.unstarted) === 0) return said("research_waiting", "Every planned topic has been started or removed.", false);
  if (!limit.allowed) return said("articles_used", "This month's articles are used.", true);
  if (!(await isEntitledToSpend(site.id, { freeArticles: true })).ok) return said("free_paused", "Free's AI budget is used up for now; writing continues when it renews.", true);
  const { left } = await startsLeft(site.id, now);
  if (left === 0 || (calendar.next && calendar.next > day(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)))) {
    return said("due_later", `Its next article is planned for ${calendar.next ?? "a later day"}.`, true);
  }
  return said("due_now", "Its first article is due and starts with the next writing run (06:00 or 14:00 UTC).", true);
}
