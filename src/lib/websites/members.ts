"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { member, user, websiteMembers } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";

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
 * Gives someone access to one website.
 *
 * Matched on an EXISTING account rather than sending an email invitation.
 * Sending mail needs a provider, a token table and an expiry policy; matching
 * an account that already exists needs none of that and covers the case the
 * client asked for — a colleague or freelancer who already uses the product.
 * Someone without an account signs up first, which they would have to do
 * either way.
 */
export async function addWebsiteMember(
  websiteId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<ActionResult<null>> {
  const { access, userId: actorId } = await requireWebsite(websiteId);

  if (access !== "owner") {
    return { ok: false, error: "Only the website owner can invite people." };
  }

  const cleaned = email.trim().toLowerCase();
  if (!cleaned.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const [person] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, cleaned))
    .limit(1);

  if (!person) {
    return {
      ok: false,
      error: `No account for ${cleaned}. Ask them to sign up first, then invite them.`,
    };
  }

  /**
   * Inviting yourself does nothing useful: you already have owner access, and
   * a row would show you in your own collaborator list at a lower role.
   */
  if (person.id === actorId) {
    return { ok: false, error: "You already have access to this website." };
  }

  /**
   * A second invitation changes the role rather than adding a row — the
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

  revalidatePath(`/websites/${websiteId}/settings`);
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
