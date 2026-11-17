import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VIDEOS_COPY } from "@/lib/i18n/videos";
import { socialPublishingCopy } from "@/lib/marketing/social-publishing";

/**
 * The Italian social-publishing landing page (the Google Ads pilot's
 * destination): Italian only, not indexed, sign-up in Italian, and no claim
 * the product does not back - above all, no general "schedule any Instagram
 * post" promise and no price, trial length or offer of its own.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ notFound }));

import Page, { generateMetadata, generateStaticParams } from "@/app/(localized)/[locale]/(pages)/social-publishing/page";

import { SocialPublishingContent } from "./social-publishing-page";

const copy = socialPublishingCopy("it")!;
const html = renderToStaticMarkup(createElement(SocialPublishingContent, { copy, locale: "it" }));
const params = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<"/[locale]/social-publishing">;

describe("/it/social-publishing", () => {
  it("is built in Italian only; any other language is a 404", async () => {
    expect(generateStaticParams()).toEqual([{ locale: "it" }]);
    for (const locale of ["es", "fr", "de", "en", "xx"]) {
      await expect(Page(params(locale))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(await generateMetadata(params(locale))).toEqual({});
    }
  });

  it("names itself as canonical, declares no translations it does not have, and stays out of search", async () => {
    const metadata = await generateMetadata(params("it"));
    expect(metadata).toMatchObject({ title: copy.metaTitle, description: copy.metaDescription, robots: { index: false, follow: true } });
    expect(metadata.alternates).toEqual({ canonical: "/it/social-publishing" });
    expect(metadata.openGraph?.url).toBe("/it/social-publishing");
  });

  it("has one h1 and sends people to the Italian sign-up and pricing, with no tracking id of its own", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    // Sign-up has one address; it takes the language from this page (lib/i18n/app-locale.ts).
    expect(html.match(/href="\/sign-up"/g)).toHaveLength(2);
    expect(html.match(/href="\/it\/pricing"/g)).toHaveLength(2);
    expect(html).not.toMatch(/gclid|utm_|wbraid|gbraid/);
  });

  it("says what cannot be scheduled, and shows the app's own statuses", () => {
    expect(html).toContain("Non ancora");
    expect(copy.faq[0].answer).toMatch(/^Non ancora\./);
    const app = VIDEOS_COPY.it.status;
    expect(copy.statuses).toEqual([app.ready, app.scheduled, app.posting, app.posted]);
  });

  it("makes no price, free-trial length, discount, result or guarantee claim", () => {
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(/€|\beur\b|\d+\s*giorni di prova|gratis|gratuit|sconto|garant|follower|clienti soddisfatti/i);
  });
});
