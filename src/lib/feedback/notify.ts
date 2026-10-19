import "server-only";

import { adminEmails } from "@/lib/admin/guard";
import { emailButton, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site-url";

import type { FeedbackKind } from "./shared";

const KIND_LABEL: Record<FeedbackKind, string> = { idea: "Idea", problem: "Problem", other: "Other" };

/**
 * Tells the administrators about new feedback, one email each, with Reply-To
 * set to the sender so a reply from the inbox reaches them directly.
 * Never throws: the feedback is saved either way and is in Admin -> Feedback.
 */
export async function emailNewFeedback(entry: {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string;
  name: string | null;
  source: "dashboard" | "website";
  pageUrl: string | null;
  hasScreenshot: boolean;
}): Promise<{ sent: number }> {
  const to = adminEmails();
  if (to.length === 0) return { sent: 0 };
  try {
    const link = `${siteUrl()}/admin/feedback/${entry.id}`;
    const kind = KIND_LABEL[entry.kind];
    const who = entry.name ? `${entry.name} <${entry.email}>` : entry.email;
    const from = entry.source === "dashboard" ? "a customer, from the dashboard" : "a visitor, from the website";
    const preview = entry.message.replace(/\s+/g, " ").trim();
    const subject = `New feedback (${kind}): ${preview.length > 60 ? `${preview.slice(0, 59)}…` : preview}`;
    const html = emailLayout({
      heading: `New feedback: ${kind}`,
      preheader: preview.slice(0, 140),
      body: [
        emailText(`From <strong>${escapeHtml(who)}</strong>, ${escapeHtml(from)}.`),
        emailText(escapeHtml(entry.message).replace(/\n/g, "<br>")),
        entry.pageUrl ? emailText(`Page: ${escapeHtml(entry.pageUrl)}`) : "",
        entry.hasScreenshot ? emailText("A screenshot is attached in the admin panel.") : "",
        emailButton(link, "Open in Admin"),
      ].join(""),
    });
    const text = [
      `New feedback (${kind}) from ${who}, ${from}.`,
      entry.message,
      entry.pageUrl ? `Page: ${entry.pageUrl}` : "",
      entry.hasScreenshot ? "A screenshot is attached in the admin panel." : "",
      `Open it: ${link}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    let sent = 0;
    for (const address of to) {
      const result = await sendEmail({ to: address, subject, html, text, replyTo: entry.email });
      if (result.ok) sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[feedback] admin notification failed", error);
    return { sent: 0 };
  }
}
