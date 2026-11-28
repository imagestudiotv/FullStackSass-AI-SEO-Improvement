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
describe("the setup panel never opens by itself", () => {
  it.each(["/dashboard", "/websites/site-1/content", "/websites/site-1/backlinks", "/credits/buy", "/websites/site-1/articles/article-1"])(
    "starts as the badge on %s, still offering the steps",
    (pathname) => {
      const html = render(pathname);
      expect(html).not.toContain("Check your business profile");
      expect(html).toContain("Show setup steps - 1 left");
    },
  );
});

describe("the badge counts what Setup counts", () => {
  it("leaves out Launched live, as the sidebar and Setup do (lib/onboarding/progress.ts)", () => {
    state.pathname = "/dashboard";
    const withLaunch = [...steps, { id: "launched", title: "Launched live", description: "Why it matters.", href: "/setup", icon: "site", done: false, optional: false }] as typeof steps;
    const html = renderToStaticMarkup(createElement(SetupTracker, { steps: withLaunch }));
    expect(html).toContain("Show setup steps - 1 left");
    expect(html).not.toContain("Show setup steps - 2 left");
  });
});
