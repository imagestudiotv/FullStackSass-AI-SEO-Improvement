import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { user, websiteInvitations, websiteMembers, websites } from "@/lib/db/schema";
import { hashInvitationToken } from "@/lib/websites/invitation-token";

/**
 * Turning an invitation token into access.
 *
 * This is the ONLY thing that converts a website_invitations row into a
 * website_members row, which is why the checks live here rather than being
 * spread across the page that calls it.
 *
 * Not a "use server" module: it is called from a server component (to decide
 * what to render) and from a server action (to actually accept). Marking it
 * as actions would expose every function below as a POST endpoint, including
 * the lookup, for no benefit.
 */

export type InvitationLookup =
  | {
      state: "valid";
      id: string;
      email: string;
      role: string;
      domain: string;
      websiteId: string;
      invitedByName: string | null;
    }
  | { state: "expired"; email: string; domain: string }
  /** Unknown, already used, or revoked. All one answer on purpose - see below. */
  | { state: "invalid" };

/**
 * Looks up an invitation by its token.
 *
 * UNKNOWN, ACCEPTED AND REVOKED ALL RETURN "invalid". Distinguishing them
 * would let anyone with a guessed token learn whether it ever existed, and
 * tell a former collaborator whose access was withdrawn that the invitation
 * was deliberately revoked rather than simply expired. Neither is information
 * the holder of a bad token is owed.
 *
 * Expiry is NOT folded into that: the address is already known to whoever is
 * reading the email, and "this expired, ask for another" is the one failure a
 * person can actually act on.
 */
export async function lookupInvitation(
  token: string,
): Promise<InvitationLookup> {
  /*
    A shape check before touching the database. The token is 32 random bytes
    in base64url, so anything else is a truncated paste or a probe, and the
    hash of a 2-character string is not worth a query.
  */
  if (!token || token.length < 20 || token.length > 128) {
    return { state: "invalid" };
  }

  const hash = hashInvitationToken(token);

  const [row] = await db
    .select({
      id: websiteInvitations.id,
      email: websiteInvitations.email,
      role: websiteInvitations.role,
      websiteId: websiteInvitations.websiteId,
      expiresAt: websiteInvitations.expiresAt,
      domain: websites.domain,
      invitedByName: user.name,
    })
    .from(websiteInvitations)
    .innerJoin(websites, eq(websites.id, websiteInvitations.websiteId))
    /*
      Left-joined: invitedBy is ON DELETE SET NULL, so the person who sent
      the invitation may have since left. An inner join would make the whole
      invitation vanish in that case, which is not what deleting a colleague
      should do to a link already in somebody's inbox.
    */
    .leftJoin(user, eq(user.id, websiteInvitations.invitedBy))
    .where(
      and(
        eq(websiteInvitations.tokenHash, hash),
        isNull(websiteInvitations.acceptedAt),
      ),
    )
    .limit(1);

  if (!row) return { state: "invalid" };

  if (row.expiresAt.getTime() < Date.now()) {
    return { state: "expired", email: row.email, domain: row.domain };
  }

  return {
    state: "valid",
    id: row.id,
    email: row.email,
    role: row.role,
    domain: row.domain,
    websiteId: row.websiteId,
    invitedByName: row.invitedByName,
  };
}

export type AcceptResult =
  | { ok: true; websiteId: string }
  | { ok: false; error: string };

/**
 * Accepts an invitation on behalf of a signed-in user.
 *
 * THE ADDRESS MUST MATCH. An invitation is addressed to one mailbox, and the
 * link is the proof that its holder reads that mailbox - but only if we
 * insist the accepting account IS that address. Without this check, anyone
 * who came by the link (a forwarded email, a shared screen) could accept it
 * with their own account, which would make the whole token pointless.
 *
 * Compared case-insensitively because the invitation is stored lower-cased
 * and an account's address is not guaranteed to be.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<AcceptResult> {
  const found = await lookupInvitation(token);

  if (found.state === "expired") {
    return { ok: false, error: "This invitation has expired." };
  }
  if (found.state !== "valid") {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  const [account] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account) {
    return { ok: false, error: "Sign in again and reopen the invitation." };
  }

  if (account.email.trim().toLowerCase() !== found.email) {
    return {
      ok: false,
      error: `This invitation was sent to ${found.email}. Sign in with that address to accept it.`,
    };
  }

  /*
    Both writes in one transaction. A membership without the invitation
    marked accepted would leave a live token that could be replayed after the
    owner removed the person again; the reverse would consume the invitation
    and grant nothing, with no way to recover it - the token is hashed.
  */
  await db.transaction(async (tx) => {
    await tx
      .insert(websiteMembers)
      .values({
        websiteId: found.websiteId,
        userId,
        role: found.role,
        invitedBy: null,
      })
      /*
        Already a member - they were invited twice, or granted access
        directly while the invitation sat unopened. Accepting then updates
        the role to what this invitation offered rather than failing, which
        is what the sender last decided.
      */
      .onConflictDoUpdate({
        target: [websiteMembers.websiteId, websiteMembers.userId],
        set: { role: found.role, updatedAt: new Date() },
      });

    await tx
      .update(websiteInvitations)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(websiteInvitations.id, found.id));
  });

  return { ok: true, websiteId: found.websiteId };
}
