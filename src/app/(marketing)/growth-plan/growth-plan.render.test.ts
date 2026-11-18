import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { fill, growthPlanCopy } from "@/lib/i18n/growth-plan";
import { LOCALES, localePath } from "@/lib/i18n/config";

/**
 * The growth plan page (growth-plan-page.tsx) as the server sends it: the
 * visitor's website in the heading, the three steps with only the first one
 * under way, the work log, and nothing asked of the server until the browser
 * runs it. Without a usable address the page sends the visitor home.
 */

const redirected = vi.hoisted(() => ({ to: null as string | null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: (to: string) => {
    redirected.to = to;
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
const actions = vi.hoisted(() => ({ suggestSite: vi.fn(), auditForPlan: vi.fn() }));
vi.mock("./actions", () => actions);

import { GrowthPlanPageContent, growthPlanMetadata } from "./growth-plan-page";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("the growth plan page", () => {
  it.each(LOCALES)("%s: names the website, starts at the first step, and asks nothing on the server", (locale) => {
    const t = growthPlanCopy(locale);
    const html = renderToStaticMarkup(GrowthPlanPageContent({ locale, searchParams: { domain: "https://www.acme.com/shop" } }));

    expect(html).toContain(`<h1`);
    expect(html).toContain(esc(fill(t.title, { domain: "acme.com" })));
    for (const phase of t.phases) expect(html).toContain(esc(phase));
    expect(html.match(/data-state="active"/g)).toHaveLength(1);
    expect(html.match(/data-state="next"/g)).toHaveLength(2);
    expect(html).toContain(`aria-label="${esc(t.logLabel)}"`);
    expect(html).toContain('role="log"');
    expect(html).toContain(`href="${localePath(locale, "/")}"`);
    expect(actions.suggestSite).not.toHaveBeenCalled();
    expect(actions.auditForPlan).not.toHaveBeenCalled();
  });

  it.each(LOCALES)("%s: sends the visitor home without a usable address", (locale) => {
    for (const domain of [undefined, "", "not a website"]) {
      redirected.to = null;
      expect(() => GrowthPlanPageContent({ locale, searchParams: { domain } })).toThrow(/NEXT_REDIRECT/);
      expect(redirected.to).toBe(localePath(locale, "/"));
    }
  });

  it("is never indexed", () => {
    for (const locale of LOCALES) expect(growthPlanMetadata(locale).robots).toEqual({ index: false, follow: false });
  });
});
