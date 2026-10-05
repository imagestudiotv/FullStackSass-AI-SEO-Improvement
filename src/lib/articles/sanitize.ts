import sanitize from "sanitize-html";

/** Shared by server saves, previews and delivery. Browsers repair malformed
 * quotes and tags, so all HTML parsing belongs to the sanitizer library. */
export type SanitizeOptions = { siteHosts?: ReadonlySet<string> };

const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,80}$/;
const IMAGE_SIZE = /^(?:[1-9]\d{0,3}|10000)$/;
const HEADINGS = ["h2", "h3", "h4", "h5", "h6"];

function isSiteLink(href: string, hosts?: ReadonlySet<string>): boolean {
  try {
    return hosts?.has(new URL(href, "https://relative.invalid").hostname.toLowerCase().replace(/\.$/, "")) ?? false;
  } catch {
    return false;
  }
}

export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  // Only presentation cleanup uses regex. Parsing, entity decoding, attribute
  // filtering, escaping and URL scheme checks belong to the library.
  const input = html.replace(/```html\s*/gi, "").replace(/```\s*$/g, "");
  return sanitize(input, {
    allowedTags: ["p", "br", "hr", ...HEADINGS, "strong", "b", "em", "i", "u", "s", "code", "pre", "ul", "ol", "li", "blockquote", "a", "img", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      ...Object.fromEntries(HEADINGS.map((tag) => [tag, ["id"]])),
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: true,
    nonTextTags: ["script", "style", "iframe", "object", "embed", "noscript", "textarea", "svg", "math"],
    parseStyleAttributes: false,
    transformTags: {
      "*": (name, attrs) => {
        const tagName = name === "h1" ? "h2" : name;
        const attribs = { ...attrs };
        if (attribs.id && !SAFE_ID.test(attribs.id)) delete attribs.id;
        if (tagName === "img") {
          for (const key of ["width", "height"]) {
            if (attribs[key] !== undefined) {
              const value = attribs[key].trim();
              if (IMAGE_SIZE.test(value)) attribs[key] = value;
              else delete attribs[key];
            }
          }
          for (const [key, values] of [["loading", ["lazy", "eager"]], ["decoding", ["async", "sync", "auto"]]] as const) {
            if (attribs[key] !== undefined) {
              const value = attribs[key].trim().toLowerCase();
              if ((values as readonly string[]).includes(value)) attribs[key] = value;
              else delete attribs[key];
            }
          }
        }
        if (tagName === "a") {
          // Generated, never trusted from input. Delivery separately applies
          // the existing policy to recorded partner placements.
          delete attribs.target;
          delete attribs.rel;
          if (/^(?:https?:)?\/\//i.test(attribs.href ?? "") && !isSiteLink(attribs.href, options.siteHosts)) {
            attribs.target = "_blank";
            attribs.rel = "noopener nofollow";
          }
        }
        return { tagName, attribs };
      },
    },
  }).replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "").replace(/[ \t]+\n/g, "\n").trim();
}
