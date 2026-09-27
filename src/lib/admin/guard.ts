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
 * AN ALLOWLISTED ADDRESS IS NOT ENOUGH: IT MUST BE PROVEN. Email/password
 * signup is open and does not verify the address, so anyone could register
 * an allowlisted address with a password of their choosing and, before this
 * check, walk straight into the admin area. Admin access therefore also
 * requires `emailVerified === true` on the session's user, which Better Auth
 * only sets after the mailbox was proven - a Google sign-in, or a one-time
 * code sent to that address. The one-time-code sign-in also revokes every
 * password, linked account and session the account held before the proof
 * (see lib/auth.ts), so a pre-registered password cannot ride along. Anything
 * other than the boolean `true` - false, missing, null - is not verified.
 *
 * requireAdmin() and isAdmin() apply the SAME rule (adminFromSession), because
 * isAdmin() is not only cosmetic: API routes use it as their gate.
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

type SessionLike = {
  user: { id: string; email: string; emailVerified?: boolean | null };
} | null | undefined;

/**
 * The admin decision, for a session already read. Null unless there is a
 * session, its user's address is PROVEN (emailVerified strictly true), and
 * that address is on the allowlist.
 */
export function adminFromSession(session: SessionLike): AdminContext | null {
  if (!session?.user) return null;
  if (session.user.emailVerified !== true) return null;
  if (!isAdminEmail(session.user.email)) return null;
  return { userId: session.user.id, email: session.user.email };
}

/** Throws NotAdminError unless the caller is a verified, listed administrator. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = adminFromSession(await getSession());
  if (!admin) throw new NotAdminError();
  return admin;
}

/**
 * True when the current caller is a verified, listed administrator. The same
 * rule as requireAdmin: API routes rely on it as an authorization check, and
 * the menu must not offer an area the server would refuse.
 */
export async function isAdmin(): Promise<boolean> {
  return adminFromSession(await getSession()) !== null;
}
