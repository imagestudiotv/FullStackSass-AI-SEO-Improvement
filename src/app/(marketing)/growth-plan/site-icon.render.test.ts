import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteIcon } from "./site-icon";

/**
 * The suggestion's and growth plan's icon (Daniel, 2026-11-18: an empty gap
 * where the logo should be while it loaded): the letter tile shows until the
 * icon has loaded, and a white icon is marked for its dark tile.
 */

const render = (site: Parameters<typeof SiteIcon>[0]["site"]) =>
  renderToStaticMarkup(createElement(SiteIcon, { site, host: "imagestudio.com", size: 26, className: "icon", letterClassName: "letter" }));

describe("SiteIcon", () => {
  it("shows the letter while the icon loads, with the icon waiting hidden behind it", () => {
    const html = render({ name: "Image Studio", faviconUrl: "https://imagestudio.com/icon.png", faviconTone: null });
    expect(html).toContain('<span class="letter" style="width:26px;height:26px" aria-hidden="true">I</span>');
    expect(html).toMatch(/<img[^>]*src="https:\/\/imagestudio.com\/icon.png"[^>]*style="display:none"/);
  });

  it("marks a white icon for the dark tile", () => {
    expect(render({ name: "Acme", faviconUrl: "data:image/png;base64,AAAA", faviconTone: "light" })).toContain('data-tone="light"');
  });

  it("shows the letter alone when there is no icon", () => {
    const html = render({ name: "Acme", faviconUrl: null });
    expect(html).toContain(">A</span>");
    expect(html).not.toContain("<img");
  });
});
