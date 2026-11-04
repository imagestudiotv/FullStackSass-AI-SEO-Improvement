import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { photoOf } from "../../_home/review-people";

/**
 * The testimonials design preview: administrators see the homepage with
 * every card from Admin -> Testimonials, drafts included; everyone else gets
 * a 404, and search engines are kept away.
 */

const state = vi.hoisted(() => ({ admin: false }));
vi.mock("@/lib/admin/guard", () => ({ isAdmin: async () => state.admin }));
vi.mock("@/lib/billing", () => ({ listPlansForPrebuiltPage: async () => [] }));
const CARDS = vi.hoisted(() =>
  Array.from({ length: 12 }, (_, i) => ({
    name: `Fixture ${i + 1}`,
    role: "Fixture role",
    quote: `Fixture quote ${i + 1}.`,
    avatar: `/preview/testimonials/sample-${String(i + 1).padStart(2, "0")}.webp`,
    published: i < 2,
  })),
);
vi.mock("@/lib/marketing/testimonials-db", () => ({ listTestimonialsForPreview: async () => CARDS }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import TestimonialsPreviewPage, { metadata } from "./page";

const render = async (lang?: string) =>
  renderToStaticMarkup(await TestimonialsPreviewPage({ searchParams: Promise.resolve(lang ? { lang } : {}) }));

beforeEach(() => {
  state.admin = false;
});

describe("the testimonials design preview", () => {
  it("is a 404 for anyone who is not an administrator, and never indexed", async () => {
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("shows administrators the homepage with every card, drafts included, and their pictures", async () => {
    state.admin = true;
    const html = await render();
    expect(html).toContain("Design preview - every testimonial card, drafts included (2 published, 10 drafts)");
    expect(html).toContain('href="/admin/testimonials"');
    for (const card of CARDS) {
      expect(html).toContain(card.name);
      // The design sets the drawn-letter files (_home/review-people.ts) in its own letters.
      if (photoOf(card.avatar)) expect(html).toContain(`src="${card.avatar}"`);
    }
    expect(html).toContain('id="repget-reviews"');
    // Every card is in the first paint; "Show more" folds the rest once the page has loaded.
    expect(html.match(/<article/g)?.length).toBeGreaterThanOrEqual(CARDS.length);
  });

  it("shows the page around the cards in another language on request", async () => {
    state.admin = true;
    // The reviews heading, its accent words drawn in orange.
    expect(await render("it")).toContain("Scelto da chi ");
    expect(await render("xx")).toContain("Loved by people who ");
  });
});
