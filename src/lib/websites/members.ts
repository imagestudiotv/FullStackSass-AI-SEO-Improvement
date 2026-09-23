"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  member,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import {
  sendAccessGrantedEmail,
  sendInvitationEmail,
} from "@/lib/email/invitation";
import { siteUrl } from "@/lib/site-url";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";
import {
  createInvitationToken,
  INVITATION_TTL_DAYS,
  invitationExpiry,
} from "@/lib/websites/invitation-token";

/**
 * Who may work on a website.
 *
 * Workspace membership says someone belongs to the account; this says which
 * sites they may touch. A freelance editor brought in for one client's site
 * should not see the others, and workspace membership alone cannot express
 * that.
 *
 * Every action starts at requireWebsite, which now returns the caller's
 * access level as well as the site. Only an owner may change who has access:
 * an editor who could invite could grant themselves a colleague, and a viewer
 * could promote themselves.
 */

export type WebsiteMember = {
  id: string;
  userId: string;
  email: string;
  name: string;
  /** "admin" for the workspace, "editor" or "viewer" for an invited guest. */
  role: string;
  createdAt: Date;
  /**
   * True for someone in the owning workspace.
   *
   * They hold their access through the workspace rather than through a
   * website_members row, so there is no row to delete and nothing to change
   * per site — the UI shows them without a remove control for that reason,
   * not as a styling choice.
   */
  isWorkspace: boolean;
};

/**
 * Everyone who can work on this website: the workspace first, then guests.
 *
 * The workspace people used to be left out, so the owner opened the panel and
 * read "Nobody else on <domain>" while looking at their own website — the
 * design shows them as the Admin row, and they are genuinely the people with
 * access. They come from the `member` table rather than website_members
 * because their access IS the workspace: requireWebsite grants "owner" to
 * anyone in the organisation that owns the site.
 *
 * Two queries rather than a union: the two tables carry different ids and
 * different meanings of `role`, and flattening them in SQL would need casts
 * that make the result harder to read than the concatenation below.
 */
export async function listWebsiteMembers(
  websiteId: string,
): Promise<WebsiteMember[]> {
  /**
   * Readable by anyone with access, including an editor: knowing who else is
   * working on the site is not privileged, and hiding it would make the page
   * look empty to the very people collaborating on it.
   */
  const { orgId } = await requireWebsite(websiteId);

  const workspace = await db
    .select({
      id: member.id,
      userId: member.userId,
      email: user.email,
      name: user.name,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(member.createdAt);

  const guests = await db
    .select({
      id: websiteMembers.id,
      userId: websiteMembers.userId,
      email: user.email,
      name: user.name,
      role: websiteMembers.role,
      createdAt: websiteMembers.createdAt,
    })
    .from(websiteMembers)
    .innerJoin(user, eq(user.id, websiteMembers.userId))
    .where(eq(websiteMembers.websiteId, websiteId))
    .orderBy(websiteMembers.createdAt);

  return [
    ...workspace.map((row) => ({
      ...row,
      /*
        Better Auth writes "owner" for the person who created the workspace
        and "member" for the rest. The design labels this column Admin, and
        both of those people administer the account, so both read as Admin
        rather than exposing a distinction the product does not act on.
      */
      role: "admin",
      isWorkspace: true,
    })),
    ...guests.map((row) => ({ ...row, isWorkspace: false })),
  ];
}

/**
 * A pending invitation - somebody emailed a link who has not accepted it yet.
 *
 * Separate from WebsiteMember because it is a different thing: there is no
 * user id, no name, and nothing to remove from website_members. The panel
 * lists both, which is what finally makes its Status column worth reading.
 */
export type WebsiteInvitation = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  expiresAt: Date;
  /** True once the link has gone stale. Shown differently, and re-sendable. */
  expired: boolean;
};

/** Invitations sent for this website that nobody has accepted yet. */
export async function listWebsiteInvitations(
  websiteId: string,
): Promise<WebsiteInvitation[]> {
  /*
    Owner-only, unlike the member list. A pending invitation names somebody
    who has NOT joined and may never join - a half-made decision about
    staffing, which is the owner's business and not an editor's.
  */
  const { access } = await requireWebsite(websiteId);
  if (access !== "owner") return [];

  const rows = await db
    .select({
      id: websiteInvitations.id,
      email: websiteInvitations.email,
      role: websiteInvitations.role,
      createdAt: websiteInvitations.createdAt,
      expiresAt: websiteInvitations.expiresAt,
    })
    .from(websiteInvitations)
    .where(
      and(
        eq(websiteInvitations.websiteId, websiteId),
        isNull(websiteInvitations.acceptedAt),
      ),
    )
    .orderBy(websiteInvitations.createdAt);

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    /*
      Expiry is computed for display rather than filtered out. An invitation
      that quietly vanished at day seven would leave the owner sure they had
      sent one; shown as Expired, with a Resend beside it, it explains itself.
    */
    expired: row.expiresAt.getTime() < now,
  }));
}

/**
 * Gives someone access to one website.
 *
 * TWO PATHS, because the recipient is in one of two situations:
 *
 *  - They ALREADY have an account. The website_members row is written
 *    immediately, exactly as it was before email existed, and they are told
 *    by email that it happened. Making an existing user click a token to
 *    accept something already granted would be ceremony for its own sake.
 *
 *  - They do NOT. A pending invitation is written with a hashed token and a
 *    seven-day expiry, and the link is emailed. Nothing is granted until they
 *    accept - see accept-invitation.ts, which is the only thing that turns
 *    one of these into a website_members row.
 *
 * This is website-scoped in both cases. Accepting gives access to ONE site,
 * never to the workspace: a freelancer brought in for one client must not
 * gain the others, which is the reason website_members exists at all.
 */
export async function addWebsiteMember(
  websiteId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<ActionResult<{ invited: boolean; emailSent: boolean }>> {
  const { access, userId: actorId, site } = await requireWebsite(websiteId);

  if (access !== "owner") {
    return { ok: false, error: "Only the website owner can invite people." };
  }

  const cleaned = email.trim().toLowerCase();
  /*
    A shape check, not a validity check. Whether the mailbox exists is
    something only the send finds out, and this catches the typo that would
    otherwise burn an invitation on "colleague@" or a pasted name.
  */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  /** Who the invitation is from, in the email. Their name, or the address. */
  const [actor] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, actorId))
    .limit(1);
  const inviterName = actor?.name?.trim() || actor?.email || "A RepGet user";

  const [person] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, cleaned))
    .limit(1);

  /**
   * Inviting yourself does nothing useful: you already have owner access, and
   * a row would show you in your own collaborator list at a lower role.
   */
  if (person && person.id === actorId) {
    return { ok: false, error: "You already have access to this website." };
  }

  /* ---------------------------------------------------------------- */
  /* They have an account: grant now, notify after.                    */
  /* ---------------------------------------------------------------- */
  if (person) {
    /**
     * A second invitation changes the role rather than adding a row - the
     * unique index on (website_id, user_id) makes that the only sane outcome,
     * and it is what someone means when they re-invite an existing editor as a
     * viewer.
     */
    await db
      .insert(websiteMembers)
      .values({ websiteId, userId: person.id, role, invitedBy: actorId })
      .onConflictDoUpdate({
        target: [websiteMembers.websiteId, websiteMembers.userId],
        set: { role, invitedBy: actorId, updatedAt: new Date() },
      });

    /*
      Sent AFTER the grant, and its failure does not undo one: access is the
      product of this action, and an email provider being down must not take
      it back. The result is reported so the panel can say "they have access,
      but we could not email them" rather than claiming a message that never
      left.
    */
    const sent = await sendAccessGrantedEmail({
      to: cleaned,
      inviterName,
      domain: site.domain,
      role,
      websiteUrl: `${siteUrl()}/websites/${websiteId}`,
    });

    revalidatePath(`/websites/${websiteId}/settings`);
    revalidatePath("/settings");
    return { ok: true, data: { invited: false, emailSent: sent.ok } };
  }

  /* ---------------------------------------------------------------- */
  /* No account: a pending invitation, which grants nothing yet.       */
  /* ---------------------------------------------------------------- */
  const { token, hash } = createInvitationToken();

  /*
    Re-inviting replaces the previous invitation rather than adding one. Two
    live tokens for the same address would mean revoking the visible one
    leaves the forgotten one working - a link that outlives the decision to
    withdraw it.
  */
  await db
    .insert(websiteInvitations)
    .values({
      websiteId,
      email: cleaned,
      role,
      tokenHash: hash,
      expiresAt: invitationExpiry(),
      invitedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [websiteInvitations.websiteId, websiteInvitations.email],
      set: {
        role,
        tokenHash: hash,
        expiresAt: invitationExpiry(),
        invitedBy: actorId,
        // Clears a previous acceptance, so re-inviting a removed person works.
        acceptedAt: null,
        updatedAt: new Date(),
      },
    });

  const sent = await sendInvitationEmail({
    to: cleaned,
    inviterName,
    domain: site.domain,
    role,
    acceptUrl: `${siteUrl()}/invite/${token}`,
    expiresInDays: INVITATION_TTL_DAYS,
  });

  /*
    A failed send is a FAILED INVITE, unlike the branch above. The token only
    exists in that email - it is hashed here and nowhere else in plain form -
    so an unsent invitation is a row nobody can ever accept. The row is left
    in place so re-sending reuses the slot, and the error says what happened.
  */
  if (!sent.ok) {
    return {
      ok: false,
      error: `Could not email ${cleaned}. The invitation was not sent - try again, or check the email settings.`,
    };
  }

  revalidatePath(`/websites/${websiteId}/settings`);
  revalidatePath("/settings");
  return { ok: true, data: { invited: true, emailSent: true } };
}

/**
 * Sends a fresh link for a pending invitation.
 *
 * A NEW token, not the old one: the original is stored only as a hash, so
 * there is nothing to re-send. That is the intended cost of hashing it, and
 * it has a useful side effect - an expired invitation and a lost one are the
 * same operation, with the old link dying the moment this succeeds.
 */
export async function resendWebsiteInvitation(
  websiteId: string,
  invitationId: string,
): Promise<ActionResult<null>> {
  const { access, userId: actorId, site } = await requireWebsite(websiteId);

  if (access !== "owner") {
    return { ok: false, error: "Only the website owner can resend invites." };
  }

  const [invitation] = await db
    .select({
      email: websiteInvitations.email,
      role: websiteInvitations.role,
      acceptedAt: websiteInvitations.acceptedAt,
    })
    .from(websiteInvitations)
    .where(
      and(
        eq(websiteInvitations.id, invitationId),
        // Scoped by site, so an id from another website finds nothing.
        eq(websiteInvitations.websiteId, websiteId),
      ),
    )
    .limit(1);

  if (!invitation) {
    return { ok: false, error: "That invitation no longer exists." };
  }
  if (invitation.acceptedAt) {
    return { ok: false, error: "That invitation has already been accepted." };
  }

  const [actor] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, actorId))
    .limit(1);
  const inviterName = actor?.name?.trim() || actor?.email || "A RepGet user";

  const { token, hash } = createInvitationToken();

  await db
    .update(websiteInvitations)
    .set({
      tokenHash: hash,
      expiresAt: invitationExpiry(),
      updatedAt: new Date(),
    })
    .where(eq(websiteInvitations.id, invitationId));

  const sent = await sendInvitationEmail({
    to: invitation.email,
    inviterName,
    domain: site.domain,
    role: invitation.role,
    acceptUrl: `${siteUrl()}/invite/${token}`,
    expiresInDays: INVITATION_TTL_DAYS,
  });

  if (!sent.ok) {
    return { ok: false, error: `Could not email ${invitation.email}.` };
  }

  revalidatePath(`/websites/${websiteId}/settings`);
  revalidatePath("/settings");
  return { ok: true, data: null };
}

/**
 * Withdraws a pending invitation.
 *
 * Deleted rather than marked, because an unaccepted invitation records no
 * decision worth keeping - and deleting it is what makes the emailed link
 * stop working, which is the entire point of the control.
 */
export async function revokeWebsiteInvitation(
  websiteId: string,
  invitationId: string,
): Promise<ActionResult<null>> {
  const { access } = await requireWebsite(websiteId);

  if (access !== "owner") {
    return { ok: false, error: "Only the website owner can cancel invites." };
  }

  await db
    .delete(websiteInvitations)
    .where(
      and(
        eq(websiteInvitations.id, invitationId),
        eq(websiteInvitations.websiteId, websiteId),
      ),
    );

  revalidatePath(`/websites/${websiteId}/settings`);
  revalidatePath("/settings");
  return { ok: true, data: null };
}

/** Removes someone's access to one website. */
export async function removeWebsiteMember(
  websiteId: string,
  memberId: string,
): Promise<ActionResult<null>> {
  const { access } = await requireWebsite(websiteId);

  if (access !== "owner") {
    return { ok: false, error: "Only the website owner can remove people." };
  }

  /**
   * Scoped by website as well as id, so a member id from another site deletes
   * nothing rather than removing someone else's collaborator.
   */
  await db
    .delete(websiteMembers)
    .where(
      and(
        eq(websiteMembers.id, memberId),
        eq(websiteMembers.websiteId, websiteId),
      ),
    );

  revalidatePath(`/websites/${websiteId}/settings`);
  return { ok: true, data: null };
}
