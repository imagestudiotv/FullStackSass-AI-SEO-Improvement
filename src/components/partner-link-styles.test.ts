import { describe, expect, it } from "vitest";

import { PARTNER_LINK_SCOPE, partnerLinkCss } from "@/components/partner-link-styles";

describe("partner link highlight", () => {
  it("styles exactly the article's partner links, inside the scope, with a hover label", () => {
    const css = partnerLinkCss(["https://example.com/films/", "https://other.test/?a=1&b=2"], "Partner link");
    expect(css).toContain(`.${PARTNER_LINK_SCOPE} a[href="https://example.com/films/"]`);
    expect(css).toContain(`.${PARTNER_LINK_SCOPE} a[href="https://other.test/?a=1&b=2"]`);
    expect(css).toContain(`.dark .${PARTNER_LINK_SCOPE} a[href="https://example.com/films/"]`);
    expect(css).toContain(`.${PARTNER_LINK_SCOPE} a[href="https://example.com/films/"]:hover::after`);
    expect(css).toContain('content:"Partner link"');
  });

  it("is empty without partner links, and lists a repeated address once", () => {
    expect(partnerLinkCss([], "Partner link")).toBe("");
    const css = partnerLinkCss(["https://example.com/", "https://example.com/"], "x");
    expect(css.split("\n")[0].match(/a\[href=/g)).toHaveLength(1);
  });

  it("a label or address cannot close the style block or break out of its string", () => {
    const css = partnerLinkCss(['https://example.com/"</style><script>x</script>'], 'Lien "partenaire" </style>\\');
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script>");
    expect(css).toContain('content:"Lien \\"partenaire\\" \\3c /style>\\\\"');
  });
});
