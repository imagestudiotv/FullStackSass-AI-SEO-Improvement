import "server-only";

import sharp from "sharp";

import { consumeReservation, reserveAll, type QuotaRule, type Reservation } from "@/lib/billing/spend-quota";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { isLocale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

import { emailNewFeedback } from "./notify";
import {
  FEEDBACK_KINDS,
  FEEDBACK_LIMITS,
  isEmailAddress,
  linkCount,
  SCREENSHOT_TYPES,
  type FeedbackKind,
  type FeedbackResult,
} from "./shared";

/**
 * Receiving feedback for RepGet (client, 2026-10-19: from customers and site
 * visitors; an idea, a problem or anything else, with an optional
 * screenshot; administrators follow it up). The forms post through
 * lib/feedback/actions.ts; this checks, limits and stores it, then tells the
 * administrators.
 *
 * Open to anyone on the public site, so it is guarded like the free tools:
 *  - limits per visitor (5 an hour, 20 a day), per signed-in customer (10 a
 *    day) and overall (100 an hour), counted in the shared ledger
 *    (lib/billing/spend-quota.ts) in the same transaction as the message;
 *  - a field only bots fill in, and a form sent faster than a person can
 *    type: both are answered "thank you" and nothing is stored or sent;
 *  - more than five links is refused, as spam usually is;
 *  - a screenshot must decode as an image, and is re-encoded here: whatever
 *    else the file carried is not kept.
 */

export const FEEDBACK_RATE = { perVisitorPerHour: 5, perVisitorPerDay: 20, perUserPerDay: 10, globalPerHour: 100 };

/** Faster than this from the form appearing to it being sent is not a person writing. */
export const MIN_ELAPSED_MS = 3000;

export type FeedbackInput = {
  kind: string;
  message: string;
  /** What a visitor typed; a signed-in customer's account address is used instead. */
  email: string;
  name: string;
  /** The page the form was on. */
  pageUrl: string;
  locale: string;
  screenshot: { data: Buffer; type: string } | null;
  /** A field people never see; only a bot fills it in. */
  trap: string;
  /** From the form appearing to it being sent. */
  elapsedMs: number;
};

export type FeedbackSender = {
  source: "dashboard" | "website";
  /** The hashed visitor key (lib/visitor-key.ts). */
  visitor: string;
  userId: string | null;
  accountEmail: string | null;
  organizationId: string | null;
};

const oneLine = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/** The page, when it is one of RepGet's own; an address elsewhere is not kept. */
function ownPage(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const site = new URL(siteUrl());
    const url = new URL(raw, site);
    const host = (value: string) => value.toLowerCase().replace(/^www\./, "");
    if (host(url.hostname) !== host(site.hostname)) return null;
    return `${site.origin}${url.pathname}${url.search}`.slice(0, 500);
  } catch {
    return null;
  }
}

/** Re-encodes a screenshot as WebP, at most FEEDBACK_LIMITS.screenshotWidth wide; null when it is not an image. */
async function reencode(data: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(data, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: FEEDBACK_LIMITS.screenshotWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}

function rules(sender: FeedbackSender): QuotaRule[] {
  return [
    { key: `feedback:visitor:${sender.visitor}`, limit: FEEDBACK_RATE.perVisitorPerHour, window: { seconds: 3600 } },
    { key: `feedback:visitor-day:${sender.visitor}`, limit: FEEDBACK_RATE.perVisitorPerDay, window: { seconds: 86_400 } },
    ...(sender.userId ? [{ key: `feedback:user:${sender.userId}`, limit: FEEDBACK_RATE.perUserPerDay, window: { seconds: 86_400 } }] : []),
    { key: "feedback:global", limit: FEEDBACK_RATE.globalPerHour, window: { seconds: 3600 } },
  ];
}

export async function submitFeedback(input: FeedbackInput, sender: FeedbackSender): Promise<FeedbackResult & { id?: string }> {
  // A bot is thanked like anyone else, so it learns nothing; nothing is stored or sent.
  if (input.trap.trim() || !(input.elapsedMs >= MIN_ELAPSED_MS)) return { ok: true };

  const kind = FEEDBACK_KINDS.find((candidate) => candidate === input.kind);
  if (!kind) return { ok: false, code: "kind" };
  const message = String(input.message ?? "").trim();
  if (message.length < FEEDBACK_LIMITS.messageMin) return { ok: false, code: "message_short" };
  if (message.length > FEEDBACK_LIMITS.message) return { ok: false, code: "message_long" };
  if (linkCount(message) > FEEDBACK_LIMITS.links) return { ok: false, code: "links" };
  const email = (sender.accountEmail ?? oneLine(input.email)).toLowerCase();
  if (!isEmailAddress(email)) return { ok: false, code: "email" };
  const name = oneLine(input.name);
  if (name.length > FEEDBACK_LIMITS.name) return { ok: false, code: "name" };

  let screenshot: Buffer | null = null;
  if (input.screenshot) {
    if (!(SCREENSHOT_TYPES as readonly string[]).includes(input.screenshot.type)) return { ok: false, code: "screenshot_type" };
    if (input.screenshot.data.length > FEEDBACK_LIMITS.screenshotBytes) return { ok: false, code: "screenshot_size" };
    screenshot = await reencode(input.screenshot.data);
    if (!screenshot) return { ok: false, code: "screenshot_unreadable" };
  }

  type Saved =
    | { refused: "busy" | "too_many" }
    | { refused: null; row: { id: string; pageUrl: string | null }; reservations: Reservation[] };
  const saved = await db.transaction(async (tx): Promise<Saved> => {
    const admitted = await reserveAll(
      rules(sender),
      { operation: "feedback.send", organizationId: sender.organizationId, metadata: { source: sender.source } },
      { executor: tx },
    );
    if (!admitted.ok) return { refused: admitted.rule.key === "feedback:global" ? ("busy" as const) : ("too_many" as const) };
    const [row] = await tx
      .insert(feedback)
      .values({
        kind,
        message,
        email,
        name: name || null,
        source: sender.source,
        userId: sender.userId,
        organizationId: sender.organizationId,
        pageUrl: ownPage(input.pageUrl),
        locale: isLocale(input.locale) ? input.locale : "en",
        screenshot,
        screenshotType: screenshot ? "image/webp" : null,
        visitor: sender.visitor,
      })
      .returning({ id: feedback.id, pageUrl: feedback.pageUrl });
    return { refused: null, row, reservations: admitted.reservations };
  });
  if (saved.refused) return { ok: false, code: saved.refused };

  // Used, not just reserved: a reserved slot is handed back after six hours, and the day's limit would forget it.
  for (const reservation of saved.reservations) await consumeReservation(reservation.id, "paid").catch(() => undefined);

  await emailNewFeedback({
    id: saved.row.id,
    kind: kind satisfies FeedbackKind,
    message,
    email,
    name: name || null,
    source: sender.source,
    pageUrl: saved.row.pageUrl,
    hasScreenshot: Boolean(screenshot),
  });
  return { ok: true, id: saved.row.id };
}
