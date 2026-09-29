/**
 * Highlights Partner Network links inside an article, wherever it is shown:
 * previews and the rich text editor alike.
 *
 * A partner link is placed on words already in a paragraph, and styled like
 * any other link it cannot be told apart from them - in a preview without
 * link styles, not even from the text (client feedback, 2026-09-29). So
 * the links whose address is one of the article's placements get a violet
 * highlight, and a "Partner link" label on hover or keyboard focus.
 *
 * Done with a stylesheet scoped to a container rather than by rewriting the
 * article HTML: the same rule then reaches the editor, whose link marks keep
 * only href/target/rel, and nothing about the stored text changes.
 */

/** Put this class on the element that contains the article's HTML or editor. */
export const PARTNER_LINK_SCOPE = "partner-links";

/**
 * A double-quoted CSS string. Placement URLs are validated http(s) URLs and
 * cannot contain a raw quote, but the label is translated text: backslashes
 * and quotes are escaped, and "<" too, so nothing can close the <style>.
 */
function cssString(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&").replace(/</g, "\\3c ").replace(/[\r\n]+/g, " ")}"`;
}

/** The stylesheet for these partner-link addresses, or "" when there are none. */
export function partnerLinkCss(urls: readonly string[], label: string): string {
  const unique = [...new Set(urls)].filter(Boolean);
  if (unique.length === 0) return "";
  const select = (prefix: string, suffix = "") =>
    unique.map((url) => `${prefix}.${PARTNER_LINK_SCOPE} a[href=${cssString(url)}]${suffix}`).join(",");
  return [
    `${select("")}{color:#6d28d9;background-color:rgba(124,58,237,.12);text-decoration-line:underline;text-decoration-color:#7c3aed;text-underline-offset:3px;border-radius:3px;padding:0 .15em;position:relative}`,
    `${select(".dark ")}{color:#c4b5fd;background-color:rgba(167,139,250,.2);text-decoration-color:#a78bfa}`,
    `${select("", ":hover::after")},${select("", ":focus-visible::after")}{content:${cssString(label)};position:absolute;left:0;bottom:calc(100% + 4px);padding:2px 6px;border-radius:4px;background:#4c1d95;color:#fff;font-size:11px;line-height:1.4;font-weight:500;white-space:nowrap;pointer-events:none;z-index:30}`,
  ].join("\n");
}

/** The highlight for one article's partner links. Renders nothing without any. */
export function PartnerLinkStyles({ urls, label }: { urls: readonly string[]; label: string }) {
  const css = partnerLinkCss(urls, label);
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
