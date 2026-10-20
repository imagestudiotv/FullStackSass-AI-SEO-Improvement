import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import robots from "@/app/robots";

import { checkReferralCode, referralCodeSuggestions, referralLinkPath } from "../domain/entities/partner";
import { partnerLinkRedirects } from "./link-redirect";
import { campaignParams, landingPath } from "./tracking-cookie";

/**
 * The partner link repget.com/?ref=<name>: the name rules, the redirect rule
 * in next.config.ts (run through Next's own matcher, so the pattern is
 * tested as Next reads it), and where /go/<name> may land.
 */

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match") as {
  getPathMatch: (source: string, options: { removeUnnamedParams: boolean; strict: boolean }) => (path: string) => Record<string, string> | false;
};
const { matchHas, prepareDestination } = require("next/dist/shared/lib/router/utils/prepare-destination") as {
  matchHas: (req: unknown, query: Record<string, string>, has: unknown[], missing: unknown[]) => Record<string, string> | false;
  prepareDestination: (args: { appendParamsToQuery: boolean; destination: string; params: Record<string, string>; query: Record<string, string> }) => {
    parsedDestination: { pathname: string; query: Record<string, string> };
  };
};

/** Where Next would redirect this request, or null when the rule does not apply. */
function redirectFor(path: string, query: Record<string, string>) {
  const [rule] = partnerLinkRedirects();
  const params = getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(path);
  if (!params) return null;
  const captured = matchHas({ headers: {}, cookies: {} }, query, rule.has, []);
  if (!captured) return null;
  const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination: rule.destination, params: { ...params, ...captured }, query });
  return { pathname: parsedDestination.pathname, to: parsedDestination.query.to };
}

describe("link names", () => {
  it("accepts readable names and the earlier random codes, in lower case", () => {
    expect(checkReferralCode("dami")).toEqual({ ok: true, code: "dami" });
    expect(checkReferralCode(" Dami-Olu ")).toEqual({ ok: true, code: "dami-olu" });
    expect(checkReferralCode("k7m2xq9prt")).toEqual({ ok: true, code: "k7m2xq9prt" });
    expect(checkReferralCode("a".repeat(30)).ok).toBe(true);
  });

  it.each(["ab", "a".repeat(31), "-dami", "dami-", "da--mi", "da mi", "dami_olu", "dámi", "dami/x", ""])("refuses %j", (raw) => {
    expect(checkReferralCode(raw)).toEqual({ ok: false, problem: "format" });
  });

  it.each(["admin", "support", "producthunt", "newsletter", "repget", "best-repget-deal"])("reserves %j", (raw) => {
    expect(checkReferralCode(raw)).toEqual({ ok: false, problem: "reserved" });
  });

  it("suggests from a name, best first", () => {
    expect(referralCodeSuggestions("Dami Olu").slice(0, 4)).toEqual(["dami", "dami-olu", "dami2", "dami3"]);
    expect(referralCodeSuggestions("José María López")[0]).toBe("jose");
    expect(referralCodeSuggestions("Al Smith")[0]).toBe("al-smith");
    expect(referralCodeSuggestions("Test User")[0]).toBe("test-user");
    expect(referralCodeSuggestions("李小龍")).toEqual([]);
    expect(referralCodeSuggestions("Dami Olu").every((code) => checkReferralCode(code).ok)).toBe(true);
  });

  it("builds the link", () => {
    expect(referralLinkPath("dami")).toBe("/?ref=dami");
  });
});

describe("?ref= on any public page (next.config.ts)", () => {
  it.each([
    ["/", "/"],
    ["/pricing", "/pricing"],
    ["/es/pricing", "/es/pricing"],
    ["/blog/some-post", "/blog/some-post"],
    ["/goals", "/goals"],
  ])("%s goes through /go with to=%s", (path, to) => {
    expect(redirectFor(path, { ref: "Dami" })).toEqual({ pathname: "/go/Dami", to });
  });

  it.each(["/go/dami", "/go", "/r/ABC123", "/api/stripe/webhook", "/_next/static/chunk.js"])("leaves %s alone (no loop, no API)", (path) => {
    expect(redirectFor(path, { ref: "dami" })).toBeNull();
  });

  it("leaves a value that cannot be a name alone", () => {
    expect(redirectFor("/", { ref: "a" })).toBeNull();
    expect(redirectFor("/", { ref: "x".repeat(31) })).toBeNull();
    expect(redirectFor("/", { ref: "a.b/c" })).toBeNull();
    expect(redirectFor("/", {})).toBeNull();
  });

  it("is temporary, so the same link keeps counting", () => {
    expect(partnerLinkRedirects()[0].permanent).toBe(false);
  });

  it("keeps crawlers out of /go/, so a crawler following partners' links counts no click", () => {
    expect((robots().rules as { disallow: string[] }).disallow).toContain("/go/");
  });
});

describe("where /go/<name> lands", () => {
  it.each([
    [null, "/"],
    ["/", "/"],
    ["/pricing", "/pricing"],
    ["/rank-on-chatgpt", "/rank-on-chatgpt"],
    ["/es", "/es"],
    ["/es/pricing", "/es/pricing"],
    ["/de/blog/ein-beitrag", "/de/blog/ein-beitrag"],
    ["/es/settings", "/es"],
    ["/admin", "/"],
    ["/partner/payouts", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example/", "/"],
    ["/pricing?x=1#y", "/pricing"],
  ])("%s lands on %s", (raw, expected) => {
    expect(landingPath(raw)).toBe(expected);
  });

  it("carries utm_ tags and nothing else", () => {
    const query = new URLSearchParams({ utm_source: "youtube", utm_campaign: "launch", ref: "dami", to: "/", other: "x" });
    expect(campaignParams(query)).toEqual([
      ["utm_source", "youtube"],
      ["utm_campaign", "launch"],
    ]);
    expect(campaignParams(new URLSearchParams({ utm_source: "y".repeat(300) }))[0][1]).toHaveLength(200);
  });
});
