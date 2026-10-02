import "server-only";

import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { cache } from "react";

import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import {
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";

/**
 * Invitations waiting for the signed-in person, shown on their dashboard.
 *
 * WHY. The emailed link was the only way to accept, and it did not survive
 * signing up: in production an invitee clicked "Continue with Google" two
 * minutes after the invitation was sent, landed on onboarding with no trace of
 * it, and never pressed Accept. Listing what is waiting for their address
 * means the invitation is one click away however they arrived.
 *
 * ONLY FOR A PROVEN ADDRESS. Matching by email is only as good as the proof
 * that the account owns that mailbox. Email/password signup does not verify
 * the address, so anyone could register "editor@client.com" with a password
 * and, if this matched on the address alone, be offered - and accept - an
 * invitation meant for somebody else. emailVerified is set by Better Auth only
 * after a Google sign-in or a one-time code sent to the address: the same rule
 * lib/admin/guard.ts uses for admin access, for the same reason. It is read
 * from the user ROW, not the session, so a stale session cannot vouch for an
 * address the account no longer has. Anything other than the boolean `true`
 * is unverified, and those accounts still accept through the emailed link,
 * which is its own proof of the mailbox.
 *
 * Never returns a token hash or an organization id: what is shown is the
 * site's domain, the role, and who sent it - exactly what the email said.
 */

export type PendingInvitation = {
  id: string;
  domain: string;
  role: "editor" | "viewer";
  /** Null when the inviter's account has since been deleted. */
  invitedByName: string | null;
  expiresAt: Date;
};

/**
 * Unaccepted, unexpired invitations addressed to `userId`'s proven address.
 *
 * Compared as lower(trim(email)): invitations are stored lower-cased at the
 * call site, and an account's address is not guaranteed to be.
 */
export async function pendingInvitationsFor(
  userId: string,
): Promise<PendingInvitation[]> {
  const [account] = await db
    .select({ email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account || account.emailVerified !== true) return [];

  const email = account.email.trim().toLowerCase();
  if (!email) return [];

  /*
    The user join here is the INVITER, on invitedBy - not the recipient, who
    was read above. Left-joined for the same reason lookupInvitation does:
    invitedBy is ON DELETE SET NULL, and a colleague leaving must not make the
    invitation they sent disappear from the recipient's dashboard.
  */
  const rows = await db
    .select({
      id: websiteInvitations.id,
      domain: websites.domain,
      role: websiteInvitations.role,
      invitedByName: user.name,
      expiresAt: websiteInvitations.expiresAt,
    })
    .from(websiteInvitations)
    .innerJoin(websites, eq(websites.id, websiteInvitations.websiteId))
    .leftJoin(user, eq(user.id, websiteInvitations.invitedBy))
    /*
      Not for a site they can already open. An invitation sent before they
      had an account stays pending after the owner grants them access
      directly (members.ts does that for existing accounts), and a card
      saying "you are invited" to a site already in their switcher is noise -
      accepting it would also reset the role the owner chose later.
    */
    .leftJoin(
      websiteMembers,
      and(
        eq(websiteMembers.websiteId, websiteInvitations.websiteId),
        eq(websiteMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(websiteInvitations.email, email),
        isNull(websiteInvitations.acceptedAt),
        gt(websiteInvitations.expiresAt, new Date()),
        isNull(websiteMembers.id),
      ),
    )
    .orderBy(asc(websiteInvitations.createdAt), asc(websiteInvitations.id));

  return rows.map((row) => ({
    ...row,
    // The same mapping as requireWebsite: only "viewer" is a viewer.
    role: row.role === "viewer" ? ("viewer" as const) : ("editor" as const),
  }));
}

/**
 * pendingInvitationsFor() for whoever is signed in.
 *
 * The user id comes from the session, never from an argument: this is called
 * from pages, and a page must not be able to ask about somebody else's inbox.
 * cache(): one read per request however many components ask.
 */
export const listPendingInvitations = cache(
  async (): Promise<PendingInvitation[]> => {
    const session = await requireSession();
    return pendingInvitationsFor(session.user.id);
  },
);
