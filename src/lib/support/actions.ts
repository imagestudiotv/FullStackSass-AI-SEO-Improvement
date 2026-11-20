"use server";

import { requireSession } from "@/lib/auth-guard";
import { getLaunchState } from "@/lib/onboarding/launch";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork, listAccessibleWebsites } from "@/lib/websites/accessible";

import { claimWelcome, isSupportChatEvent, onboardingWelcomeOn, recordSupportChatEvent, type WelcomeRefusal } from "./onboarding-welcome";

/**
 * The live chat's two calls from the browser (components/crisp-onboarding.tsx,
 * components/live-chat.tsx). Who it is about is always the signed-in session;
 * the browser names only the website on screen and how far its setup was when
 * the wait began, and both are checked again here.
 */

export type WelcomeClaim =
  | { ok: true }
  /** "progressed": setup moved on during the wait; the browser starts waiting again from `done`. */
  | { ok: false; reason: WelcomeRefusal | "off" | "progressed" | "unknown_site" | "error"; done?: number };

export async function claimOnboardingWelcomeAction(input: { websiteId: string; baselineDone: number }): Promise<WelcomeClaim> {
  try {
    if (!onboardingWelcomeOn()) return { ok: false, reason: "off" };
    const session = await requireSession();
    const { orgId, userId } = await requireOrg();
    const websiteId = String(input?.websiteId ?? "");
    const site = (await listAccessibleWebsites()).find((candidate) => candidate.id === websiteId);
    // Only the person's own site: its checklist is theirs (as the setup panel in the app layout).
    if (!site || site.access !== "owner") return { ok: false, reason: "unknown_site" };
    const launch = await getLaunchState(websiteId);
    const baseline = Number.isInteger(input?.baselineDone) ? input.baselineDone : 0;
    // "If the user is actively completing setup steps, postpone the message rather than interrupting their work."
    if (launch.doneCount > baseline) return { ok: false, reason: "progressed", done: launch.doneCount };
    return await claimWelcome({
      userId,
      organizationId: orgId,
      accountCreatedAt: new Date(session.user.createdAt),
      ownsWorkspace: !(await hasOnlySharedWork()),
      setupComplete: launch.live,
      // Crisp is asked by this email whether a conversation already exists (lib/support/crisp-conversations.ts).
      email: session.user.email,
    });
  } catch (error) {
    // A failed claim means no welcome this time; it never breaks the page.
    console.error("[support] welcome claim failed", error);
    return { ok: false, reason: "error" };
  }
}

export async function recordSupportChatEventAction(event: string): Promise<void> {
  if (!isSupportChatEvent(event)) return;
  try {
    const { orgId, userId } = await requireOrg();
    await recordSupportChatEvent(userId, orgId, event);
  } catch (error) {
    console.error("[support] chat event not recorded", event, error);
  }
}
