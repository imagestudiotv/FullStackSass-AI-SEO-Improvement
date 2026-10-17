import "server-only";

import { adminEmails } from "@/lib/admin/guard";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { emailButton, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import type { Locale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

/**
 * Tells the administrators that the autopilot's drafts are waiting for them
 * (client's choice 2: nothing is published without a person). One email a
 * run: the English draft, each translation, what to check, and what it cost.
 *
 * Never throws: the drafts are saved either way, and the autopilot page
 * shows them too.
 */
export async function emailDraftsReady(input: {
  title: string;
  englishPostId: string;
  translations: { locale: Locale; postId: string }[];
  warnings: string[];
  costUsd: number | null;
}): Promise<{ sent: number }> {
  const to = adminEmails();
  if (to.length === 0) return { sent: 0 };
  try {
    const admin = `${siteUrl()}/admin/blog`;
    const languages = input.translations.map((translation) => LANGUAGE_NAMES_EN[translation.locale]);
    const drafts = [
      { label: "English", href: `${admin}/${input.englishPostId}` },
      ...input.translations.map((translation) => ({ label: LANGUAGE_NAMES_EN[translation.locale], href: `${admin}/${translation.postId}` })),
    ];
    const summary = languages.length
      ? `The English draft and its ${languages.join(", ")} translation${languages.length === 1 ? "" : "s"} are ready to review.`
      : "The English draft is ready to review.";
    const cost = input.costUsd !== null ? `AI cost: $${input.costUsd.toFixed(2)}.` : "";
    const html = emailLayout({
      heading: "New blog drafts to review",
      preheader: `“${input.title}”: ${summary}`,
      body: [
        emailText(`The blog autopilot wrote <strong>${escapeHtml(input.title)}</strong>. ${escapeHtml(summary)}`),
        emailText(drafts.map((draft) => `<a href="${escapeHtml(draft.href)}">${escapeHtml(draft.label)}</a>`).join(" · ")),
        input.warnings.length
          ? emailText(`To check before publishing:<br>${input.warnings.map((warning) => `• ${escapeHtml(warning)}`).join("<br>")}`)
          : "",
        emailText(
          `Translations need a native speaker's review before they can be published. Nothing goes live until you publish it.${cost ? ` ${escapeHtml(cost)}` : ""}`,
        ),
        emailButton(`${admin}/${input.englishPostId}`, "Review the English draft"),
      ].join(""),
    });
    const text = [
      `The blog autopilot wrote "${input.title}". ${summary}`,
      drafts.map((draft) => `${draft.label}: ${draft.href}`).join("\n"),
      input.warnings.length ? `To check before publishing:\n${input.warnings.map((warning) => `- ${warning}`).join("\n")}` : "",
      `Translations need a native speaker's review before they can be published. Nothing goes live until you publish it.${cost ? ` ${cost}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    let sent = 0;
    for (const address of to) {
      const result = await sendEmail({ to: address, subject: `Blog drafts to review: ${input.title}`, html, text });
      if (result.ok) sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[blog-autopilot] drafts-ready email failed", error);
    return { sent: 0 };
  }
}
