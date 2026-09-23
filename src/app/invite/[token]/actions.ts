"use server";

import { requireSession } from "@/lib/auth-guard";
import {
  acceptInvitation,
  type AcceptResult,
} from "@/lib/websites/accept-invitation";

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
  return acceptInvitation(token, session.user.id);
}
