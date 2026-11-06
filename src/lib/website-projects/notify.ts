import "server-only";

import { eq } from "drizzle-orm";

import { adminEmails } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { emailButton, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site-url";

/**
 * Tells the administrators a website project needs them: a new brief to quote,
 * or a paid one to deliver. As with a service bought with credits
 * (lib/addons/notify.ts), nothing else would: no card payment shows up in
 * Stripe. Never throws: the request or the payment is recorded either way.
 */
export async function emailWebsiteProjectToAdmins(event: {
  organizationId: string;
  kindLabel: string;
  stage: "requested" | "paid";
  credits?: number;
}): Promise<{ sent: number }> {
  const to = adminEmails();
  if (to.length === 0) return { sent: 0 };
  try {
    const [workspace] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, event.organizationId))
      .limit(1);
    const who = workspace?.name ?? event.organizationId;
    const link = `${siteUrl()}/admin/website-projects`;
    const line =
      event.stage === "requested"
        ? `${who} asked for a quote: ${event.kindLabel}.`
        : `${who} paid ${event.credits} credits: ${event.kindLabel}.`;
    const next = event.stage === "requested" ? "Agree the scope with them and set the price in credits." : "Start the work, and mark it delivered when it is done.";
    const html = emailLayout({
      heading: event.stage === "requested" ? "New website quote request" : "Website project paid",
      preheader: line,
      body: [emailText(escapeHtml(line)), emailText(next), emailButton(link, "Open website projects")].join(""),
    });
    const text = [line, next, link].join("\n\n");
    const subject = event.stage === "requested" ? `Quote requested: ${event.kindLabel} (${who})` : `Paid: ${event.kindLabel} (${who})`;
    let sent = 0;
    for (const address of to) {
      const result = await sendEmail({ to: address, subject, html, text });
      if (result.ok) sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[website-projects] admin notification failed", error);
    return { sent: 0 };
  }
}
