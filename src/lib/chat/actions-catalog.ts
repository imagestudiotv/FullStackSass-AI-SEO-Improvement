import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { generateFromCalendarItem } from "@/lib/articles/actions";
import { startAudit } from "@/lib/audit/actions";
import { addTarget } from "@/lib/backlinks/network-settings";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { snoozeNextAction } from "@/lib/dashboard/next-action-actions";
import { db } from "@/lib/db";
import { calendarItems, videoIdeas } from "@/lib/db/schema";
import { addKeywords } from "@/lib/keywords/actions";
import { findSocialSuggestions } from "@/lib/social/actions";
import { approveVideoIdea, requestVideoIdeas } from "@/lib/video/actions";

import { CHAT_ACTION_KINDS, type ChatActionKind } from "./action-kinds";
import type { ChatContext } from "./tools";

/**
 * What the assistant can offer to do. It never does it: it proposes, the
 * customer sees a card with the price and presses Confirm, and only then the
 * action runs - through the same server action as its own page, so the same
 * checks (an editor, a plan, enough credits, rate limits) and the same price.
 *
 * Each proposal is checked here before the card is shown: the article, idea or
 * task it names must belong to this website.
 */

type JsonSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };

export type Checked = { ok: true; input: Record<string, unknown>; details: string } | { ok: false; reason: string };
export type Outcome = { ok: true; note: string | null } | { ok: false; error: string };

type ActionSpec = {
  description: string;
  input_schema: JsonSchema;
  check: (ctx: ChatContext, input: Record<string, unknown>) => Promise<Checked>;
  run: (websiteId: string, input: Record<string, unknown>) => Promise<Outcome>;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const uuid = (value: unknown) => (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null);
const fromResult = (result: { ok: true } | { ok: false; error: string }, note: string | null = null): Outcome =>
  result.ok ? { ok: true, note } : { ok: false, error: result.error };

export const ACTION_SPECS: Record<ChatActionKind, ActionSpec> = {
  add_topics: {
    description:
      "Offer to add topics (keywords) to the website's planned articles. RepGet then plans and writes them as part of the plan's monthly articles. 1 to 10 topics, each a short search phrase.",
    input_schema: { type: "object", properties: { topics: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 } }, required: ["topics"] },
    check: async (_ctx, input) => {
      const topics = (Array.isArray(input.topics) ? input.topics : []).map((t) => text(t, 120).replace(/,/g, " ")).filter(Boolean).slice(0, 10);
      return topics.length ? { ok: true, input: { topics }, details: topics.join(" · ") } : { ok: false, reason: "no topics" };
    },
    run: async (websiteId, input) => {
      const result = await addKeywords(websiteId, (input.topics as string[]).join("\n"));
      return fromResult(result, result.ok ? `added:${result.data.added}` : null);
    },
  },
  write_article: {
    description: "Offer to write one of the planned articles now, instead of on its planned day. Needs its calendarItemId from get_articles. Uses one of the plan's monthly articles.",
    input_schema: { type: "object", properties: { calendarItemId: { type: "string" } }, required: ["calendarItemId"] },
    check: async (ctx, input) => {
      const id = uuid(input.calendarItemId);
      if (!id) return { ok: false, reason: "calendarItemId is not an id from get_articles" };
      const [item] = await db
        .select({ title: calendarItems.title, status: calendarItems.status })
        .from(calendarItems)
        .where(and(eq(calendarItems.id, id), eq(calendarItems.websiteId, ctx.websiteId)));
      if (!item) return { ok: false, reason: "no planned article with that id on this website" };
      return { ok: true, input: { calendarItemId: id }, details: item.title };
    },
    run: async (websiteId, input) => fromResult(await generateFromCalendarItem(websiteId, input.calendarItemId as string)),
  },
  rerun_website_check: {
    description: "Offer to run the website check (site audit) again, e.g. after fixing issues. Costs credits after the first check.",
    input_schema: { type: "object", properties: {} },
    check: async (ctx) => ({ ok: true, input: {}, details: ctx.domain }),
    run: async (websiteId) => fromResult(await startAudit(websiteId)),
  },
  find_social_posts: {
    description: "Offer to look for new social media suggestions now (posts and replies to discussions). Finding them is free; each post costs a credit when posted from the Social media page.",
    input_schema: { type: "object", properties: {} },
    check: async () => ({ ok: true, input: {}, details: "" }),
    run: async (websiteId) => {
      const result = await findSocialSuggestions(websiteId);
      return result.ok ? { ok: true, note: null } : { ok: false, error: result.error };
    },
  },
  make_video: {
    description: "Offer to make one of today's video ideas into a video (reel or carousel). Needs its ideaId from get_videos. Costs the video price in credits.",
    input_schema: { type: "object", properties: { ideaId: { type: "string" } }, required: ["ideaId"] },
    check: async (ctx, input) => {
      const id = uuid(input.ideaId);
      if (!id) return { ok: false, reason: "ideaId is not an id from get_videos" };
      const [idea] = await db
        .select({ title: videoIdeas.title })
        .from(videoIdeas)
        .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, ctx.websiteId), inArray(videoIdeas.status, ["new", "failed"])));
      if (!idea) return { ok: false, reason: "no video idea with that id waiting on this website" };
      return { ok: true, input: { ideaId: id }, details: idea.title };
    },
    run: async (websiteId, input) => {
      const result = await approveVideoIdea(websiteId, input.ideaId as string, {}, "chat");
      return result.ok ? { ok: true, note: null } : { ok: false, error: result.error };
    },
  },
  new_video_ideas: {
    description: "Offer to write today's video ideas now, when there are none yet today (up to 20 a day; free).",
    input_schema: { type: "object", properties: {} },
    check: async () => ({ ok: true, input: {}, details: "" }),
    run: async (websiteId) => {
      const result = await requestVideoIdeas(websiteId);
      return result.ok ? { ok: true, note: null } : { ok: false, error: result.error };
    },
  },
  snooze_task: {
    description: "Offer to hide a task from the task list for 7 days. Needs the task id from get_overview.",
    input_schema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    check: async (ctx, input) => {
      const id = text(input.taskId, 80);
      const tasks = await getNextActions(ctx.websiteId, ctx.ownerOrgId, true);
      const task = tasks.find((t) => t.id === id);
      if (!task) return { ok: false, reason: "no task with that id in the task list" };
      return { ok: true, input: { taskId: id }, details: task.detail ?? task.kind };
    },
    run: async (websiteId, input) => {
      const form = new FormData();
      form.set("taskId", input.taskId as string);
      try {
        await snoozeNextAction(websiteId, form);
        return { ok: true, note: null };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "failed" };
      }
    },
  },
  add_backlink_page: {
    description: "Offer to add a page of this website to the backlink exchange's target pages, so other sites link to it. The address must be on the website's own domain.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    check: async (ctx, input) => {
      const url = text(input.url, 500);
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host !== ctx.domain.replace(/^www\./, "")) return { ok: false, reason: "the address is not on the website's domain" };
      } catch {
        return { ok: false, reason: "not a valid address" };
      }
      return { ok: true, input: { url }, details: url };
    },
    run: async (websiteId, input) => fromResult(await addTarget(websiteId, { url: input.url as string })),
  },
};

export { CHAT_ACTION_KINDS };
