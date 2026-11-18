import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_COOKIE,
  consentCookie,
  onConsentChange,
  onConsentSettingsOpen,
  openConsentSettings,
  parseConsent,
  readConsent,
  saveConsent,
} from "@/lib/consent";

/**
 * The analytics cookie banner's memory: what counts as an answer, the
 * cookie it writes, and the events that tell the banner and the tracker.
 */

describe("parseConsent", () => {
  it("reads this version's two answers, wherever the cookie sits", () => {
    expect(parseConsent("repget_consent=2.granted")).toBe("granted");
    expect(parseConsent("a=1; repget_consent=2.denied; b=2")).toBe("denied");
    expect(parseConsent("  repget_consent = 2.granted ")).toBe("granted");
  });

  it("treats anything else as no answer, so the banner asks", () => {
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("other=2.granted")).toBeNull();
    expect(parseConsent("repget_consent=0.granted")).toBeNull();
    expect(parseConsent("repget_consent=yes")).toBeNull();
    expect(parseConsent("xrepget_consent=2.granted")).toBeNull();
  });

  it("asks again everyone who answered version 1 (analytics only, before advertising was added)", () => {
    expect(parseConsent("repget_consent=1.granted")).toBeNull();
    expect(parseConsent("repget_consent=1.denied")).toBeNull();
  });
});

describe("consentCookie", () => {
  it("is a first-party cookie for six months, Secure on HTTPS", () => {
    expect(consentCookie("granted", true)).toBe(`${CONSENT_COOKIE}=2.granted; Max-Age=15724800; Path=/; SameSite=Lax; Secure`);
    expect(consentCookie("denied", false)).toBe(`${CONSENT_COOKIE}=2.denied; Max-Age=15724800; Path=/; SameSite=Lax`);
  });
});

describe("saveConsent / readConsent", () => {
  let jar: string[];
  let blocked: boolean;

  beforeEach(() => {
    jar = [];
    blocked = false;
    const win = Object.assign(new EventTarget(), { location: { protocol: "https:" } });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      get cookie() {
        if (blocked) throw new Error("SecurityError");
        return jar.map((entry) => entry.split(";")[0]).join("; ");
      },
      set cookie(value: string) {
        if (blocked) throw new Error("SecurityError");
        jar = [...jar.filter((entry) => !entry.startsWith(value.split("=")[0] + "=")), value];
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the answer and tells every listener", () => {
    const heard: string[] = [];
    const stop = onConsentChange((consent) => heard.push(consent));
    saveConsent("granted");
    expect(jar).toEqual([consentCookie("granted", true)]);
    expect(readConsent()).toBe("granted");
    saveConsent("denied");
    expect(readConsent()).toBe("denied");
    stop();
    saveConsent("granted");
    expect(heard).toEqual(["granted", "denied"]);
  });

  it("keeps the answer for the page when the browser refuses cookies", () => {
    blocked = true;
    saveConsent("denied");
    expect(readConsent()).toBe("denied");
  });

  it("lets Cookie settings reopen the banner", () => {
    const opened = vi.fn();
    const stop = onConsentSettingsOpen(opened);
    openConsentSettings();
    stop();
    openConsentSettings();
    expect(opened).toHaveBeenCalledTimes(1);
  });
});

describe("with the Meta Pixel configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("asks again anyone who answered before the banner named Meta", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1063151092935473");
    vi.resetModules();
    const withMeta = await import("@/lib/consent");
    expect(withMeta.parseConsent(`${CONSENT_COOKIE}=2.granted`)).toBeNull();
    expect(withMeta.parseConsent(`${CONSENT_COOKIE}=3.granted`)).toBe("granted");
    expect(withMeta.consentCookie("denied", true)).toMatch(/^repget_consent=3\.denied;/);
  });
});
