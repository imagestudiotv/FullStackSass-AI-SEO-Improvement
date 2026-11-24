import "server-only";

import { load } from "cheerio";

import { emailButton, emailFallback, emailLayout, emailNote, emailText, escapeHtml } from "@/lib/email/layout";

import { sanitizeBroadcastHtml } from "./content";
import type { BroadcastContent } from "./shared";

/**
 * The broadcast email itself. THE ONLY renderer: the page's live preview, the
 * test and the real send all call it, so what is previewed is what is sent.
 *
 * Inline styles and a table shell, like every other email (lib/email/layout.ts).
 * The stored HTML is sanitised again here: whatever put it in the database,
 * only the allow-list leaves it.
 */

const P = "margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#3f3f46;";
const LIST = "margin:0 0 14px 0;padding:0 0 0 22px;font-size:15px;line-height:1.6;color:#3f3f46;";
const LINK = "color:#c2410c;text-decoration:underline;";

const NOTE = "You receive this because you have a RepGet account.";
const UNSUBSCRIBE = "Unsubscribe from tips and reports";

function styledBody(bodyHtml: string): string {
  const $ = load(sanitizeBroadcastHtml(bodyHtml).html, null, false);
  // The editor writes <li><p>text</p></li>; a paragraph's margin inside a list item reads as a gap.
  $("li > p").attr("style", "margin:0;");
  $("p").each((_, element) => {
    if (!$(element).attr("style")) $(element).attr("style", P);
  });
  $("ul, ol").attr("style", LIST);
  $("li").attr("style", "margin:0 0 6px 0;");
  $("a").attr("style", LINK);
  return $.html();
}

/** The plain-text alternative, read off the same HTML. */
function plainBody(bodyHtml: string): string {
  const $ = load(sanitizeBroadcastHtml(bodyHtml).html, null, false);
  $("br").replaceWith("\n");
  $("a").each((_, element) => {
    const text = $(element).text().trim();
    const href = ($(element).attr("href") ?? "").replace(/^mailto:/i, "");
    $(element).replaceWith(escapeHtml(!text || text === href ? href : `${text} (${href})`));
  });
  // Inside an item the paragraph is the item: "1. " and its text stay on one line.
  $("li > p").each((_, element) => {
    $(element).replaceWith($(element).contents());
  });
  $("ol").each((_, list) => {
    $(list)
      .children("li")
      .each((index, item) => {
        $(item).prepend(`${index + 1}. `);
      });
  });
  $("ul > li").prepend("- ");
  $("li").append("\n");
  $("p, ul, ol").append("\n\n");
  return $.root()
    .text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type RenderedBroadcast = { subject: string; html: string; text: string };

export function renderBroadcastEmail(content: BroadcastContent, context: { unsubscribeUrl: string | null }): RenderedBroadcast {
  const subject = content.subject || "Untitled email";
  const cta = content.ctaLabel && content.ctaUrl ? { label: content.ctaLabel, url: content.ctaUrl } : null;

  const html = emailLayout({
    heading: subject,
    preheader: content.previewText || subject,
    body: [
      styledBody(content.bodyHtml) || emailText("Your message will appear here."),
      cta ? emailButton(cta.url, cta.label) : "",
      ...content.images.map(
        (image) =>
          `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="456" style="display:block;width:100%;max-width:456px;height:auto;margin:0 0 16px 0;border:0;border-radius:8px;">`,
      ),
      cta ? emailFallback(cta.url, "If the button does not work, copy this address:") : "",
      emailNote(
        context.unsubscribeUrl
          ? `${escapeHtml(NOTE)} <a href="${escapeHtml(context.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(UNSUBSCRIBE)}</a>`
          : escapeHtml(NOTE),
      ),
    ].join(""),
  });

  const text = [
    plainBody(content.bodyHtml),
    cta ? `${cta.label}:\n${cta.url}` : "",
    "--",
    context.unsubscribeUrl ? `${NOTE}\n${UNSUBSCRIBE}: ${context.unsubscribeUrl}` : NOTE,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, html, text };
}
