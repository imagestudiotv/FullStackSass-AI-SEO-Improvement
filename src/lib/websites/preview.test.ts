import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The quick look at a website on the first setup screen (previewWebsite):
 * why it could not look, in the customer's app language, and never in a
 * network library's words.
 *
 * Reproduced first (2026-11-18): an Italian customer typing an address that
 * does not resolve read "getaddrinfo ENOTFOUND nowhere.example" - the
 * library's message, in English, passed through CrawlError to the toast.
 * The real crawler runs; only its fetch, the session and the stored
 * language are replaced.
 */

const state = vi.hoisted(() => ({
  locale: "en" as string,
  fetch: null as null | (() => Promise<Response>),
}));

vi.mock("@/lib/tenant", () => ({ requireOrg: vi.fn(async () => ({ orgId: "org_1", userId: "user_1", role: "owner" })) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: vi.fn(async () => ({ user: { id: "user_1" } })) }));
vi.mock("@/lib/i18n/app-locale", () => ({
  resolveAppLocale: vi.fn(async () => {
    if (state.locale === "fail") throw new Error("database unavailable");
    return state.locale;
  }),
}));
vi.mock("@/lib/websites/fetch-page", () => ({ fetchPage: vi.fn(async () => state.fetch!()) }));

import { ONBOARDING_ERRORS } from "@/lib/i18n/onboarding-errors";

import { previewWebsite } from "./preview";

const RAW = "getaddrinfo ENOTFOUND nowhere.example";
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  state.locale = "en";
  state.fetch = async () => {
    throw new TypeError(RAW);
  };
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

const status = (code: number) => async () => new Response("", { status: code, headers: { "content-type": "text/html" } });

describe("a site that cannot be reached", () => {
  it("in Italian and German: our sentence, never the library's, which is logged", async () => {
    state.locale = "it";
    expect(await previewWebsite("nowhere.example")).toEqual({ ok: false, error: "Non è stato possibile raggiungere il sito" });
    state.locale = "de";
    expect(await previewWebsite("nowhere.example")).toEqual({ ok: false, error: "Die Website war nicht erreichbar" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(RAW));
  });

  it("in English: our own sentence too, not the library's", async () => {
    const result = await previewWebsite("nowhere.example");
    expect(result).toEqual({ ok: false, error: "Could not reach the site" });
    expect(JSON.stringify(result)).not.toContain("ENOTFOUND");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(RAW));
  });

  it("when the language cannot be read: English, and the refusal still arrives", async () => {
    state.locale = "fail";
    expect(await previewWebsite("nowhere.example")).toEqual({ ok: false, error: "Could not reach the site" });
  });
});

describe("our own refusals", () => {
  it("say a refusal and a status in the reader's language, English as before", async () => {
    state.fetch = status(403);
    expect(await previewWebsite("guarded.example")).toEqual({ ok: false, error: ONBOARDING_ERRORS.en.website.blocksBots });
    state.locale = "it";
    expect(await previewWebsite("guarded.example")).toEqual({ ok: false, error: ONBOARDING_ERRORS.it.website.blocksBots });

    state.fetch = status(404);
    expect(await previewWebsite("gone.example")).toEqual({ ok: false, error: "Il sito ha risposto con il codice 404" });
    state.locale = "fr";
    expect(await previewWebsite("gone.example")).toEqual({ ok: false, error: "Le site a répondu avec le code 404" });
    state.locale = "en";
    expect(await previewWebsite("gone.example")).toEqual({ ok: false, error: "The site returned 404" });
  });

  it("an address that is not a website, before anything is fetched", async () => {
    state.locale = "es";
    expect(await previewWebsite("facebook.com/acme")).toEqual({ ok: false, error: "Introduzca su propio sitio web, no un perfil de redes sociales" });
    state.locale = "en";
    expect(await previewWebsite("localhost")).toEqual({ ok: false, error: "That address is not a public website" });
  });
});
