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
 * Attributes are dropped except href/src/alt/title, so class and style cannot
 * carry an editor's private CSS onto a site that has no stylesheet for it.
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
  img: new Set(["src", "alt", "title"]),
};

/** Tags whose content goes with them, rather than being unwrapped. */
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|noscript)[^>]*>[\s\S]*?<\/\1>/gi;

/** Control characters and spaces, which hide a scheme from a naive check. */
const URL_NOISE = new RegExp("[\\u0000-\\u0020]", "g");

/**
 * True for a URL safe to publish.
 *
 * Blocks javascript: and data: — a data URL can carry an SVG with a script in
 * it. Relative and protocol-relative URLs are fine; the customer's own site is
 * the base. Noise is stripped first, because "java\tscript:alert(1)" is a URL
 * browsers still follow.
 */
function safeUrl(value: string): boolean {
  return !/^(javascript|data|vbscript|file):/i.test(
    value.replace(URL_NOISE, ""),
  );
}

function cleanAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";

  const out: string[] = [];
  const pattern = /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;

    const value = match[2].replace(/^["']|["']$/g, "");
    if ((name === "href" || name === "src") && !safeUrl(value)) continue;

    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }

  /**
   * Links off the customer's site open in a new tab, and rel stops the target
   * page reaching back through window.opener. Done here rather than in the
   * editor so it holds for pasted links too.
   */
  if (tag === "a") {
    const href = out.find((attr) => attr.startsWith("href="));
    if (href && /^href="https?:\/\//i.test(href)) {
      out.push('target="_blank"', 'rel="noopener nofollow"');
    }
  }

  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

export function sanitizeHtml(html: string): string {
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
          return `<${tag}${cleanAttrs(tag, attrs)}${selfClosing ? " /" : ""}>`;
        },
      )
      // What an editor leaves behind when a block is emptied.
      .replace(/<p>\s*(<br \/>)?\s*<\/p>/gi, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim()
  );
}
