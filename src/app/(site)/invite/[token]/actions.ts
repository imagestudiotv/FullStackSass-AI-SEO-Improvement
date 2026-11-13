"use server";

import { requireSession } from "@/lib/auth-guard";
import {
  acceptInvitation,
  type AcceptResult,
} from "@/lib/websites/accept-invitation";
import { writeSelectedWebsite } from "@/lib/websites/selected";

/**
 * Accepts the invitation for whoever is signed in.
 *
 * The session is read HERE rather than trusted from the client: the token
 * proves who was invited, and the session proves who is accepting. Taking a
 * user id as an argument would let a caller accept on anybody's behalf.
 */
export async function acceptInvitationAction(
  token: string,
): Promise<AcceptResult> {
  const session = await requireSession();
  const result = await acceptInvitation(token, session.user.id);

  /*
    The site they just joined becomes the current one. The accept button
    goes on to the dashboard, and without this the switcher and sidebar
    would open on whatever was selected before - for someone who also has a
    website of their own, that is their site rather than the one they were
    invited to.
  */
  if (result.ok) {
    await writeSelectedWebsite(result.websiteId);
  }

  return result;
}
