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

function browser(href: string, referrer = ""): Fake {
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
      return "";
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
    fake = browser("https://www.repget.com/pricing?fbclid=IwAR0abc");
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
      ["track", "CompleteRegistration", {}, { eventID: "c_signup1" }],
      ["track", "StartTrial", { content_name: "Grow" }, { eventID: "c_trial1" }],
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
