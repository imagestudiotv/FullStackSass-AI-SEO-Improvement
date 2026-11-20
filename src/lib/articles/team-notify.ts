import "server-only";

import { eq, sql } from "drizzle-orm";

import { adminEmails } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { articles, organization, websites } from "@/lib/db/schema";
import { emailButton, emailLayout, emailNote, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site-url";

/**
 * "Article is generating on autopilot for the client and We receive a
 * notification" (ticket 2026-11-19, item 4). An article written and HELD for
 * the team (review status "pending": the two-step flow, or managed review on
 * a Partner Network site; lib/articles/review.ts) emails ADMIN_EMAILS with a
 * link straight to its review page. The team used to learn of it only by
 * opening the admin.
 *
 * A website's first article says so in the subject: a new client is waiting
 * for it, and it is the one the review queue lists first.
 *
 * Only for held articles: one that goes straight to the client needs nothing
 * from the team. Never throws - the article is saved either way - and a
 * retried step does not email twice (Resend idempotency key per article
 * version).
 */
export async function emailTeamArticleHeld(input: { articleId: string }): Promise<{ sent: number }> {
  const to = adminEmails();
  if (to.length === 0) return { sent: 0 };
  try {
    const [row] = await db
      .select({
        title: articles.title,
        reviewStatus: articles.reviewStatus,
        reviewVersion: articles.reviewVersion,
        wordCount: articles.wordCount,
        domain: websites.domain,
        workspace: organization.name,
        // The review queue's rule (lib/admin/network.ts): nothing of this website published or approved yet.
        first: sql<boolean>`not exists (
          select 1 from ${articles} other
          where other.website_id = ${articles.websiteId} and other.id <> ${articles.id}
            and (other.published_url is not null or other.status = 'published' or other.review_status = 'approved')
        )`,
      })
      .from(articles)
      .innerJoin(websites, eq(websites.id, articles.websiteId))
      .innerJoin(organization, eq(organization.id, websites.organizationId))
      .where(eq(articles.id, input.articleId))
      .limit(1);
    if (!row || row.reviewStatus !== "pending") return { sent: 0 };
    const first = row.first === true;

    const link = `${siteUrl()}/admin/network/${input.articleId}`;
    const subject = `${first ? "First article" : "Article"} to review: ${row.title} (${row.domain})`;
    const lead = first
      ? `A new client's <strong>first article</strong> is written and waiting for the team.`
      : `A planned article is written and waiting for the team.`;
    const html = emailLayout({
      heading: first ? "A new client's first article is ready for review" : "An article is ready for review",
      preheader: subject,
      body: [
        emailText(lead),
        emailText(
          `<strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(row.domain)} &middot; ${escapeHtml(row.workspace)}${row.wordCount ? ` &middot; ${row.wordCount} words` : ""}`,
        ),
        emailText("Nothing is published or sent until it is approved. Edit it as needed, then approve it from its review page."),
        emailButton(link, "Review the article"),
        emailNote("Sent to ADMIN_EMAILS for every article held for the team's review."),
      ].join(""),
    });
    const text = [
      first ? "A new client's first article is written and waiting for the team." : "A planned article is written and waiting for the team.",
      `${row.title}\n${row.domain} - ${row.workspace}`,
      "Nothing is published or sent until it is approved. Edit it as needed, then approve it from its review page.",
      `Review: ${link}`,
    ].join("\n\n");

    let sent = 0;
    for (const address of to) {
      const result = await sendEmail({ to: address, subject, html, text, idempotencyKey: `article-held:${input.articleId}:${row.reviewVersion}:${address}` });
      if (result.ok) sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[articles] team notification failed", input.articleId, error);
    return { sent: 0 };
  }
}
