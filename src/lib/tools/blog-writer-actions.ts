"use server";

import { headers } from "next/headers";

import { isLocale } from "@/lib/i18n/config";
import { visitorKey } from "@/lib/visitor-key";

import { writeBlogOpening } from "./blog-writer";
import { cleanBrief, type BlogWriterOutcome } from "./blog-writer-shared";
import { recordReportedUse } from "./tool-tracking";

/**
 * The free AI Blog Writer's two calls from the browser
 * (components/blog-writer). Who is asking comes from the request, never from
 * the browser's word (lib/visitor-key.ts). Everything sent is checked here:
 * a server action is a public endpoint.
 */

/** The server's opening, when the browser has no AI of its own. */
export async function writeBlogOpeningAction(input: { topic: string; format: string; notes: string; locale: string }): Promise<BlogWriterOutcome> {
  const brief = cleanBrief(input);
  if (!brief) return { ok: false, reason: "invalid" };
  const locale = isLocale(input?.locale) ? input.locale : "en";
  return writeBlogOpening(brief, locale, visitorKey(await headers()));
}

/** An opening the browser wrote itself (its own AI, or the template): counted, for Admin -> Free tools. */
export async function recordBlogWriterUseAction(input: { path: string; locale: string }): Promise<void> {
  const path = input?.path === "on_device" ? "on_device" : input?.path === "template" ? "template" : null;
  if (!path) return;
  const locale = isLocale(input?.locale) ? input.locale : "en";
  await recordReportedUse({ tool: "blog-writer", path, visitor: visitorKey(await headers()), locale });
}
