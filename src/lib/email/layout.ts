import "server-only";

import { siteUrl } from "@/lib/site-url";

/**
 * The shell every email in this folder renders into.
 *
 * WRITTEN AS A TABLE, ON PURPOSE. Email clients are not browsers: Outlook
 * renders through Word's HTML engine, Gmail strips <style> blocks and most of
 * what survives is inline, and flexbox/grid are unavailable in enough clients
 * that a modern layout simply collapses. A centred table with inline styles is
 * the one construction that renders the same everywhere, which is why every
 * transactional email on the internet looks like this.
 *
 * NO EXTERNAL IMAGES. A logo hosted on our domain is blocked by default in
 * most clients, so the header would be an empty box for most readers and a
 * tracking signal for the rest. The wordmark is text.
 *
 * NO WEB FONTS either — they are ignored by every major client. The stack
 * below is what is actually installed on the reader's machine.
 */

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Escapes text interpolated into an email. Same reasoning as any HTML sink. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps body HTML in the branded shell.
 *
 * `preheader` is the grey line a client shows after the subject in the inbox
 * list. Left unset, clients scrape the first text they find — usually the
 * wordmark, so every message previews as "RepGet RepGet". It is hidden in the
 * body itself by the zero-size span below.
 */
export function emailLayout(options: {
  heading: string;
  preheader: string;
  body: string;
}): string {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
<span style="display:none;font-size:1px;color:#f4f4f5;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(options.preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;padding:32px 12px;">
<tr>
<td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
<tr>
<td style="padding:28px 32px 0 32px;">
<p style="margin:0;font-size:17px;font-weight:700;color:#18181b;letter-spacing:-0.01em;">RepGet</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 32px 32px;">
<h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.35;font-weight:650;color:#18181b;letter-spacing:-0.01em;">${escapeHtml(options.heading)}</h1>
${options.body}
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
<tr>
<td style="padding:20px 32px;text-align:center;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
&copy; ${year} RepGet &middot; <a href="${siteUrl()}" style="color:#71717a;text-decoration:underline;">${siteUrl().replace(/^https?:\/\//, "")}</a>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

/**
 * The primary button.
 *
 * A padded <a>, not a <button> — a real button does nothing in email, and
 * several clients strip the element entirely. Outlook ignores border-radius
 * and renders it square, which is acceptable; the alternative is a VML block
 * that doubles the template's size for a rounded corner in one client.
 */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="border-radius:8px;background-color:#18181b;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

/** A paragraph in the body copy's voice. */
export function emailText(html: string): string {
  return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#3f3f46;">${html}</p>`;
}

/**
 * The fallback link under a button.
 *
 * Necessary rather than decorative: buttons are stripped or unclickable in
 * enough clients that a message whose only action is a button is a dead end
 * for some readers. Shown small and muted so it does not compete.
 */
export function emailFallback(href: string, label: string): string {
  return `<p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#71717a;">${escapeHtml(label)}<br><a href="${escapeHtml(href)}" style="color:#3f3f46;word-break:break-all;">${escapeHtml(href)}</a></p>`;
}
