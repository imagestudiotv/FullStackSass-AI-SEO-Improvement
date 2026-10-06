import { describe, expect, it } from "vitest";

import { analyticsBeforeSend, analyticsUrl } from "./site-analytics";

/**
 * Visit statistics (Vercel Web Analytics). The script reports location.href
 * as it stands; these pin what is left of it when it reaches Vercel.
 */

const SITE = "https://www.repget.com";
const UUID_A = "0b4c6a1e-2f3d-4e5f-8a9b-1c2d3e4f5a6b";
const UUID_B = "7F1E2D3C-4B5A-4968-8776-655443322110";
/** The shape of a real invitation token: 32 random bytes, base64url. */
const TOKEN = "q3Yv8kQx0Zb1nM2pL7sR4tU6wX9yA0cD-eF_gH5iJkL";

const at = (path: string) => analyticsUrl(`${SITE}${path}`);

describe("analyticsUrl", () => {
  it("leaves an ordinary page as it is", () => {
    expect(at("/")).toBe(`${SITE}/`);
    expect(at("/pricing")).toBe(`${SITE}/pricing`);
    expect(at("/es/pricing")).toBe(`${SITE}/es/pricing`);
    expect(at("/blog/top-10-fixes-for-2026")).toBe(`${SITE}/blog/top-10-fixes-for-2026`);
    expect(at("/blog/caf%C3%A9")).toBe(`${SITE}/blog/caf%C3%A9`);
  });

  it("drops every query string, whatever it holds", () => {
    expect(at("/pricing?utm_source=newsletter")).toBe(`${SITE}/pricing`);
    expect(at("/sign-in?email=jane%40example.com&next=%2Finvite%2Fabc")).toBe(`${SITE}/sign-in`);
    expect(at("/sign-up?email=jane%40example.com")).toBe(`${SITE}/sign-up`);
    expect(at("/connect/wordpress?request=req_123&error=denied")).toBe(`${SITE}/connect/wordpress`);
    // What PayPal appends when it sends a payer back.
    expect(at("/billing?subscription_id=I-ABC&ba_token=BA-1&token=EC-2")).toBe(`${SITE}/billing`);
    expect(at("/websites?repget_link=https%3A%2F%2Fexample.com%2Fwp-admin")).toBe(`${SITE}/websites`);
    // A bare "?" leaves no trace either.
    expect(at("/pricing?")).toBe(`${SITE}/pricing`);
  });

  it("drops every fragment", () => {
    expect(at("/docs/integrations/wordpress#install")).toBe(`${SITE}/docs/integrations/wordpress`);
    expect(at("/setup#repget_key=rk_live_secret")).toBe(`${SITE}/setup`);
    expect(at("/faq?q=1#a")).toBe(`${SITE}/faq`);
  });

  it("replaces an invitation token with the route's placeholder", () => {
    expect(at(`/invite/${TOKEN}`)).toBe(`${SITE}/invite/[token]`);
    expect(at(`/invite/${TOKEN}?from=email#top`)).toBe(`${SITE}/invite/[token]`);
    expect(at(`/Invite/${TOKEN}`)).toBe(`${SITE}/Invite/[token]`);
    // No token, nothing to hide.
    expect(at("/invite")).toBe(`${SITE}/invite`);
  });

  it("replaces a referral code the same way", () => {
    expect(at("/r/ABC123")).toBe(`${SITE}/r/[code]`);
  });

  it("drops a 404 below a token, whose route pattern this cannot clean", () => {
    expect(at(`/invite/${TOKEN}/accept`)).toBeNull();
    expect(at("/r/ABC123/x")).toBeNull();
  });

  it("does not count admin pages at all", () => {
    expect(at("/admin")).toBeNull();
    expect(at("/admin/")).toBeNull();
    expect(at(`/admin/network/${UUID_A}`)).toBeNull();
    expect(at("/admin/users?q=jane%40example.com")).toBeNull();
    // However it is spelled.
    expect(at("/Admin")).toBeNull();
    expect(at("/%61dmin")).toBeNull();
    expect(at("//admin")).toBeNull();
    expect(at("/invite/%2e%2e/admin")).toBeNull(); // the URL parser resolves this to /admin
  });

  it("matches /admin as a whole segment, not as a prefix of a word", () => {
    expect(at("/administrator")).toBe(`${SITE}/administrator`);
    expect(at("/blog/admin-tips")).toBe(`${SITE}/blog/admin-tips`);
  });

  it("does not count API addresses, where callbacks and verification links live", () => {
    expect(at("/api/auth/callback/google?code=4%2F0Ab&state=xyz")).toBeNull();
    expect(at("/api/auth/verify-email?token=eyJhbGciOi&callbackURL=%2Fdashboard")).toBeNull();
    expect(at("/api/integrations/google/callback?code=abc&state=def")).toBeNull();
  });

  it("replaces record ids, so no single workspace is named", () => {
    expect(at(`/websites/${UUID_A}`)).toBe(`${SITE}/websites/[id]`);
    expect(at(`/websites/${UUID_A}/articles/${UUID_B}?tab=seo`)).toBe(`${SITE}/websites/[id]/articles/[id]`);
  });

  it("normalises empty segments and a trailing slash", () => {
    expect(at("/pricing/")).toBe(`${SITE}/pricing`);
    expect(at("//pricing//")).toBe(`${SITE}/pricing`);
  });

  it("keeps the host, so previews and the real site stay apart, but not credentials", () => {
    expect(analyticsUrl("http://localhost:3000/pricing?x=1")).toBe("http://localhost:3000/pricing");
    expect(analyticsUrl(`https://user:hunter2@www.repget.com/pricing`)).toBe(`${SITE}/pricing`);
  });

  it("fails closed on anything it cannot read", () => {
    expect(analyticsUrl("not a url")).toBeNull();
    expect(analyticsUrl("")).toBeNull();
    expect(analyticsUrl("/pricing")).toBeNull(); // relative: the script always sends a full address
    expect(analyticsUrl("javascript:alert(1)")).toBeNull();
    expect(analyticsUrl("data:text/html,hi")).toBeNull();
    expect(at("/%E0%A4%A/x")).toBeNull(); // a first segment that will not decode
  });

  it("lets no secret through, wherever on the address it sits", () => {
    const secret = "s3cr3t-Value_42";
    const addresses = [
      `/pricing?k=${secret}`,
      `/pricing?${secret}`,
      `/pricing#${secret}`,
      `/pricing#k=${secret}&x=1`,
      `/invite/${secret}`,
      `/invite/${secret}?next=1`,
      `/invite/${secret}/accept`,
      `/r/${secret}`,
      `/admin/${secret}`,
      `/api/x?token=${secret}`,
      `/sign-in?email=${secret}%40example.com`,
    ];
    for (const path of addresses) {
      const reported = at(path);
      expect(reported ?? "", path).not.toContain(secret);
    }
    expect(analyticsUrl(`https://${secret}:${secret}@www.repget.com/x`)).not.toContain(secret);
  });
});

describe("analyticsBeforeSend", () => {
  it("cleans the address and keeps the rest of the event", () => {
    const event = {
      type: "pageview" as const,
      url: `${SITE}/invite/${TOKEN}?from=email`,
      payload: { name: "x" },
    };
    expect(analyticsBeforeSend(event)).toEqual({
      type: "pageview",
      url: `${SITE}/invite/[token]`,
      payload: { name: "x" },
    });
    // A copy: the caller's object is untouched.
    expect(event.url).toBe(`${SITE}/invite/${TOKEN}?from=email`);
  });

  it("cancels the event (null) for a page that is not counted", () => {
    expect(analyticsBeforeSend({ type: "pageview", url: `${SITE}/admin/payments` })).toBeNull();
    expect(analyticsBeforeSend({ type: "event", url: "garbage" })).toBeNull();
  });
});
