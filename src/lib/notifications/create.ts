import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

/**
 * Writing a notification.
 *
 * Split from the read path deliberately: this is called from Inngest jobs,
 * which must never import a "use server" module — Next would try to treat its
 * exports as server actions.
 *
 * Every call is best-effort. A notification is a courtesy, and failing an
 * article generation because we could not tell someone about it would trade a
 * real product for a message about the product.
 */

/**
 * Kinds we raise. A union rather than a free string so a typo is a compile
 * error, and so the set stays reviewable in one place.
 */
export type NotificationType =
  | "article.ready"
  | "article.failed"
  | "article.published"
  | "audit.ready"
  | "audit.failed"
  | "keywords.ready"
  | "keywords.failed"
  | "geo.ready"
  | "referral.rewarded"
  | "addon.purchased";

export type NewNotification = {
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Relative path inside the app. */
  href?: string | null;
  /** Who triggered the work, when known. */
  userId?: string | null;
};

/**
 * Records a notification, swallowing any failure.
 *
 * Returns whether it was written, so a caller that genuinely cares can check,
 * while the common case ignores it.
 */
export async function notify(input: NewNotification): Promise<boolean> {
  try {
    await db.insert(notifications).values({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      type: input.type,
      // Trimmed to keep a runaway error message out of the UI.
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 500) ?? null,
      href: input.href ?? null,
    });
    return true;
  } catch (error) {
    /**
     * Logged, not thrown. This runs inside jobs whose real work has already
     * succeeded; throwing here would mark a completed article as failed.
     */
    console.error("[notifications] could not record notification", error);
    return false;
  }
}
