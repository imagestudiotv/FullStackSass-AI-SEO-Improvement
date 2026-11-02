"use server";

import { requireSession } from "@/lib/auth-guard";
import { setTips } from "@/lib/email/lifecycle";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Settings -> Emails: the signed-in person turns their own tips and reports
 * on or off. Only their own - the user id comes from the session, never from
 * the form. The same switch the unsubscribe link flips without signing in.
 */
export async function saveTipsEmails(tips: boolean): Promise<ActionResult<{ tips: boolean }>> {
  const session = await requireSession();
  try {
    await setTips(session.user.id, Boolean(tips), "settings");
    return { ok: true, data: { tips: Boolean(tips) } };
  } catch (error) {
    console.error("[settings] could not save the email preference", error);
    return { ok: false, error: "Could not save" };
  }
}
