import { describe, expect, it, vi } from "vitest";

/**
 * Old language-prefixed addresses of English-only pages (Search Console 404s,
 * client 2026-10-13): sent to the English page for good; everything else
 * under a prefix stays a 404.
 */

const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`PERMANENT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => nav);

import UnknownTranslatedPage from "./page";

const visit = (locale: string, rest: string[]) =>
  UnknownTranslatedPage({ params: Promise.resolve({ locale, rest }) } as unknown as PageProps<"/[locale]/[...rest]">);

describe("an address under a language prefix that is not a translated page", () => {
  it.each([
    // The three in the client's Search Console report.
    ["de", ["tools"], "/tools"],
    ["es", ["audit"], "/audit"],
    ["it", ["docs", "integrations", "ghost"], "/docs/integrations/ghost"],
    // And the rest of the English-only pages, from the same list as the sitemap.
    ["fr", ["tools", "robots-checker"], "/tools/robots-checker"],
    ["de", ["docs", "integrations"], "/docs/integrations"],
    ["es", ["rank-on-chatgpt"], "/rank-on-chatgpt"],
    ["it", ["privacy"], "/privacy"],
  ])("/%s/%s goes to its English page for good", async (locale, rest, english) => {
    await expect(visit(locale, rest)).rejects.toThrow(`PERMANENT_REDIRECT ${english}`);
  });

  it.each([
    ["es", ["no-such-page"]],
    ["fr", ["tools", "not-a-tool"]],
    ["de", ["sign-in"]],
    ["it", ["websites"]],
    ["es", ["blog", "category", "guides", "extra"]],
    ["de", ["..", "admin"]],
    ["fr", ["tools?domain=x"]],
  ])("/%s/%s stays a 404", async (locale, rest) => {
    await expect(visit(locale, rest)).rejects.toThrow("NOT_FOUND");
  });
});
