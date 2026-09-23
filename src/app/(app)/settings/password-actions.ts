"use server";

import { headers } from "next/headers";

import { and, eq } from "drizzle-orm";

import { requireSession } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";

/**
 * Setting a FIRST password on an account that signs in with Google.
 *
 * The client asked for this: "We'd like to permit change password also for
 * google registered accounts. In this way it will ask for a new password
 * directly. I think it will be useful, many are comfortable to still having
 * login email and password."
 *
 * Why this needs a server action at all, when the rest of the password UI
 * talks to authClient directly: Better Auth marks /set-password as
 * `serverOnly`, so it is not mounted on the HTTP handler and authClient has
 * no method for it. It is reachable only through auth.api. That restriction
 * is deliberate — the endpoint sets a password without asking for the old
 * one, so exposing it to the browser would turn any XSS or borrowed session
 * into a permanent account takeover. Going through a server action keeps the
 * same property: it can only ever be called with the caller's own cookies.
 *
 * Distinct from changePassword, which stays on the client. That one takes a
 * current password and so proves the caller is the owner; this one cannot,
 * because there is no password yet to prove anything with.
 */

/** Minimum length, matching the sign-up rule so the two cannot disagree. */
const MIN_PASSWORD_LENGTH = 8;

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Gives a Google-only account an email-and-password login as well.
 *
 * Returns a result rather than throwing: this is called from a form, and the
 * failures here ("too short", "you already have one") are things to say in
 * the form rather than crashes to surface as an error page.
 */
export async function setFirstPassword(
  newPassword: string,
): Promise<SetPasswordResult> {
  /*
    Checked here rather than relying on the layout guard alone. A server
    action is its own entry point — it is reachable by POST whether or not
    anything rendered the form that calls it.
  */
  const session = await requireSession();

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "TOO_SHORT" };
  }

  /*
    Refuse if a password already exists.

    Better Auth's endpoint refuses this case too, so this is belt and braces
    rather than the only guard — but the error it throws is a generic 400,
    and this way the reason is known here instead of being guessed from a
    message string. It matters: an account WITH a password reaching this code
    path would mean a way to replace a password without knowing the old one,
    which is exactly what changePassword's current-password check exists to
    prevent.
  */
  const [credential] = await db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "credential"),
      ),
    )
    .limit(1);

  if (credential?.password) {
    return { ok: false, error: "ALREADY_SET" };
  }

  try {
    await auth.api.setPassword({
      body: { newPassword },
      /*
        The caller's own cookies. setPassword acts on the session it finds in
        these headers and nothing else, so there is no way to aim it at
        another account.
      */
      headers: await headers(),
    });
  } catch (error) {
    console.error("[settings] could not set a first password", error);
    return { ok: false, error: "FAILED" };
  }

  /*
    OTHER SESSIONS ARE DELIBERATELY LEFT ALONE.

    changePassword revokes them, and should: someone changing a password is
    usually doing it because they think somebody else has it. This is the
    opposite situation — nothing was compromised, an account is only gaining
    a second way to sign in. Signing the customer out of their phone and
    their other browser as a reward for adding a password would read as a
    bug, and would teach people not to use the feature.
  */
  return { ok: true };
}
