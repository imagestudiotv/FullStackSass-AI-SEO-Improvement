import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SetupTracker } from "./setup-tracker";

const state = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));

const steps = [
  { id: "profile", title: "Check your business profile", description: "Why it matters.", href: "/profile", icon: "site", done: false, optional: false },
  { id: "site", title: "Connect your site", description: "Why it matters.", href: "/connect", icon: "site", done: true, optional: false },
] as Parameters<typeof SetupTracker>[0]["steps"];

function render(pathname: string) {
  state.pathname = pathname;
  return renderToStaticMarkup(createElement(SetupTracker, { steps }));
}

/** The open panel lists the steps; the badge only offers to show them. */
describe("setup panel over an article's Publish button", () => {
  it("opens as usual on other pages", () => {
    const html = render("/dashboard");
    expect(html).toContain("Check your business profile");
    expect(html).not.toContain("Show setup steps");
  });

  it("starts as the badge on an article's page, still offering the steps", () => {
    const html = render("/websites/site-1/articles/article-1");
    expect(html).not.toContain("Check your business profile");
    expect(html).toContain("Show setup steps - 1 left");
  });

  it("stays open on the list of a website's pages", () => {
    expect(render("/websites/site-1/content")).toContain("Check your business profile");
  });
});
