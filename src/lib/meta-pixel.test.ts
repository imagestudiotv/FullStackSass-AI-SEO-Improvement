import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BrowserConversion } from "@/lib/google-analytics";

/**
 * The Meta Pixel (lib/meta-pixel.ts): which ids it accepts, which addresses
 * may reach Meta as they are, the loader's queue, page views only on safe
 * pages, a refusal revoking it and deleting its cookies, and conversions
 * sent once, with their id as Meta's event id. Run against a stand-in
 * browser: the project has no DOM library.
 */

type Fake = {
  calls: unknown[][];
  scripts: { src: string; async: boolean; dataset: Record<string, string> }[];
  cookieWrites: string[];
  idle: (() => void)[];
  storage: Map<string, string>;
};

let fake: Fake;
let meta: typeof import("@/lib/meta-pixel");

const ID = "1063151092935473";

function browser(href: string, referrer = "", cookies = ""): Fake {
  const url = new URL(href);
  const scripts: Fake["scripts"] = [];
  const cookieWrites: string[] = [];
  const idle: (() => void)[] = [];
  const storage = new Map<string, string>();
  const win: Record<string, unknown> = {
    location: { href, origin: url.origin, hostname: url.hostname, protocol: url.protocol },
    addEventListener: (_type: string, fn: () => void) => idle.push(fn),
    removeEventListener: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    referrer,
    head: { appendChild: (el: Fake["scripts"][number]) => scripts.push(el) },
    createElement: () => ({ src: "", async: false, dataset: {} }),
    querySelector: () => scripts[0] ?? null,
    get cookie() {
      return cookies;
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  });
  return {
    get calls() {
      const fbq = win.fbq as { queue?: IArguments[] } | undefined;
      return (fbq?.queue ?? []).map((entry) => Array.from(entry));
    },
    scripts,
    cookieWrites,
    idle,
    storage,
  };
}

beforeEach(async () => {
  vi.resetModules();
  meta = await import("@/lib/meta-pixel");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("metaPixelId", () => {
  it("accepts the digits of a Pixel ID, trimmed, and nothing else", () => {
    expect(meta.metaPixelId(` ${ID} `)).toBe(ID);
    expect(meta.metaPixelId(undefined)).toBeNull();
    expect(meta.metaPixelId("")).toBeNull();
    expect(meta.metaPixelId("G-ABC123XYZ")).toBeNull();
    expect(meta.metaPixelId("12345")).toBeNull();
    expect(meta.metaPixelId(`${ID}'onload`)).toBeNull();
  });
});

describe("metaSafeAddress", () => {
  it("lets through a plain page, with campaign tags and Meta's click id", () => {
    expect(meta.metaSafeAddress("https://www.repget.com/")).toBe(true);
    expect(meta.metaSafeAddress("https://www.repget.com/pricing")).toBe(true);
    expect(meta.metaSafeAddress("https://www.repget.com/fr/blog/un-article?utm_source=facebook&fbclid=IwAR0abc")).toBe(true);
    expect(meta.metaSafeAddress("https://www.repget.com/onboarding/plan")).toBe(true);
  });

  it("refuses anything the site's cleaning would change", () => {
    expect(meta.metaSafeAddress("https://www.repget.com/sign-up?email=a@b.com")).toBe(false);
    expect(meta.metaSafeAddress("https://www.repget.com/pricing?utm_source=x&token=abc")).toBe(false);
    expect(meta.metaSafeAddress("https://www.repget.com/connect/wordpress#repget_key=secret")).toBe(false);
    expect(meta.metaSafeAddress("https://www.repget.com/invite/abc123")).toBe(false);
    expect(meta.metaSafeAddress("https://www.repget.com/websites/0b8f6c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f/articles")).toBe(false);
    expect(meta.metaSafeAddress("https://www.repget.com/admin/blog")).toBe(false);
    expect(meta.metaSafeAddress("not an address")).toBe(false);
  });

  it("checks a same-site referrer too, and leaves another site's alone", () => {
    expect(meta.metaSafePage("https://www.repget.com/", "")).toBe(true);
    expect(meta.metaSafePage("https://www.repget.com/onboarding", "https://www.repget.com/sign-up?email=a@b.com")).toBe(false);
    expect(meta.metaSafePage("https://www.repget.com/onboarding", "https://www.repget.com/sign-up")).toBe(true);
    expect(meta.metaSafePage("https://www.repget.com/", "https://www.facebook.com/")).toBe(true);
    expect(meta.metaSafePage("https://www.repget.com/sign-up?email=a@b.com", "")).toBe(false);
  });
});

describe("trackMetaPage", () => {
  it("queues consent, no automatic events, the pixel and a page view, then loads Meta's script at the visitor's first move", () => {
    fake = browser("https://www.repget.com/features?fbclid=IwAR0abc");
    expect(meta.trackMetaPage(ID, { href: window.location.href, referrer: "" })).toBe(true);
    expect(fake.calls).toEqual([["consent", "grant"], ["set", "autoConfig", false, ID], ["init", ID], ["track", "PageView"]]);
    expect((window as unknown as { fbq: { disablePushState: boolean } }).fbq.disablePushState).toBe(true);
    expect(fake.scripts).toEqual([]);
    fake.idle[0]();
    expect(fake.scripts.map((s) => s.src)).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
  });

  it("loads at once right after Accept, and sets the pixel up only once", () => {
    fake = browser("https://www.repget.com/");
    meta.trackMetaPage(ID, { href: "https://www.repget.com/", referrer: "" }, { soon: true });
    meta.trackMetaPage(ID, { href: "https://www.repget.com/pricing", referrer: "" });
    expect(fake.scripts).toHaveLength(1);
    expect(fake.calls.filter((call) => call[0] === "init")).toHaveLength(1);
    expect(fake.calls.filter((call) => call[1] === "PageView")).toHaveLength(2);
  });

  it("sends nothing, and loads nothing, on a page that is not safe to report", () => {
    fake = browser("https://www.repget.com/sign-up?email=a@b.com");
    expect(meta.trackMetaPage(ID, { href: window.location.href, referrer: "" }, { soon: true })).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(fake.scripts).toEqual([]);
  });
});

describe("forgetMetaPixel", () => {
  it("revokes the pixel, deletes its cookies on every domain, and grants again on a later Accept", () => {
    fake = browser("https://www.repget.com/");
    meta.trackMetaPage(ID, { href: "https://www.repget.com/", referrer: "" }, { soon: true });
    meta.forgetMetaPixel();
    expect(fake.calls.at(-1)).toEqual(["consent", "revoke"]);
    for (const name of ["_fbp", "_fbc"]) {
      expect(fake.cookieWrites).toContain(`${name}=; Max-Age=0; Path=/`);
      expect(fake.cookieWrites).toContain(`${name}=; Max-Age=0; Path=/; Domain=.repget.com`);
    }
    meta.trackMetaPage(ID, { href: "https://www.repget.com/", referrer: "" });
    expect(fake.calls.slice(-2)).toEqual([["consent", "grant"], ["track", "PageView"]]);
  });

  it("only deletes cookies when the pixel never started", () => {
    fake = browser("https://www.repget.com/");
    meta.forgetMetaPixel();
    expect(fake.calls).toEqual([]);
    expect(fake.cookieWrites.length).toBeGreaterThan(0);
  });
});

describe("sendMetaConversions", () => {
  const SIGN_UP: BrowserConversion = { id: "c_signup1", name: "sign_up", params: { method: "email" } };
  const TRIAL: BrowserConversion = { id: "c_trial1", name: "start_trial", params: { plan: "Grow" } };

  it("sends nothing without Accept or without a pixel", () => {
    fake = browser("https://www.repget.com/onboarding");
    for (const consent of [null, "denied"] as const) expect(meta.sendMetaConversions([SIGN_UP], consent, ID)).toEqual([]);
    expect(meta.sendMetaConversions([SIGN_UP], "granted", null)).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("sends Meta's standard events with the conversion id as event id, and each one once", () => {
    fake = browser("https://www.repget.com/onboarding");
    expect(meta.sendMetaConversions([SIGN_UP, TRIAL], "granted", ID)).toEqual(["CompleteRegistration", "StartTrial"]);
    expect(fake.calls.slice(-2)).toEqual([
      ["track", "CompleteRegistration", { content_name: "signup" }, { eventID: "c_signup1" }],
      ["track", "StartTrial", { value: 0, currency: "EUR", content_name: "grow" }, { eventID: "c_trial1" }],
    ]);
    expect(fake.scripts).toHaveLength(1);
    expect(meta.sendMetaConversions([SIGN_UP, TRIAL], "granted", ID)).toEqual([]);
  });

  it("waits for a safe page without remembering anything, and keeps its own list apart from Google's", () => {
    fake = browser("https://www.repget.com/websites/0b8f6c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f");
    expect(meta.sendMetaConversions([SIGN_UP], "granted", ID)).toEqual([]);
    expect(fake.storage.size).toBe(0);

    fake = browser("https://www.repget.com/onboarding");
    fake.storage.set("repget_conversions", JSON.stringify(["c_signup1"]));
    expect(meta.sendMetaConversions([SIGN_UP], "granted", ID)).toEqual(["CompleteRegistration"]);
  });
});

describe("a conversion while the download waits", () => {
  it("loads Meta's script at once", () => {
    fake = browser("https://www.repget.com/sign-up");
    meta.trackMetaPage(ID, { href: "https://www.repget.com/sign-up", referrer: "" });
    expect(fake.scripts).toEqual([]);
    meta.sendMetaConversions([{ id: "c_signup2", name: "sign_up", params: {} }], "granted", ID);
    expect(fake.scripts).toHaveLength(1);
    fake.idle[0]();
    expect(fake.scripts).toHaveLength(1);
  });
});

describe("the client's guide (2026-11-18): ViewContent, Lead and the server's copies", () => {
  const FBP = "fb.1.1763460000000.1234567890";

  it("adds ViewContent on the pricing page, in any language, and nowhere else", async () => {
    for (const href of ["https://www.repget.com/pricing", "https://www.repget.com/es/pricing", "https://www.repget.com/pricing-guide"]) {
      vi.resetModules();
      meta = await import("@/lib/meta-pixel");
      fake = browser(href);
      expect(meta.trackMetaPage(ID, { href, referrer: "" })).toBe(true);
      const expected = href.endsWith("pricing") ? [["track", "PageView"], ["track", "ViewContent", { content_name: "pricing" }]] : [["init", ID], ["track", "PageView"]];
      expect(fake.calls.slice(-2)).toEqual(expected);
    }
  });

  it("sends Lead after Accept with the id the server computes from _fbp and the day", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T12:00:00Z"), toFake: ["Date"] });
    try {
      fake = browser("https://www.repget.com/audit", "", `repget_consent=3.granted; _fbp=${FBP}`);
      expect(await meta.trackMetaLead("granted", ID)).toBe(true);
      const { leadEventId } = await import("@/lib/conversions/meta-capi");
      expect(fake.calls.at(-1)).toEqual(["track", "Lead", { content_name: "free_audit" }, { eventID: leadEventId(FBP, "2026-11-18") }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends no Lead without Accept, without _fbp (the server's copy stands alone) or from an unsafe page", async () => {
    fake = browser("https://www.repget.com/audit", "", `_fbp=${FBP}`);
    expect(await meta.trackMetaLead(null, ID)).toBe(false);
    fake = browser("https://www.repget.com/audit");
    expect(await meta.trackMetaLead("granted", ID)).toBe(false);
    fake = browser("https://www.repget.com/audit?domain=acme.com", "", `_fbp=${FBP}`);
    expect(await meta.trackMetaLead("granted", ID)).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("asks the server for its copy of each conversion once per browser, after Accept, whatever the page", () => {
    const SIGN_UP: BrowserConversion = { id: "c_signup1", name: "sign_up", params: {} };
    fake = browser("https://www.repget.com/websites/0b8f6c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f");
    expect(meta.claimMetaServerConversions([SIGN_UP], null, ID)).toEqual([]);
    expect(meta.claimMetaServerConversions([SIGN_UP], "granted", null)).toEqual([]);
    expect(meta.claimMetaServerConversions([SIGN_UP], "granted", ID)).toEqual(["c_signup1"]);
    expect(meta.claimMetaServerConversions([SIGN_UP], "granted", ID)).toEqual([]);
    // Its own list: the pixel still sends its copy on a safe page.
    fake.storage.delete("repget_conversions");
  });
});

describe("InitiateCheckout and the image for browsers without JavaScript", () => {
  const CHECKOUT = { eventId: "c_checkout1", value: 149, currency: "EUR", contentName: "grow" };

  it("sends InitiateCheckout with the server's id after Accept, from a safe page, then lets the page go", async () => {
    fake = browser("https://www.repget.com/billing");
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const sent = meta.trackMetaCheckout(CHECKOUT, "granted", ID);
      await vi.advanceTimersByTimeAsync(meta.CHECKOUT_WAIT_MS);
      expect(await sent).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    expect(fake.calls.at(-1)).toEqual(["track", "InitiateCheckout", { value: 149, currency: "EUR", content_name: "grow" }, { eventID: "c_checkout1" }]);
  });

  it("sends nothing and waits for nothing without Accept, without the event, or from an address with a record id", async () => {
    fake = browser("https://www.repget.com/billing");
    expect(await meta.trackMetaCheckout(CHECKOUT, null, ID)).toBe(false);
    expect(await meta.trackMetaCheckout(undefined, "granted", ID)).toBe(false);
    fake = browser("https://www.repget.com/onboarding/plan?site=0b8f6c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f");
    expect(await meta.trackMetaCheckout(CHECKOUT, "granted", ID)).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("points the no-JavaScript image at Meta's page view, as the guide's snippet does", () => {
    expect(meta.metaNoscriptSrc(ID)).toBe(`https://www.facebook.com/tr?id=${ID}&ev=PageView&noscript=1`);
  });
});
