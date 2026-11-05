/**
 * The Earn Credits share kit's ready-made messages (client design, 2026-11-05):
 * what goes in each platform's text box, how its limit is counted, and the
 * address that opens it. Plain functions, imported by the kit and its tests.
 *
 * Nothing here posts, sends or credits anything. Every address only opens the
 * platform with the customer's own text or link, for them to finish there. The
 * messages carry the disclosure Earn Credits asks of public posts (lib/earn/ways.ts):
 * the author may receive credits.
 */

export const SHARE_CHANNELS = ["linkedin", "facebook", "x", "whatsapp", "email"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** Each platform's own limit on a post or message. Email has none. */
export const SHARE_LIMITS: Record<ShareChannel, number | null> = {
  linkedin: 3000,
  facebook: 63206,
  x: 280,
  whatsapp: 65536,
  email: null,
};

/** The longest address worth opening: past this, browsers and mail apps cut it or refuse it. */
const MAX_HREF = 2000;

/** The templates of one language, with this account's own code and link in them. */
export function shareTemplates(
  templates: Record<ShareChannel, string>,
  account: { code: string; link: string },
): Record<ShareChannel, string> {
  const filled = (text: string) => text.replaceAll("{link}", account.link).replaceAll("{code}", account.code);
  return Object.fromEntries(SHARE_CHANNELS.map((channel) => [channel, filled(templates[channel])])) as Record<ShareChannel, string>;
}

/** X's weights: the characters of most Latin text count 1, others 2 (twitter-text's default ranges). */
function xWeight(codePoint: number): number {
  const light =
    codePoint <= 0x10ff ||
    (codePoint >= 0x2000 && codePoint <= 0x200d) ||
    (codePoint >= 0x2010 && codePoint <= 0x201f) ||
    (codePoint >= 0x2032 && codePoint <= 0x2037);
  return light ? 1 : 2;
}

/** X counts any link as this many characters, however long it is. */
const X_LINK_LENGTH = 23;

/** A message's length as its platform counts it. */
export function shareLength(channel: ShareChannel, text: string): number {
  if (channel !== "x") return [...text].length;
  const withoutLinks = text.replace(/https?:\/\/\S+/g, "");
  const links = text.length === withoutLinks.length ? 0 : (text.match(/https?:\/\/\S+/g) ?? []).length;
  return [...withoutLinks].reduce((sum, char) => sum + xWeight(char.codePointAt(0) ?? 0), links * X_LINK_LENGTH);
}

/** How many characters a message is over its platform's limit; 0 when it fits. */
export function shareOverLimit(channel: ShareChannel, text: string): number {
  const limit = SHARE_LIMITS[channel];
  return limit === null ? 0 : Math.max(0, shareLength(channel, text) - limit);
}

/**
 * The address that opens a platform. `prefilled` says whether it carries the
 * text: LinkedIn and Facebook take only a link, so the customer pastes the text
 * they just copied, and a message too long for an address opens the same way.
 */
export function shareHref(
  channel: ShareChannel,
  text: string,
  { link, subject }: { link: string; subject: string },
): { href: string; prefilled: boolean } {
  const encode = encodeURIComponent;
  switch (channel) {
    case "linkedin":
      return { href: `https://www.linkedin.com/sharing/share-offsite/?url=${encode(link)}`, prefilled: false };
    case "facebook":
      return { href: `https://www.facebook.com/sharer/sharer.php?u=${encode(link)}`, prefilled: false };
    case "x":
      return { href: `https://twitter.com/intent/tweet?text=${encode(text)}`, prefilled: true };
    case "whatsapp": {
      const href = `https://wa.me/?text=${encode(text)}`;
      return href.length <= MAX_HREF ? { href, prefilled: true } : { href: "https://wa.me/", prefilled: false };
    }
    case "email": {
      const start = `mailto:?subject=${encode(subject)}`;
      // Mail line breaks are CRLF (RFC 6068).
      const href = `${start}&body=${encode(text.replace(/\r?\n/g, "\r\n"))}`;
      return href.length <= MAX_HREF ? { href, prefilled: true } : { href: start, prefilled: false };
    }
  }
}
