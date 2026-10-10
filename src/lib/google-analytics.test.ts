import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Google's tags on the public pages: which ids they accept, Consent Mode v2
 * (every signal denied before anything else, then the visitor's answer),
 * the Tag Manager container beside GA, the cleaned address (campaign tags
 * kept) and referrer of every page, silence on pages that are never
 * counted, a refusal deleting GA's and Ads' cookies, and conversions sent
 * from signed-in pages once. Run against a stand-in browser: the project
 * has no DOM library.
 */

type Fake = {
  dataLayer: unknown[][];
  /** The container's own entries ({ event: ... }), which are not gtag commands. */
  pushes: Record<string, unknown>[];
  scripts: { src: string; async: boolean; dataset: Record<string, string> }[];
  cookieWrites: string[];
  idle: (() => void)[];
  storage: Map<string, string>;
  window: Record<string, unknown>;
};

let fake: Fake;
let ga: typeof import("@/lib/google-analytics");

function browser(href: string, readyState: DocumentReadyState = "complete", cookies = ""): Fake {
  const url = new URL(href);
  const scripts: Fake["scripts"] = [];
  const cookieWrites: string[] = [];
  const idle: (() => void)[] = [];
  const storage = new Map<string, string>();
  const win: Record<string, unknown> = {
    location: { href, origin: url.origin, hostname: url.hostname, protocol: url.protocol },
    requestIdleCallback: (fn: () => void) => idle.push(fn),
    addEventListener: (_type: string, fn: () => void) => idle.push(fn),
    setTimeout: () => 1,
    clearTimeout: () => {},
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    readyState,
    head: { appendChild: (el: Fake["scripts"][number]) => scripts.push(el) },
    createElement: () => ({ src: "", async: false, dataset: {} }),
    querySelector: (selector: string) => scripts.find((s) => selector.includes(`"${s.dataset.ga}"`)) ?? null,
    get cookie() {
      return cookies;
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  });
  const entries = () => (win.dataLayer as unknown[] | undefined) ?? [];
  const isPush = (entry: unknown) => typeof (entry as Record<string, unknown>).event === "string";
  return {
    get dataLayer() {
      return entries()
        .filter((entry) => !isPush(entry))
        .map((entry) => Array.from(entry as IArguments));
    },
    get pushes() {
      return entries().filter(isPush) as Record<string, unknown>[];
    },
    scripts,
    cookieWrites,
    idle,
    storage,
    window: win,
  };
}

const ID = "G-ABC123XYZ";
const GA_ONLY = { ga: ID, gtm: null };
const DENIED = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const GRANTED = { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };

beforeEach(async () => {
  vi.resetModules();
  ga = await import("@/lib/google-analytics");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the deployment's settings", () => {
  it("accepts a G- id (any case, trimmed) and nothing else", () => {
    expect(ga.measurementId(" g-abc123xyz ")).toBe(ID);
    expect(ga.measurementId(undefined)).toBeNull();
    expect(ga.measurementId("")).toBeNull();
    expect(ga.measurementId("UA-12345-1")).toBeNull();
    expect(ga.measurementId("123456789")).toBeNull();
    expect(ga.measurementId("G-abc'onload")).toBeNull();
  });

  it("accepts a GTM- container id and nothing else", () => {
    expect(ga.tagManagerId(" gtm-ab12cd3 ")).toBe("GTM-AB12CD3");
    expect(ga.tagManagerId(undefined)).toBeNull();
    expect(ga.tagManagerId("G-ABC123XYZ")).toBeNull();
    expect(ga.tagManagerId("GTM-x'onload")).toBeNull();
  });

  it("is in basic consent mode unless advanced is asked for by name", () => {
    expect(ga.consentMode(undefined)).toBe("basic");
    expect(ga.consentMode("")).toBe("basic");
    expect(ga.consentMode("yes")).toBe("basic");
    expect(ga.consentMode(" Advanced ")).toBe("advanced");
  });

  it("runs the tags after Accept; before an answer only in advanced mode; after Decline never", () => {
    expect(ga.tagsAllowed("granted", "basic")).toBe(true);
    expect(ga.tagsAllowed(null, "basic")).toBe(false);
    expect(ga.tagsAllowed(null, "advanced")).toBe(true);
    expect(ga.tagsAllowed("denied", "advanced")).toBe(false);
    expect(ga.tagsAllowed("denied", "basic")).toBe(false);
  });
});

describe("cleanReferrer", () => {
  const origin = "https://www.repget.com";
  it("cleans our own pages like any page, and drops the ones never counted", () => {
    expect(ga.cleanReferrer("https://www.repget.com/sign-in?email=a@b.c#x", origin)).toBe("https://www.repget.com/sign-in");
    expect(ga.cleanReferrer("https://www.repget.com/invite/secret-token", origin)).toBe("https://www.repget.com/invite/[token]");
    expect(ga.cleanReferrer("https://www.repget.com/admin/users", origin)).toBe("");
  });

  it("keeps only another site's origin", () => {
    expect(ga.cleanReferrer("https://www.google.com/search?q=repget", origin)).toBe("https://www.google.com/");
    expect(ga.cleanReferrer("https://news.example/a/b?c=d", origin)).toBe("https://news.example/");
  });

  it("reports nothing it cannot read", () => {
    expect(ga.cleanReferrer("", origin)).toBe("");
    expect(ga.cleanReferrer("not a url", origin)).toBe("");
    expect(ga.cleanReferrer("android-app://com.google.android.gm/", origin)).toBe("");
  });
});

describe("cookies", () => {
  it("names GA's two cookies, Google Ads' ones, and every domain they can sit on", () => {
    expect(ga.gaCookieNames(ID)).toEqual(["_ga", "_ga_ABC123XYZ"]);
    expect(ga.adsCookieNames("_ga=1; _gcl_au=1.1; x=2; _gcl_aw=GCL.1")).toEqual(["_gcl_au", "_gcl_aw"]);
    expect(ga.cookieDomains("www.repget.com")).toEqual(["www.repget.com", "repget.com"]);
    expect(ga.cookieDomains("localhost")).toEqual([]);
    expect(ga.cookieDomains("127.0.0.1")).toEqual([]);
  });
});

describe("startGoogleTags", () => {
  it("sets every Consent Mode v2 signal to denied before anything else, then the answer, then a config with no page view of its own", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags(GA_ONLY, { granted: true });
    const [consent, update, js, config] = fake.dataLayer;
    expect(consent).toEqual(["consent", "default", DENIED]);
    expect(update).toEqual(["consent", "update", GRANTED]);
    expect(js[0]).toBe("js");
    expect(config).toEqual(["config", ID, { send_page_view: false, allow_google_signals: false, cookie_expires: 34128000 }]);
  });

  it("leaves every signal denied for a visitor who has not answered (advanced mode)", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags(GA_ONLY, { granted: false });
    expect(fake.dataLayer.filter((entry) => entry[0] === "consent")).toEqual([["consent", "default", DENIED]]);
  });

  it("downloads gtag.js only when the browser is idle, or at once right after Accept, and only once", () => {
    fake = browser("https://www.repget.com/", "loading");
    ga.startGoogleTags(GA_ONLY, { granted: true });
    expect(fake.scripts).toHaveLength(0);
    fake.idle.shift()!(); // load
    fake.idle.shift()!(); // idle
    expect(fake.scripts).toEqual([{ src: "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ", async: true, dataset: { ga: ID } }]);

    ga.startGoogleTags(GA_ONLY, { granted: true, soon: true });
    expect(fake.scripts).toHaveLength(1);
  });

  it("right after Accept, loads without waiting", () => {
    fake = browser("https://www.repget.com/pricing", "loading");
    ga.startGoogleTags(GA_ONLY, { granted: true, soon: true });
    expect(fake.scripts).toHaveLength(1);
    expect(fake.idle).toHaveLength(0);
  });

  it("loads the Tag Manager container beside GA, after the consent signals", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags({ ga: ID, gtm: "GTM-AB12CD3" }, { granted: false, soon: true });
    expect(fake.scripts.map((script) => script.src)).toEqual([
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ",
      "https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3",
    ]);
    expect(fake.pushes).toEqual([expect.objectContaining({ event: "gtm.js" })]);
    expect(fake.dataLayer[0]).toEqual(["consent", "default", DENIED]);
  });

  it("an answer given later updates all four signals together", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags(GA_ONLY, { granted: false });
    ga.startGoogleTags(GA_ONLY, { granted: true });
    expect(fake.dataLayer.at(-1)).toEqual(["consent", "update", GRANTED]);
    ga.setGoogleConsent(false);
    expect(fake.dataLayer.at(-1)).toEqual(["consent", "update", DENIED]);
  });

  it("does nothing without a tag", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags({ ga: null, gtm: null }, { granted: true, soon: true });
    expect(fake.scripts).toHaveLength(0);
    expect(fake.window.dataLayer).toBeUndefined();
  });
});

describe("trackGooglePage", () => {
  it("reports the cleaned address, our referrer and the title, then a page view", () => {
    fake = browser("https://www.repget.com/sign-up?email=a@b.c#repget_key=1");
    ga.startGoogleTags(GA_ONLY, { granted: true });
    const sent = ga.trackGooglePage(ID, {
      href: "https://www.repget.com/sign-up?email=a@b.c#repget_key=1",
      referrer: "https://www.google.com/",
      title: "Create your account | RepGet",
    });
    expect(sent).toBe("https://www.repget.com/sign-up");
    expect(fake.dataLayer.slice(-2)).toEqual([
      ["set", { page_location: "https://www.repget.com/sign-up", page_referrer: "https://www.google.com/", page_title: "Create your account | RepGet" }],
      ["event", "page_view"],
    ]);
    expect(fake.window[`ga-disable-${ID}`]).toBe(false);
    // The raw address never reaches the queue.
    expect(JSON.stringify(fake.dataLayer)).not.toContain("email=");
  });

  it("silences GA on a page that is never counted, without queueing anything", () => {
    fake = browser("https://www.repget.com/admin");
    ga.startGoogleTags(GA_ONLY, { granted: true });
    const before = fake.dataLayer.length;
    expect(ga.trackGooglePage(ID, { href: "https://www.repget.com/admin/users", referrer: "", title: "Users" })).toBeNull();
    expect(fake.dataLayer).toHaveLength(before);
    expect(fake.window[`ga-disable-${ID}`]).toBe(true);
  });

  it("keeps the campaign tags of an ad or a tagged link, and nothing else of the query", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleTags(GA_ONLY, { granted: true });
    const href = "https://www.repget.com/pricing?email=a@b.c&gclid=Cj0KCQ&utm_source=google&utm_medium=cpc&token=secret#x";
    // The next page's referrer is the plain address.
    expect(ga.trackGooglePage(ID, { href, referrer: "", title: "Pricing" })).toBe("https://www.repget.com/pricing");
    expect(fake.dataLayer.at(-2)).toEqual([
      "set",
      { page_location: "https://www.repget.com/pricing?utm_source=google&utm_medium=cpc&gclid=Cj0KCQ", page_referrer: "", page_title: "Pricing" },
    ]);
    expect(JSON.stringify(fake.dataLayer)).not.toMatch(/email=|token=|secret/);
    expect(ga.reportedAddress("https://www.repget.com/invite/abc?gclid=1")).toBe("https://www.repget.com/invite/[token]?gclid=1");
    expect(ga.reportedAddress("https://www.repget.com/admin?gclid=1")).toBeNull();
  });
});

describe("forgetGoogleAnalytics", () => {
  it("silences GA and deletes both cookies on the host and every parent domain", () => {
    fake = browser("https://www.repget.com/privacy");
    ga.forgetGoogleAnalytics(ID);
    expect(fake.window[`ga-disable-${ID}`]).toBe(true);
    expect(fake.cookieWrites).toEqual([
      "_ga=; Max-Age=0; Path=/",
      "_ga=; Max-Age=0; Path=/; Domain=.www.repget.com",
      "_ga=; Max-Age=0; Path=/; Domain=.repget.com",
      "_ga_ABC123XYZ=; Max-Age=0; Path=/",
      "_ga_ABC123XYZ=; Max-Age=0; Path=/; Domain=.www.repget.com",
      "_ga_ABC123XYZ=; Max-Age=0; Path=/; Domain=.repget.com",
    ]);
  });

  it("tells the tags, and deletes Google Ads' cookies too", () => {
    fake = browser("https://www.repget.com/privacy", "complete", "repget_consent=2.denied; _gcl_au=1.1.2; _ga=GA1.1.1.2");
    ga.startGoogleTags({ ga: ID, gtm: "GTM-AB12CD3" }, { granted: true });
    ga.forgetGoogleAnalytics(ID);
    expect(fake.dataLayer.at(-1)).toEqual(["consent", "update", DENIED]);
    expect(fake.cookieWrites).toContain("_gcl_au=; Max-Age=0; Path=/; Domain=.repget.com");
    expect(fake.cookieWrites.some((write) => write.startsWith("repget_consent"))).toBe(false);
  });
});

describe("sendGoogleConversions", () => {
  const SIGN_UP = { id: "c1", name: "sign_up" as const, params: { method: "google" } };
  const TRIAL = { id: "c2", name: "start_trial" as const, params: { plan: "Growth" } };
  const BOTH = { ga: ID, gtm: "GTM-AB12CD3" };

  it("sends nothing, and stores nothing, for a visitor who did not accept", () => {
    for (const consent of [null, "denied"] as const) {
      fake = browser("https://www.repget.com/onboarding");
      expect(ga.sendGoogleConversions([SIGN_UP], consent, BOTH)).toEqual([]);
      expect(fake.window.dataLayer).toBeUndefined();
      expect(fake.storage.size).toBe(0);
    }
  });

  it("sends each one once, from a signed-in page, with a neutral title and a clean address", () => {
    fake = browser("https://www.repget.com/websites/0b0e8a8e-7a3b-4c1e-9d1f-1a2b3c4d5e6f/articles?x=1");
    expect(ga.sendGoogleConversions([SIGN_UP, TRIAL], "granted", BOTH)).toEqual(["sign_up", "start_trial"]);
    const set = fake.dataLayer.find((entry) => entry[0] === "set");
    expect(set).toEqual(["set", { page_location: "https://www.repget.com/websites/[id]/articles", page_referrer: "", page_title: "RepGet" }]);
    const events = fake.dataLayer.filter((entry) => entry[0] === "event");
    expect(events.map((entry) => [entry[1], { ...(entry[2] as object), event_callback: undefined }])).toEqual([
      ["sign_up", { method: "google", event_callback: undefined }],
      ["start_trial", { plan: "Growth", event_callback: undefined }],
    ]);
    // The container gets them as its own events, with the id that stops Google Ads counting one twice.
    expect(fake.pushes.filter((push) => push.event !== "gtm.js")).toEqual([
      { event: "sign_up", method: "google", transaction_id: "c1" },
      { event: "start_trial", plan: "Growth", transaction_id: "c2" },
    ]);
    // GA is silenced again once Google has them.
    expect(fake.window[`ga-disable-${ID}`]).toBe(false);
    for (const entry of events) (entry[2] as { event_callback: () => void }).event_callback();
    expect(fake.window[`ga-disable-${ID}`]).toBe(true);
    // A reload does not count them again.
    expect(ga.sendGoogleConversions([SIGN_UP, TRIAL], "granted", BOTH)).toEqual([]);
  });

  it("sends nothing when the browser cannot remember what it sent", () => {
    fake = browser("https://www.repget.com/onboarding");
    fake.window.localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(ga.sendGoogleConversions([SIGN_UP], "granted", GA_ONLY)).toEqual([]);
    expect(fake.window.dataLayer).toBeUndefined();
  });
});
