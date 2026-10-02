import "server-only";

import { and, eq, gte, isNull } from "drizzle-orm";

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

  const granted = await grantInvitation(found.id, userId);
  if (!granted) {
    // Accepted in another tab, or revoked, since the lookup above.
    return { ok: false, error: "This invitation is no longer valid." };
  }

  return { ok: true, websiteId: granted.websiteId };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accepts an invitation by its ID, from the dashboard, without the emailed
 * link.
 *
 * WHY A SECOND WAY IN. The link did not survive signing up: switching between
 * sign-in and sign-up, or a failed Google attempt, dropped it, and in
 * production an invitee signed up with Google minutes after being invited and
 * never saw the invitation again. The dashboard now lists what is waiting for
 * their address (lib/websites/pending-invitations.ts), and this is the button
 * behind each card.
 *
 * THE TOKEN WAS THE PROOF OF THE MAILBOX; HERE THE ACCOUNT MUST BE. Without
 * the link, nothing shows that the person pressing Accept reads the address
 * the invitation went to - except an account whose address Better Auth has
 * VERIFIED, which happens only through a Google sign-in or a one-time code
 * sent to it. Email/password signup does not verify, so a password-only
 * account could otherwise be registered under somebody else's address and
 * collect their invitations. emailVerified is read from the user row and must
 * be exactly `true`, the rule lib/admin/guard.ts applies to admin access.
 * Unverified accounts are not refused for ever; they accept with the link.
 *
 * NOTHING ABOUT ANOTHER PERSON'S INVITATION IS DISCLOSED. Unlike the token
 * path, the caller here proved nothing about this particular invitation, so
 * an id that is unknown, addressed to someone else, already accepted or
 * revoked all get the same "no longer valid" - the address it was sent to is
 * never named. Expiry is reported only once the address has matched, where
 * "ask for another" is something the reader can act on.
 *
 * Not a server action itself: the dashboard's action reads the session and
 * passes its user id, so a caller can never accept on somebody else's behalf.
 */
export async function acceptPendingInvitation(
  invitationId: string,
  userId: string,
): Promise<AcceptResult> {
  // A malformed id must answer "not valid", not raise a Postgres cast error.
  if (!UUID_RE.test(invitationId)) {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  const [account] = await db
    .select({ email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account) {
    return { ok: false, error: "Sign in again and reopen the invitation." };
  }

  if (account.emailVerified !== true) {
    return {
      ok: false,
      error:
        "Open the link in your invitation email to accept it. Your email address has not been confirmed yet.",
    };
  }

  const [invitation] = await db
    .select({
      email: websiteInvitations.email,
      acceptedAt: websiteInvitations.acceptedAt,
      expiresAt: websiteInvitations.expiresAt,
    })
    .from(websiteInvitations)
    .where(eq(websiteInvitations.id, invitationId))
    .limit(1);

  if (
    !invitation ||
    invitation.email !== account.email.trim().toLowerCase() ||
    invitation.acceptedAt
  ) {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  // The same comparison lookupInvitation makes, so both paths agree.
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired." };
  }

  const granted = await grantInvitation(invitationId, userId);
  if (!granted) {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  return { ok: true, websiteId: granted.websiteId };
}

/**
 * The grant itself: marks the invitation accepted and gives `userId` access
 * to its website. Shared by both ways of accepting, so there is exactly one
 * place that turns an invitation into a website_members row.
 *
 * Callers have already checked WHO may accept (the address, and for the
 * token-less path the verified account). This only re-checks, atomically,
 * that the invitation is still there to be accepted.
 *
 * Returns null when it is not - accepted in another tab, revoked, or expired -
 * in which case nothing was written.
 */
async function grantInvitation(
  invitationId: string,
  userId: string,
): Promise<{ websiteId: string } | null> {
  /*
    Both writes in one transaction. A membership without the invitation
    marked accepted would leave a live token that could be replayed after the
    owner removed the person again; the reverse would consume the invitation
    and grant nothing, with no way to recover it - the token is hashed.
  */
  return db.transaction(async (tx) => {
    /*
      CLAIMED FIRST, AND ONLY IF STILL PENDING. The caller's checks ran a
      moment ago, outside this transaction; an owner revoking the invitation
      in that moment must not be overtaken by a grant. The conditional update
      is the check that cannot race: if it touches no row, nothing is granted.

      The site, role and inviter are taken from the row as claimed, not from
      the earlier read, so access is exactly what the invitation said when it
      was accepted.
    */
    const [claimed] = await tx
      .update(websiteInvitations)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(websiteInvitations.id, invitationId),
          isNull(websiteInvitations.acceptedAt),
          gte(websiteInvitations.expiresAt, new Date()),
        ),
      )
      .returning({
        websiteId: websiteInvitations.websiteId,
        role: websiteInvitations.role,
        invitedBy: websiteInvitations.invitedBy,
      });

    if (!claimed) return null;

    await tx
      .insert(websiteMembers)
      .values({
        websiteId: claimed.websiteId,
        userId,
        role: claimed.role,
        /*
          Who let them in, as the direct-grant path in members.ts records.
          It was written as null, leaving the membership with no trace of
          its sender once the invitation row is gone.
        */
        invitedBy: claimed.invitedBy,
      })
      /*
        Already a member - they were invited twice, or granted access
        directly while the invitation sat unopened. Accepting then updates
        the role to what this invitation offered rather than failing, which
        is what the sender last decided.
      */
      .onConflictDoUpdate({
        target: [websiteMembers.websiteId, websiteMembers.userId],
        set: {
          role: claimed.role,
          invitedBy: claimed.invitedBy,
          updatedAt: new Date(),
        },
      });

    return { websiteId: claimed.websiteId };
  });
}
