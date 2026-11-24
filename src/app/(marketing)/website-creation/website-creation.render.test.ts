import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), permanentRedirect: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { websiteBuildRedirect } from "@/lib/config/site";
import { LOCALES, languageAlternates, localePath, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { WEBSITE_CREATION_COPY } from "@/lib/marketing/website-creation/copy";
import { isPublicEnglishPage } from "@/lib/seo/public-pages";
import { signUpForWebsiteProject } from "@/lib/website-projects/shared";

import { WebsiteCreationContent } from "./website-creation-page";

const render = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(WebsiteCreationContent, { locale }));

/** Every string in a copy tree, for the checks that apply to all of them. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe.each(LOCALES)("/website-creation in %s", (locale) => {
  const html = render(locale);
  const t = WEBSITE_CREATION_COPY[locale];

  it("has every section of the design", () => {
    for (const id of ['id="work"', 'id="process"', 'id="credits"', 'id="included"', 'id="faq"', 'id="create-your-website"', 'id="studio-email"', 'id="end-email"']) {
      expect(html).toContain(id);
    }
    expect(html.match(/<details/g)).toHaveLength(t.faq.items.length);
  });

  it("identifies the two real websites and links them; the concept stays a concept with no link", () => {
    expect(html).toContain('href="https://imagestudio.com/"');
    expect(html).toContain("Image Studio");
    expect(html).toContain('href="https://dumitruculiuc.com/"');
    expect(html).toContain("dumitru-culiuc.webp");
    expect(html.split(`>${t.work.liveChip}<`).length - 1).toBe(2);
    expect(html.split(`</i> ${t.work.realLabel}<`).length - 1).toBe(2);
    expect(html.split(t.work.conceptLabel).length - 1).toBe(2);
    expect(html).toContain("aurenia-residences.com");
    // An <a>: React also writes a preload <link> for the mock <img>, which is no link to anywhere.
    expect(html).not.toMatch(/<a [^>]*href="[^"]*aurenia/);
    // The third example was a concept until 2026-11-24.
    expect(html).not.toMatch(/forme-objects|atelier-forme|Forme Objects/i);
    for (const name of ["Image Studio", "Dumitru Culiuc", "Aurenia Residences"]) expect(t.work.honesty).toContain(name);
  });

  it("offers no price, deadline, second currency or named staff", () => {
    const text = strings(t).join(" \n ");
    // A currency amount, or a number of credits, days or weeks.
    expect(text).not.toMatch(/[€$£]\s?\d|\d\s?(€|EUR|USD)/);
    expect(text).not.toMatch(/\d+\s*(credits?|créditos?|crédits?|crediti|Credits|days?|weeks?|días|semanas|jours|semaines|giorni|settimane|Tage|Wochen)\b/i);
    expect(text).not.toMatch(/development credits|website credits|créditos de desarrollo|crédits de développement|crediti di sviluppo|Entwicklungs-?credits/i);
  });

  it("ships none of the prototype's scripts or inline images", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("unsplash");
    expect(html).not.toContain("localStorage");
  });

  it("registration keeps the project type", () => {
    expect(html).toContain(`href="/sign-up?next=${encodeURIComponent("/website-projects?type=new")}"`);
  });

  it("has an address in the sitemap's list, the language switcher's, and hreflang", () => {
    expect(TRANSLATED_PATHS.has("/website-creation")).toBe(true);
    expect(isPublicEnglishPage("/website-creation")).toBe(true);
    expect(localePath(locale, "/website-creation")).toBe(locale === "en" ? "/website-creation" : `/${locale}/website-creation`);
    expect(languageAlternates("/website-creation")[locale]).toBe(localePath(locale, "/website-creation"));
  });
});

describe("carrying the visitor's choice", () => {
  it("sends the type and the typed address through the real sign-up", () => {
    expect(signUpForWebsiteProject("/sign-up", "redesign", "ada+1@example.com")).toBe(
      `/sign-up?next=${encodeURIComponent("/website-projects?type=redesign")}&email=${encodeURIComponent("ada+1@example.com")}`,
    );
  });

  it("the old contact link forwards with its other parameters, without the topic", () => {
    expect(websiteBuildRedirect("/website-creation", { about: "website_build" })).toBe("/website-creation");
    expect(websiteBuildRedirect("/it/website-creation", { about: "website_build", utm_source: "x", type: "redesign" })).toBe("/it/website-creation?utm_source=x&type=redesign");
  });
});
