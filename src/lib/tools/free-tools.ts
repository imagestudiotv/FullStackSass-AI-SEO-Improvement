import { TOOL_SLUGS } from "@/lib/i18n/config";

/**
 * The free tools as the admin's "Free tools" page sees them (owner,
 * 2026-11-27: "it will be good this tool to be present in admin dashboard
 * for control - how much we spend ... this will allow us to keep only the
 * true value tools"). No server imports: the tools' client components and the
 * layouts' on/off gate read these too.
 *
 * A tool is one of TOOL_SLUGS, the pages under /tools. The audit (/audit) is
 * not here: it is the home page's free check, not a tool to switch off.
 */

export type FreeToolSlug = (typeof TOOL_SLUGS)[number];

export const FREE_TOOL_SLUGS: readonly FreeToolSlug[] = TOOL_SLUGS;

export function isFreeToolSlug(value: unknown): value is FreeToolSlug {
  return typeof value === "string" && (TOOL_SLUGS as readonly string[]).includes(value);
}

/**
 * How one use was answered:
 *  - on_device: the visitor's own browser AI wrote it (costs RepGet nothing);
 *  - server:    RepGet's server did the work (a model call, or a site check);
 *  - template:  a fixed template in the page, when neither was available.
 */
export const TOOL_USE_PATHS = ["on_device", "server", "template"] as const;
export type ToolUsePath = (typeof TOOL_USE_PATHS)[number];

export function isToolUsePath(value: unknown): value is ToolUsePath {
  return typeof value === "string" && (TOOL_USE_PATHS as readonly string[]).includes(value);
}

/**
 * The tools with a paid AI call on the server: only these have a daily
 * spend cap. The others cost RepGet a fetch, not a model call.
 */
export const AI_FREE_TOOLS: readonly FreeToolSlug[] = ["blog-writer", "social-media-post-generator", "meta-description-generator", "growth-copilot"];

/**
 * The tool attribution cookie: "<slug>.<unix seconds>", the last free tool
 * this browser USED (not merely opened). Read once, by the sign-up hook
 * (lib/auth.ts), to count sign-ups that came from a tool. First-party,
 * SameSite=Lax so it survives the round trip to Google sign-in. Like the
 * referral and partner cookies it is attribution, not analytics: it holds a
 * tool's name and a time, nothing about the person.
 *
 * WRITTEN BY THE PAGE, not by a server action: a cookie set in a server
 * action makes Next re-render the whole current page and its layouts - on
 * the home page's copilot chat, after every answer. So it is not httpOnly;
 * a forged value only miscounts one sign-up, never grants anything.
 *
 * NOT ?ref=: that parameter is the affiliate partners' link
 * (lib/partners/presentation/link-redirect.ts) and would send a tool's
 * visitor through /go/<code> as somebody's referral.
 */
export const TOOL_COOKIE = "repget_tool";

/** A sign-up counts for the tool used within this many days before it. */
export const TOOL_ATTRIBUTION_DAYS = 30;

export function toolCookieValue(tool: FreeToolSlug, usedAt: Date): string {
  return `${tool}.${Math.floor(usedAt.getTime() / 1000)}`;
}

/** Remembers in this browser that it used `tool` (call after a result is shown). Never throws. */
export function rememberToolUse(tool: FreeToolSlug, now: Date = new Date()): void {
  try {
    const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TOOL_COOKIE}=${toolCookieValue(tool, now)}; Max-Age=${TOOL_ATTRIBUTION_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: the sign-up simply is not attributed.
  }
}

export function parseToolCookie(value: string | null | undefined): { tool: FreeToolSlug; usedAt: Date } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const tool = value.slice(0, dot);
  const seconds = value.slice(dot + 1);
  if (!isFreeToolSlug(tool) || !/^\d{1,12}$/.test(seconds)) return null;
  return { tool, usedAt: new Date(Number(seconds) * 1000) };
}
