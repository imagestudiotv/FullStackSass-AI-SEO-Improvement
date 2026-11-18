"use server";

import { getSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/tenant";

import { pendingConversions } from "./conversions";
import { sendMetaEvents, metaServerConfigured, type MetaServerEvent } from "./meta-capi";
import { currentMetaUser } from "./meta-request";

/**
 * The server's copy of the sign-up and the trial start (client's guide,
 * section 2 rows 4 and 6), with the id the pixel gave each
 * (lib/meta-pixel.ts sendMetaConversions), so Meta counts each once - and
 * still hears them when an ad blocker stops the pixel. Called once per
 * browser by <ConversionEvents> (claimMetaServerConversions).
 *
 * The browser only names which ids it has: what is sent is what the server
 * itself finds due for the caller (pendingConversions), so a call cannot
 * report anything else, and a repeated one only repeats ids Meta already
 * counted.
 */
export async function mirrorMetaConversions(ids: string[]): Promise<void> {
  if (!metaServerConfigured() || !Array.isArray(ids) || ids.length === 0 || ids.length > 10) return;
  try {
    const session = await getSession();
    if (!session) return;
    const { orgId } = await requireOrg();
    const due = await pendingConversions(db, { userId: session.user.id, userCreatedAt: session.user.createdAt, organizationId: orgId });
    const chosen = due.filter((event) => ids.includes(event.id));
    if (chosen.length === 0) return;
    const user = await currentMetaUser({ id: session.user.id, email: session.user.email });
    if (!user) return;
    const now = new Date();
    const events = chosen.map((event): MetaServerEvent =>
      event.name === "sign_up"
        ? { name: "CompleteRegistration", id: event.id, time: now, path: "/sign-up", user, custom: { content_name: "signup" } }
        : { name: "StartTrial", id: event.id, time: now, path: "/billing", user, custom: { value: 0, currency: "EUR", content_name: (event.params.plan ?? "trial").toLowerCase() } },
    );
    await sendMetaEvents(events);
  } catch {
    console.error("[meta] sign-up or trial start could not be mirrored");
  }
}
