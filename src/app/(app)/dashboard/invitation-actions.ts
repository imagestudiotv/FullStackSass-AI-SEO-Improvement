"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-guard";
import {
  acceptPendingInvitation,
  type AcceptResult,
} from "@/lib/websites/accept-invitation";
import { writeSelectedWebsite } from "@/lib/websites/selected";

/** Invitation ids are UUIDs; anything else did not come from our page. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The "Accept invitation" button on a dashboard invitation card.
 *
 * A POST behind a button, never an acceptance on page load: the same reason
 * the /invite page insists on a click - a GET that grants access is a CSRF
 * sink any page could trigger with an image tag.
 *
 * WHO is accepting comes from the session read here, never from the client.
 * This is a public endpoint whose only argument the caller chooses, so the
 * id is checked for shape before it reaches a query, and everything about
 * whether this account may take this invitation - a verified address that
 * matches, still pending, not expired - is decided by acceptPendingInvitation.
 */
export async function acceptPendingInvitationAction(
  invitationId: string,
): Promise<AcceptResult> {
  const session = await requireSession();

  if (typeof invitationId !== "string" || !UUID_RE.test(invitationId)) {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  const result = await acceptPendingInvitation(invitationId, session.user.id);

  if (result.ok) {
    /*
      The site they just joined becomes the current one, and every server-
      rendered list of websites (switcher, sidebar, dashboard) is re-read so
      it appears without a manual refresh.
    */
    await writeSelectedWebsite(result.websiteId);
    revalidatePath("/", "layout");
  }

  return result;
}
