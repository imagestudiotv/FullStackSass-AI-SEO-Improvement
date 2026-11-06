import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { localeFromReferrer } from "@/lib/i18n/app-locale";

/** Which language sign-in and sign-up take from the page someone came from. */
const HOST = "www.repget.com";
const from = (path: string) => localeFromReferrer(`https://${HOST}${path}`, HOST);

describe("the language of the page someone came from", () => {
  it("a translated page says its language", () => {
    expect(from("/it")).toBe("it");
    expect(from("/de/pricing")).toBe("de");
  });

  it("the English site is English, whatever the browser is set to", () => {
    expect(from("/")).toBe("en");
    expect(from("/pricing")).toBe("en");
  });

  it("www or not, it is the same site", () => {
    expect(localeFromReferrer("https://repget.com/es", HOST)).toBe("es");
  });

  it("pages that say nothing about the language leave it to the browser", () => {
    expect(from("/sign-in")).toBeNull();
    expect(from("/sign-up")).toBeNull();
    expect(from("/invite/abc")).toBeNull();
    expect(from("/onboarding/plan")).toBeNull();
  });

  it("another site, nothing, or nonsense leaves it to the browser", () => {
    expect(localeFromReferrer("https://www.google.com/it/search", HOST)).toBeNull();
    expect(localeFromReferrer(null, HOST)).toBeNull();
    expect(localeFromReferrer("https://www.repget.com/it", null)).toBeNull();
    expect(localeFromReferrer("not a url", HOST)).toBeNull();
  });
});
