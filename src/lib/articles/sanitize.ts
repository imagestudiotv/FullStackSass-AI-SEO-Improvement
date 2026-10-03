/**
 * Reduces article HTML to the tags an article is allowed to contain.
 *
 * Two sources feed this now: the model, and the customer typing in the rich
 * text editor. Both are untrusted for the same reason — the result is
 * published to a live website under the customer's name.
 *
 * An allowlist rather than a list of banned tags. The previous version stripped
 * script/style/iframe and event handlers and let everything else through, which
 * held while the model was the only writer and the prompt constrained it. An
 * editor emits whatever the user pastes: a Word paste alone carries <o:p>,
 * <font>, mso- styles and nested <div>s, and pasting from a website brings that
 * site's markup with it. Naming what may stay is the only version that survives
 * inputs multiplying.
 *
 * Attributes are dropped except href/src/alt/title, heading ids and an
 * image's size and loading hints, so class and style cannot carry an editor's
 * private CSS onto a site that has no stylesheet for it.
 *
 * Its own module rather than living beside the generator: the editor's save
 * path needs it, and importing it from a file that constructs an Anthropic
 * client pulls the AI SDK into places that only wanted to clean a string.
 */

/** Tags an article body may contain. Anything else is unwrapped. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

/** Attributes worth keeping, per tag. Everything else goes. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  /*
    width/height so a browser can hold an image's space while it loads, and
    loading/decoding so it can load it without holding up the page (client's
    launch review, 2026-10-03). Only in the fixed forms FIXED_FORM_ATTRS allows.
  */
  img: new Set(["src", "alt", "title", "width", "height", "loading", "decoding"]),
  /*
    Heading ids, so a contents list's "#section" links have something to
    point at. They were dropped with every other attribute, which left each
    contents-list link pointing nowhere once published.
  */
  h2: new Set(["id"]),
  h3: new Set(["id"]),
  h4: new Set(["id"]),
  h5: new Set(["id"]),
  h6: new Set(["id"]),
};

/**
 * A heading id worth keeping: a plain slug. Anything else is dropped rather
 * than escaped - an id is only ever a link target, so it needs no characters
 * that could mean something to a browser or a stylesheet.
 */
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,80}$/;

/**
 * Attributes kept only in one exact form, or not at all: the normalised value,
 * or null to drop it.
 *
 * An image size is a whole number of pixels, 1 to 10000 - what the HTML
 * attribute means. "100%", "800px", "0" and anything stranger are dropped
 * rather than repaired: a size that is wrong is worse than none, because the
 * browser would hold the wrong space. Loading hints are the few words browsers
 * know, in lower case.
 */
const IMAGE_SIZE = /^(?:[1-9]\d{0,3}|10000)$/;
const FIXED_FORM_ATTRS: Record<string, (value: string) => string | null> = {
  width: (value) => (IMAGE_SIZE.test(value.trim()) ? value.trim() : null),
  height: (value) => (IMAGE_SIZE.test(value.trim()) ? value.trim() : null),
  loading: (value) => oneOf(value, ["lazy", "eager"]),
  decoding: (value) => oneOf(value, ["async", "sync", "auto"]),
};

function oneOf(value: string, allowed: readonly string[]): string | null {
  const word = value.trim().toLowerCase();
  return allowed.includes(word) ? word : null;
}

/** Tags whose content goes with them, rather than being unwrapped. */
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|noscript)[^>]*>[\s\S]*?<\/\1>/gi;

/** Control characters and spaces, which hide a scheme from a naive check. */
const URL_NOISE = new RegExp("[\\u0000-\\u0020]", "g");

/**
 * Schemes a link or image in an article may use. Anything with a scheme not on
 * this list is dropped; a URL with no scheme at all is relative and kept.
 *
 * AN ALLOWLIST, where this used to be a blocklist of javascript/data/vbscript/
 * file. A blocklist has to anticipate every scheme a browser will execute; an
 * allowlist only has to name the handful an article legitimately needs.
 */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** A few named references worth decoding; the rest stay literal. See below. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  colon: ":",
  tab: "\t",
  newline: "\n",
  sol: "/",
  num: "#",
  quest: "?",
};

/**
 * Decodes the character references a browser would decode in an attribute.
 *
 * THIS IS THE BUG IT FIXES. The URL check used to read the attribute as
 * written, but the browser reads it DECODED - so
 *
 *   <a href="&#106;avascript:alert(1)">
 *
 * passed the check (it does not start with "javascript:") and then became a
 * javascript: link the moment it rendered. Invited editors can write article
 * HTML, so that was stored XSS against the site owner and the admin panel, and
 * it was published to the customer's live site as well.
 *
 * Out-of-range code points decode to nothing rather than throwing: this runs
 * on pasted and model-written input, and one malformed reference must not
 * fail the whole save.
 */
function decodeEntities(value: string): string {
  const fromCode = (code: number) =>
    Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : "";
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => fromCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => fromCode(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole: string, name: string) =>
      NAMED_ENTITIES[name.toLowerCase()] ?? whole,
    );
}

/**
 * Escapes a DECODED value for output inside double quotes.
 *
 * Emitting the decoded-then-escaped form - never the input as written - is
 * what makes the check above trustworthy. The browser decodes this output back
 * to exactly the string that was validated. Any reference the decoder above
 * does not know, such as some obscure named entity, stays literal in the
 * validated string and is emitted as "&amp;...", so the browser shows it as
 * text instead of decoding it into something the check never saw.
 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * True for a URL safe to publish. Takes the DECODED value.
 *
 * Noise is stripped before looking for the scheme, because "java\tscript:"
 * is a URL browsers still follow. Stripping interior spaces as well can only
 * make the check stricter: "java script:" is not a scheme a browser runs, and
 * reading it as "javascript:" rejects it, which is the safe way to be wrong.
 */
function safeUrl(decoded: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(decoded.replace(URL_NOISE, ""));
  // No scheme: relative or protocol-relative, resolved against the customer's site.
  if (!scheme) return true;
  return SAFE_SCHEMES.has(scheme[1].toLowerCase());
}

export type SanitizeOptions = {
  /**
   * Hostnames that are the customer's own site. Links to them are internal
   * links: they open in the same tab and are NOT nofollow. Without this, an
   * absolute link to the site's own page was marked nofollow, which tells
   * search engines to ignore the very internal links the article is for.
   */
  siteHosts?: ReadonlySet<string>;
};

function isSiteLink(hrefAttr: string, siteHosts: ReadonlySet<string> | undefined): boolean {
  if (!siteHosts || siteHosts.size === 0) return false;
  const value = hrefAttr.slice('href="'.length, -1).replace(/&amp;/g, "&");
  try {
    return siteHosts.has(new URL(value).hostname.toLowerCase().replace(/\.$/, ""));
  } catch {
    return false;
  }
}

function cleanAttrs(tag: string, raw: string, options: SanitizeOptions = {}): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";

  const out: string[] = [];
  const pattern = /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;

    let value = decodeEntities(match[2].replace(/^["']|["']$/g, ""));
    if ((name === "href" || name === "src") && !safeUrl(value)) continue;
    if (name === "id" && !SAFE_ID.test(value)) continue;
    const fixedForm = FIXED_FORM_ATTRS[name];
    if (fixedForm) {
      const normalised = fixedForm(value);
      if (normalised === null) continue;
      value = normalised;
    }

    out.push(`${name}="${escapeAttr(value)}"`);
  }

  /**
   * Links off the customer's site open in a new tab, and rel stops the target
   * page reaching back through window.opener. Done here rather than in the
   * editor so it holds for pasted links too.
   */
  if (tag === "a") {
    const href = out.find((attr) => attr.startsWith("href="));
    if (href && /^href="https?:\/\//i.test(href) && !isSiteLink(href, options.siteHosts)) {
      out.push('target="_blank"', 'rel="noopener nofollow"');
    }
  }

  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  return (
    html
      .replace(DROP_WITH_CONTENT, "")
      // Fenced code the model sometimes wraps its answer in.
      .replace(/```html\s*/gi, "")
      .replace(/```\s*$/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(
        /**
         * The attribute part matches quoted values whole, so a ">" inside one
         * does not end the tag early. With [^>]*? a crafted
         * href="data:text/html,<script>" closed the tag at that inner ">" and
         * the rest leaked out as text — the payload survived sanitising.
         */
        /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/)?\s*>/g,
        (_full, closing: string | undefined, name: string, attrs: string) => {
          // A second H1 competes with the title for the page's main heading.
          let tag = name.toLowerCase();
          if (tag === "h1") tag = "h2";

          // Unwrapped: the tag goes, the words inside it stay.
          if (!ALLOWED_TAGS.has(tag)) return "";
          if (closing) return `</${tag}>`;

          const selfClosing = tag === "br" || tag === "hr" || tag === "img";
          return `<${tag}${cleanAttrs(tag, attrs, options)}${selfClosing ? " /" : ""}>`;
        },
      )
      // What an editor leaves behind when a block is emptied.
      .replace(/<p>\s*(<br \/>)?\s*<\/p>/gi, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim()
  );
}
