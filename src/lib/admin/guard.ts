import { getSession } from "@/lib/auth-guard";

/**
 * Platform administrator access.
 *
 * Admins are listed in ADMIN_EMAILS, not marked by a database column. A column
 * is one SQL injection or one careless UPDATE away from privilege escalation,
 * and this role can read every customer's data — so the source of truth lives
 * outside the database entirely. Changing who is an admin means a deploy,
 * which is the correct amount of friction for this.
 *
 * There is deliberately no UI for granting it.
 */

export class NotAdminError extends Error {
  readonly status = 404;
  constructor() {
    /**
     * 404, not 403. A 403 confirms the admin area exists and that this account
     * simply lacks access, which tells an attacker they have found something
     * worth attacking. To everyone but an admin, these routes do not exist.
     */
    super("Not found");
    this.name = "NotAdminError";
  }
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = adminEmails();
  // An empty allowlist grants nothing. Failing open here would make every
  // signed-in user an admin on any deployment that forgot the variable.
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

export type AdminContext = { userId: string; email: string };

/** Throws NotAdminError unless the caller is a listed administrator. */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await getSession();
  if (!session) throw new NotAdminError();

  if (!isAdminEmail(session.user.email)) {
    throw new NotAdminError();
  }

  return { userId: session.user.id, email: session.user.email };
}

/** True when the current caller is an admin. For conditional UI only. */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return isAdminEmail(session?.user.email);
}
