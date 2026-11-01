import "server-only";

import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { getPerformance } from "@/lib/analytics/actions";
import { listArticles } from "@/lib/articles/actions";
import { getTrafficChanges } from "@/lib/articles/refresh-actions";
import { getLatestAudit } from "@/lib/audit/actions";
import { getNetworkStatus, listRequests } from "@/lib/backlinks/actions";
import { creditOverview } from "@/lib/credits/overview";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { db } from "@/lib/db";
import { socialSuggestions, videoIdeas } from "@/lib/db/schema";
import { getGeoOverview } from "@/lib/geo/actions";
import { listCalendar } from "@/lib/keywords/actions";

import type { ChatPage } from "./config";

/**
 * What the assistant can look up: the same functions the RepGet pages show,
 * read for the one website the chat is about, each answer cut to what helps
 * (lists capped, long text shortened). Each tool names the page the
 * customer would open for more; the answer offers it as a button.
 */

export type ChatContext = {
  websiteId: string;
  /** The workspace that pays for the website: its credits, its free messages. */
  ownerOrgId: string;
  userId: string;
  access: "owner" | "editor";
  domain: string;
  brandName: string | null;
  /** The language the answer is written in (en, es, fr, it, de). */
  locale: string;
  level: "paid" | "trial";
};

type JsonSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };

export type ReadTool = {
  name: string;
  description: string;
  input_schema: JsonSchema;
  page: ChatPage | null;
  run: (ctx: ChatContext, input: Record<string, unknown>) => Promise<unknown>;
};

const short = (text: string | null | undefined, max = 160) => {
  const line = (text ?? "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
};
const day = (date: Date | string | null | undefined) => (date ? new Date(date).toISOString().slice(0, 10) : null);
const noInput: JsonSchema = { type: "object", properties: {} };

export const READ_TOOLS: ReadTool[] = [
  {
    name: "get_overview",
    description:
      "The website at a glance: today's article, recent wins, best articles, Google and AI-visibility headline figures, backlinks, the workspace's credits, and the task list (Next actions, with each task's id). Start here for broad questions like 'how is my website doing' or 'what should I do first'.",
    input_schema: noInput,
    page: "dashboard",
    run: async (ctx) => {
      const [overview, tasks] = await Promise.all([
        getDashboardOverview({ websiteId: ctx.websiteId, ownerOrgId: ctx.ownerOrgId, showCredits: ctx.access === "owner" }),
        getNextActions(ctx.websiteId, ctx.ownerOrgId, true),
      ]);
      return {
        website: { domain: ctx.domain, brand: ctx.brandName, plan: ctx.level === "trial" ? "free trial" : "paid plan" },
        todaysArticle: overview?.todaysArticle,
        wins: overview?.wins,
        bestArticles: overview?.bestArticles,
        search: overview?.search,
        backlinks: overview?.backlinks,
        credits: overview?.credits ?? "only the workspace owner sees the credits",
        tasks: tasks.map((task) => ({ id: task.id, kind: task.kind, priority: task.priority, detail: short(task.detail), page: task.href })),
      };
    },
  },
  {
    name: "get_search_performance",
    description:
      "Google Search Console and Google Analytics for a period: clicks, impressions, average position, sessions, the same figures for the period before, top queries and top pages. Use for traffic, rankings and 'which pages/keywords bring visitors'.",
    input_schema: { type: "object", properties: { days: { type: "integer", enum: [7, 28, 90], description: "Period length in days (default 28)." } } },
    page: "google",
    run: async (ctx, input) => {
      const days = [7, 28, 90].includes(Number(input.days)) ? Number(input.days) : 28;
      const report = await getPerformance(ctx.websiteId, days);
      if (!report.hasData) return { days, hasData: false, note: "No Google data yet: Google is not connected or has not reported this period." };
      return {
        days,
        ...report,
        topQueries: report.topQueries.slice(0, 10),
        topPages: report.topPages.slice(0, 10),
      };
    },
  },
  {
    name: "get_losing_traffic",
    description: "Pages that are losing clicks or visibility in Google compared with before, and pages to watch. Use for 'why did my traffic drop'.",
    input_schema: noInput,
    page: "losing_traffic",
    run: async (ctx) => {
      const report = await getTrafficChanges(ctx.websiteId);
      return {
        ...report,
        losingClicks: report.losingClicks.slice(0, 10),
        losingVisibility: report.losingVisibility.slice(0, 10),
        watch: report.watch.slice(0, 10),
      };
    },
  },
  {
    name: "get_articles",
    description:
      "The website's articles (written, published, failed, drafts) and the planned articles still to be written (with their calendar item ids and dates). Use for content questions and before offering to write an article.",
    input_schema: noInput,
    page: "planned_articles",
    run: async (ctx) => {
      const [articles, plan] = await Promise.all([listArticles(ctx.websiteId), listCalendar(ctx.websiteId)]);
      const byStatus: Record<string, number> = {};
      for (const article of articles) byStatus[article.status] = (byStatus[article.status] ?? 0) + 1;
      const upcoming = plan.filter((item) => item.status === "planned");
      return {
        articlesByStatus: byStatus,
        recentArticles: articles
          .slice()
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
          .slice(0, 15)
          .map((a) => ({ title: short(a.title, 120), keyword: a.targetKeyword, status: a.status, language: a.languageCode, updated: day(a.updatedAt), error: a.error ? short(a.error, 120) : undefined })),
        plannedCount: upcoming.length,
        planned: upcoming.slice(0, 20).map((item) => ({ calendarItemId: item.id, title: short(item.title, 120), keyword: item.targetKeyword, scheduledFor: day(item.scheduledFor) })),
      };
    },
  },
  {
    name: "get_website_health",
    description: "The latest website check (site audit): score, pages crawled, issue counts and the most important issues with their pages.",
    input_schema: noInput,
    page: "website_health",
    run: async (ctx) => {
      const { audit } = await getLatestAudit(ctx.websiteId);
      if (!audit) return { checked: false, note: "The website has not been checked yet." };
      return {
        checked: true,
        checkedOn: day(audit.createdAt),
        score: audit.score,
        pagesCrawled: audit.summary?.pagesCrawled,
        counts: audit.summary?.counts,
        topIssues: audit.summary?.topIssues,
        issues: audit.issues.slice(0, 15).map((issue) => ({ type: issue.type, severity: issue.severity, page: issue.url, detail: short(issue.detail, 140) })),
      };
    },
  },
  {
    name: "get_ai_visibility",
    description: "AI visibility: how often ChatGPT, Gemini and Perplexity mention the brand for the tracked questions, its score, the competitors they name instead, and each question's latest result.",
    input_schema: noInput,
    page: "ai_visibility",
    run: async (ctx) => {
      const geo = await getGeoOverview(ctx.websiteId);
      return {
        ...geo,
        prompts: geo.prompts
          .filter((prompt) => prompt.active)
          .slice(0, 12)
          .map((prompt) => ({ question: short(prompt.prompt, 140), mentioned: prompt.latest?.mentioned ?? null, position: prompt.latest?.position ?? null, checked: day(prompt.latest?.checkedAt) })),
      };
    },
  },
  {
    name: "get_backlinks",
    description: "The backlink exchange: whether the website takes part, links received and given this month, the credit balance for links, and recent link requests with their status.",
    input_schema: noInput,
    page: "backlinks",
    run: async (ctx) => {
      const [status, requests] = await Promise.all([getNetworkStatus(ctx.websiteId), listRequests(ctx.websiteId)]);
      return {
        status,
        recentRequests: requests.slice(0, 10).map((r) => ({ target: r.targetUrl, status: r.status, host: r.hostDomain, liveUrl: r.liveUrl, created: day(r.createdAt) })),
      };
    },
  },
  {
    name: "get_social",
    description: "Social media: the suggestions waiting (posts and replies, with platform) and what was posted recently with its address.",
    input_schema: noInput,
    page: "social",
    run: async (ctx) => {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const [waiting, posted] = await Promise.all([
        db
          .select()
          .from(socialSuggestions)
          .where(and(eq(socialSuggestions.websiteId, ctx.websiteId), inArray(socialSuggestions.status, ["new", "scheduled", "failed"]), gte(socialSuggestions.createdAt, since)))
          .orderBy(desc(socialSuggestions.createdAt))
          .limit(12),
        db
          .select()
          .from(socialSuggestions)
          .where(and(eq(socialSuggestions.websiteId, ctx.websiteId), eq(socialSuggestions.status, "posted")))
          .orderBy(desc(socialSuggestions.postedAt))
          .limit(10),
      ]);
      const row = (s: typeof socialSuggestions.$inferSelect) => ({ platform: s.platform, kind: s.kind, status: s.status, text: short(s.title ?? s.body, 140), thread: short(s.threadTitle, 100) || undefined });
      return { waiting: waiting.map(row), posted: posted.map((s) => ({ ...row(s), url: s.postedUrl, postedOn: day(s.postedAt) })) };
    },
  },
  {
    name: "get_videos",
    description: "Videos: today's video ideas not yet made (with their idea ids), videos being made or ready, and videos posted with their views.",
    input_schema: noInput,
    page: "videos",
    run: async (ctx) => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 30 * 86_400_000);
      const [ideas, made] = await Promise.all([
        db
          .select()
          .from(videoIdeas)
          .where(and(eq(videoIdeas.websiteId, ctx.websiteId), eq(videoIdeas.day, today), inArray(videoIdeas.status, ["new", "failed"])))
          .limit(20),
        db
          .select()
          .from(videoIdeas)
          .where(and(eq(videoIdeas.websiteId, ctx.websiteId), inArray(videoIdeas.status, ["approved", "making", "ready", "scheduled", "posting", "posted"]), gte(videoIdeas.updatedAt, since)))
          .orderBy(desc(videoIdeas.updatedAt))
          .limit(15),
      ]);
      return {
        ideasToday: ideas.map((idea) => ({ ideaId: idea.id, title: short(idea.title, 100), format: idea.format, style: idea.style, status: idea.status })),
        videos: made.map((idea) => ({ title: short(idea.title, 100), format: idea.format, status: idea.status, posted: day(idea.postedAt), stats: idea.stats ?? undefined })),
      };
    },
  },
  {
    name: "get_credits",
    description: "The workspace's credits: balance, reserved, available, the daily free credits and what each action costs.",
    input_schema: noInput,
    page: "credits",
    run: async (ctx) => {
      if (ctx.access !== "owner") return { note: "Only the workspace owner can see the credits." };
      return creditOverview(ctx.ownerOrgId);
    },
  },
];

export function readTool(name: string): ReadTool | undefined {
  return READ_TOOLS.find((tool) => tool.name === name);
}

/** A tool's answer as text for the model, cut at `max` characters. */
export function toolText(value: unknown, max = 8000): string {
  const text = JSON.stringify(value, (_key, v) => (v === undefined ? undefined : v));
  return text.length > max ? `${text.slice(0, max)}... (cut)` : text;
}
