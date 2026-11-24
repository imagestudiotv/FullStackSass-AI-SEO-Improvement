import "server-only";

import sanitize from "sanitize-html";

import { storedImagePrefix } from "@/lib/images/storage";

import { BROADCAST_LIMITS, isBroadcastAudience, type BroadcastContent, type BroadcastImage } from "./shared";

/**
 * What a broadcast may contain. Everything an administrator typed passes
 * through here on every save, test and preview, and again before it is sent.
 *
 * AN ALLOW-LIST, NOT A CLEAN-UP: paragraphs, line breaks, bold, italic, lists
 * and links, and no attribute but a link's href. No style, no class, no
 * picture in the text (pictures are a separate list, of our own stored files)
 * and nothing that runs.
 */

/** Links open a website over https, or a mail program. */
function safeHref(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (/^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(value)) return value;
  return httpsUrl(value);
}

/** An https address, normalised; null for anything else (http, javascript:, credentials in it, no real host). */
export function httpsUrl(raw: string): string | null {
  const value = raw.trim();
  // Browsers ignore control characters and spaces inside a scheme; so nothing holding one is accepted.
  if (!value || /[\u0000- \u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The stored HTML of a message, and how many links had to be dropped. */
export function sanitizeBroadcastHtml(html: string): { html: string; droppedLinks: number } {
  let droppedLinks = 0;
  const clean = sanitize(html, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "iframe", "object", "embed", "noscript", "textarea", "svg", "math", "title"],
    parseStyleAttributes: false,
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) => {
        const href = safeHref(attribs.href);
        if (!href) {
          droppedLinks++;
          // Its words stay; only the link goes ("span" is not allowed, so the tag is dropped).
          return { tagName: "span", attribs: {} };
        }
        return { tagName, attribs: { href } };
      },
    },
  })
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "")
    .trim();
  return { html: clean, droppedLinks };
}

const oneLine = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** Where a checked picture is stored; an unchecked upload waits elsewhere (lib/admin/broadcasts.ts). */
export const BROADCAST_IMAGE_FOLDER = "broadcasts/email";

/** A picture of ours: the file's public address in our own storage, never another website's. */
export function isOwnImage(url: string): boolean {
  const prefix = storedImagePrefix();
  if (!prefix || !url.startsWith(`${prefix}${BROADCAST_IMAGE_FOLDER}/`)) return false;
  return !/[\s"'<>\\]|\.\./.test(url) && url.length <= 600;
}

export type ContentResult = { ok: true; content: BroadcastContent } | { ok: false; error: string };

/**
 * Checks and normalises what was typed. `complete` (a test, a send, a
 * schedule) also needs a subject and a message; a draft may lack them.
 */
export function readBroadcastContent(input: unknown, options: { complete: boolean }): ContentResult {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const fail = (error: string): ContentResult => ({ ok: false, error });

  if (!isBroadcastAudience(raw.audience)) return fail("Choose who receives it.");
  const subject = oneLine(raw.subject);
  if (subject.length > BROADCAST_LIMITS.subject) return fail(`The subject is longer than ${BROADCAST_LIMITS.subject} characters.`);
  const previewText = oneLine(raw.previewText);
  if (previewText.length > BROADCAST_LIMITS.previewText) return fail(`The preview text is longer than ${BROADCAST_LIMITS.previewText} characters.`);

  const typed = typeof raw.bodyHtml === "string" ? raw.bodyHtml : "";
  if (typed.length > BROADCAST_LIMITS.bodyHtml) return fail("The message is too long.");
  const { html: bodyHtml, droppedLinks } = sanitizeBroadcastHtml(typed);
  if (droppedLinks > 0) return fail("A link in the message is not a valid https:// address or email address. Correct or remove it.");

  const listed = Array.isArray(raw.images) ? raw.images : [];
  if (listed.length > BROADCAST_LIMITS.images) return fail(`At most ${BROADCAST_LIMITS.images} pictures.`);
  const images: BroadcastImage[] = [];
  for (const item of listed) {
    const image = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const url = typeof image.url === "string" ? image.url : "";
    if (!isOwnImage(url)) return fail("One of the pictures is not stored by RepGet. Remove it and upload it again.");
    images.push({ url, alt: oneLine(image.alt).slice(0, BROADCAST_LIMITS.imageAlt) });
  }

  const ctaLabel = oneLine(raw.ctaLabel);
  const ctaTyped = typeof raw.ctaUrl === "string" ? raw.ctaUrl.trim() : "";
  if (ctaLabel.length > BROADCAST_LIMITS.ctaLabel) return fail(`The button label is longer than ${BROADCAST_LIMITS.ctaLabel} characters.`);
  if (ctaTyped.length > BROADCAST_LIMITS.ctaUrl) return fail("The button URL is too long.");
  const ctaUrl = ctaTyped ? httpsUrl(ctaTyped) : "";
  if (ctaUrl === null) return fail("The button URL must be a full https:// address.");

  if (options.complete) {
    if (!subject) return fail("Write a subject.");
    if (!bodyHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()) return fail("Write a message.");
    if (Boolean(ctaLabel) !== Boolean(ctaUrl)) return fail("A button needs both a label and a URL - or leave both empty.");
  }

  return { ok: true, content: { audience: raw.audience, subject, previewText, bodyHtml, images, ctaLabel, ctaUrl } };
}
