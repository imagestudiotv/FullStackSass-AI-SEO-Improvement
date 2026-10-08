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
    expect(parseConsent("repget_consent=1.granted")).toBe("granted");
    expect(parseConsent("a=1; repget_consent=1.denied; b=2")).toBe("denied");
    expect(parseConsent("  repget_consent = 1.granted ")).toBe("granted");
  });

  it("treats anything else as no answer, so the banner asks", () => {
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("other=1.granted")).toBeNull();
    expect(parseConsent("repget_consent=0.granted")).toBeNull();
    expect(parseConsent("repget_consent=yes")).toBeNull();
    expect(parseConsent("xrepget_consent=1.granted")).toBeNull();
  });
});

describe("consentCookie", () => {
  it("is a first-party cookie for six months, Secure on HTTPS", () => {
    expect(consentCookie("granted", true)).toBe(`${CONSENT_COOKIE}=1.granted; Max-Age=15724800; Path=/; SameSite=Lax; Secure`);
    expect(consentCookie("denied", false)).toBe(`${CONSENT_COOKIE}=1.denied; Max-Age=15724800; Path=/; SameSite=Lax`);
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
