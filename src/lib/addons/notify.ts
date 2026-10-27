import "server-only";

import { eq } from "drizzle-orm";

import { adminEmails } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { emailButton, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site-url";

/**
 * Tells the administrators that a service was bought with credits.
 *
 * A card purchase shows up in Stripe; one paid with credits shows up nowhere
 * an administrator looks unless they are told, and the service is delivered
 * by hand. Never throws: the purchase is recorded either way.
 */
export async function emailServiceOrdered(order: {
  organizationId: string;
  service: string;
  credits: number;
}): Promise<{ sent: number }> {
  const to = adminEmails();
  if (to.length === 0) return { sent: 0 };
  try {
    const [workspace] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, order.organizationId))
      .limit(1);
    const who = workspace?.name ?? order.organizationId;
    const link = `${siteUrl()}/admin/organizations?q=${encodeURIComponent(who)}`;
    const subject = `New order: ${order.service} (${who})`;
    const html = emailLayout({
      heading: "New service order",
      preheader: `${who} bought ${order.service} with ${order.credits} credits.`,
      body: [
        emailText(
          `<strong>${escapeHtml(who)}</strong> bought <strong>${escapeHtml(order.service)}</strong> with ${order.credits} credits.`,
        ),
        emailText("It is delivered by hand: start the work and email the customer when it is done."),
        emailButton(link, "Open the workspace"),
      ].join(""),
    });
    const text = [
      `${who} bought ${order.service} with ${order.credits} credits.`,
      "It is delivered by hand: start the work and email the customer when it is done.",
      `Workspace: ${link}`,
    ].join("\n\n");
    let sent = 0;
    for (const address of to) {
      const result = await sendEmail({ to: address, subject, html, text });
      if (result.ok) sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[addons] admin notification failed", error);
    return { sent: 0 };
  }
}
