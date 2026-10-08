import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Google Analytics tag on the public pages: which id it accepts, what it
 * tells Google before the first hit (no page_view of its own, advertising
 * off, 13-month cookies), the cleaned address and referrer of every page,
 * silence on pages that are never counted, and a refusal deleting GA's
 * cookies. Run against a stand-in browser: the project has no DOM library.
 */

type Fake = {
  dataLayer: unknown[][];
  scripts: { src: string; async: boolean; dataset: Record<string, string> }[];
  cookieWrites: string[];
  idle: (() => void)[];
  window: Record<string, unknown>;
};

let fake: Fake;
let ga: typeof import("@/lib/google-analytics");

function browser(href: string, readyState: DocumentReadyState = "complete"): Fake {
  const url = new URL(href);
  const scripts: Fake["scripts"] = [];
  const cookieWrites: string[] = [];
  const idle: (() => void)[] = [];
  const win: Record<string, unknown> = {
    location: { href, origin: url.origin, hostname: url.hostname, protocol: url.protocol },
    requestIdleCallback: (fn: () => void) => idle.push(fn),
    addEventListener: (_type: string, fn: () => void) => idle.push(fn),
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    readyState,
    head: { appendChild: (el: Fake["scripts"][number]) => scripts.push(el) },
    createElement: () => ({ src: "", async: false, dataset: {} }),
    querySelector: (selector: string) => scripts.find((s) => selector.includes(`"${s.dataset.ga}"`)) ?? null,
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  });
  return {
    get dataLayer() {
      return ((win.dataLayer as IArguments[] | undefined) ?? []).map((entry) => Array.from(entry));
    },
    scripts,
    cookieWrites,
    idle,
    window: win,
  };
}

const ID = "G-ABC123XYZ";

beforeEach(async () => {
  vi.resetModules();
  ga = await import("@/lib/google-analytics");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("measurementId", () => {
  it("accepts a G- id (any case, trimmed) and nothing else", () => {
    expect(ga.measurementId(" g-abc123xyz ")).toBe(ID);
    expect(ga.measurementId(undefined)).toBeNull();
    expect(ga.measurementId("")).toBeNull();
    expect(ga.measurementId("UA-12345-1")).toBeNull();
    expect(ga.measurementId("123456789")).toBeNull();
    expect(ga.measurementId("G-abc'onload")).toBeNull();
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
  it("names GA's two cookies and every domain they can sit on", () => {
    expect(ga.gaCookieNames(ID)).toEqual(["_ga", "_ga_ABC123XYZ"]);
    expect(ga.cookieDomains("www.repget.com")).toEqual(["www.repget.com", "repget.com"]);
    expect(ga.cookieDomains("localhost")).toEqual([]);
    expect(ga.cookieDomains("127.0.0.1")).toEqual([]);
  });
});

describe("startGoogleAnalytics", () => {
  it("queues consent, then a config that sends no page view of its own and no advertising signals", () => {
    fake = browser("https://www.repget.com/");
    ga.startGoogleAnalytics(ID);
    const [consent, js, config] = fake.dataLayer;
    expect(consent).toEqual([
      "consent",
      "default",
      { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" },
    ]);
    expect(js[0]).toBe("js");
    expect(config).toEqual([
      "config",
      ID,
      { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 34128000 },
    ]);
  });

  it("downloads gtag.js only when the browser is idle, or at once right after Accept, and only once", () => {
    fake = browser("https://www.repget.com/", "loading");
    ga.startGoogleAnalytics(ID);
    expect(fake.scripts).toHaveLength(0);
    fake.idle.shift()!(); // load
    fake.idle.shift()!(); // idle
    expect(fake.scripts).toEqual([{ src: "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ", async: true, dataset: { ga: ID } }]);

    ga.startGoogleAnalytics(ID, { soon: true });
    expect(fake.scripts).toHaveLength(1);
  });

  it("right after Accept, loads without waiting", async () => {
    vi.resetModules();
    ga = await import("@/lib/google-analytics");
    fake = browser("https://www.repget.com/pricing", "loading");
    ga.startGoogleAnalytics(ID, { soon: true });
    expect(fake.scripts).toHaveLength(1);
    expect(fake.idle).toHaveLength(0);
  });
});

describe("trackGooglePage", () => {
  it("reports the cleaned address, our referrer and the title, then a page view", () => {
    fake = browser("https://www.repget.com/sign-up?email=a@b.c#repget_key=1");
    ga.startGoogleAnalytics(ID);
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
    ga.startGoogleAnalytics(ID);
    const before = fake.dataLayer.length;
    expect(ga.trackGooglePage(ID, { href: "https://www.repget.com/admin/users", referrer: "", title: "Users" })).toBeNull();
    expect(fake.dataLayer).toHaveLength(before);
    expect(fake.window[`ga-disable-${ID}`]).toBe(true);
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
});
