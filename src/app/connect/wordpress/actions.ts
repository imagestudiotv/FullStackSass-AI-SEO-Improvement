"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-guard";
import { approveHandshake, cancelHandshake } from "@/lib/plugin/handshake";

/**
 * The buttons on /connect/wordpress. Each checks everything again
 * (approveHandshake): the page may have been open for a while, in a tab
 * whose session has changed since.
 */

const pageFor = (id: string) => `/connect/wordpress?request=${encodeURIComponent(id)}`;

async function viewer(id: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(pageFor(id))}`);
  return { sessionId: session.session.id, userId: session.user.id };
}

export async function approveConnection(formData: FormData): Promise<void> {
  const id = String(formData.get("request") ?? "");
  const { sessionId, userId } = await viewer(id);
  const outcome = await approveHandshake({ id, websiteId: String(formData.get("websiteId") ?? ""), sessionId, userId });
  // Only ever the address WordPress registered for this request.
  if (outcome.ok) redirect(outcome.redirectTo);
  redirect(
    outcome.reason === "too_many_keys" || outcome.reason === "not_allowed"
      ? `${pageFor(id)}&error=${outcome.reason}`
      : pageFor(id),
  );
}

export async function cancelConnection(formData: FormData): Promise<void> {
  const id = String(formData.get("request") ?? "");
  const { sessionId } = await viewer(id);
  redirect((await cancelHandshake(id, sessionId)) ?? pageFor(id));
}
