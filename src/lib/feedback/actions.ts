"use server";

import { headers } from "next/headers";

import { getSession } from "@/lib/auth-guard";
import { visitorKey } from "@/lib/visitor-key";

import { submitFeedback } from "./send";
import { FEEDBACK_LIMITS, type FeedbackResult } from "./shared";

/**
 * Sends feedback from either form: the dashboard's "Send feedback" (a
 * signed-in customer: their account address is used, and the message is
 * linked to them) or the public site's (anyone; an address to reply to is
 * required). The checks and limits are lib/feedback/send.ts's.
 *
 * Fields: kind, message, email, name, page, locale, source ("dashboard" |
 * "website"), elapsed (milliseconds the form was open), company (the field
 * only a bot fills in), and an optional screenshot file - already shrunk by
 * the form (shrinkScreenshot), since an action takes 1 MB in all.
 */
export async function sendFeedback(form: FormData): Promise<FeedbackResult> {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const session = await getSession().catch(() => null);

  let screenshot: { data: Buffer; type: string } | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > FEEDBACK_LIMITS.screenshotBytes) return { ok: false, code: "screenshot_size" };
    screenshot = { data: Buffer.from(await file.arrayBuffer()), type: file.type };
  }

  const result = await submitFeedback(
    {
      kind: field("kind"),
      message: field("message"),
      email: field("email"),
      name: field("name"),
      pageUrl: field("page"),
      locale: field("locale"),
      screenshot,
      trap: field("company"),
      elapsedMs: Number(field("elapsed")),
    },
    {
      // "From the dashboard" only for someone signed in.
      source: field("source") === "dashboard" && session ? "dashboard" : "website",
      visitor: visitorKey(await headers()),
      userId: session?.user.id ?? null,
      accountEmail: session?.user.email ?? null,
      organizationId: session?.session.activeOrganizationId ?? null,
    },
  );
  return result.ok ? { ok: true } : result;
}
