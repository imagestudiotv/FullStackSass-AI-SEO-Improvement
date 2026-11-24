import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { CONNECT_POPUP_COPY } from "@/lib/i18n/connect-popup";

import { ConnectPopup } from "./connect-popup";
import { CONNECT_POPUP_QUIET_MS, connectPopupDismissed, dismissConnectPopup, offersConnect } from "./connect-popup-state";

/** The popup on an article of a website that is not connected (client, 2026-11-24). */

const base = { canEdit: true, destination: { kind: "none" } as const, status: "draft", hasBody: true };

afterEach(() => vi.unstubAllGlobals());

function storage() {
  const data = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } });
}

describe("when it is offered", () => {
  it("to someone who may connect a website that has no connection", () => {
    expect(offersConnect(base)).toBe(true);
    expect(offersConnect({ ...base, status: "published" })).toBe(true);
  });

  it("never to a viewer, never when connected, and not before there is an article to read", () => {
    expect(offersConnect({ ...base, canEdit: false })).toBe(false);
    expect(offersConnect({ ...base, destination: { kind: "plugin" } })).toBe(false);
    expect(offersConnect({ ...base, destination: { kind: "direct", name: "WordPress", provider: "wordpress", site: null } as never })).toBe(false);
    for (const status of ["queued", "generating", "failed"]) expect(offersConnect({ ...base, status })).toBe(false);
    expect(offersConnect({ ...base, hasBody: false })).toBe(false);
  });

  it("not again for this website for a while after Not now, and only for this website", () => {
    storage();
    const now = Date.now();
    expect(connectPopupDismissed("a", now)).toBe(false);
    dismissConnectPopup("a", now);
    expect(connectPopupDismissed("a", now + 1000)).toBe(true);
    expect(connectPopupDismissed("b", now + 1000)).toBe(false);
    expect(connectPopupDismissed("a", now + CONNECT_POPUP_QUIET_MS + 1)).toBe(false);
  });

  it("works without storage", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("blocked");
      },
    });
    expect(connectPopupDismissed("a")).toBe(false);
    expect(() => dismissConnectPopup("a")).not.toThrow();
  });
});

describe("the window", () => {
  it("renders nothing on the server", () => {
    expect(renderToStaticMarkup(createElement(ConnectPopup, { websiteId: "w", domain: "example.com", locale: "en" }))).toBe("");
  });

  it("says everything in every language, naming the website", () => {
    for (const locale of LOCALES) {
      const copy = CONNECT_POPUP_COPY[locale];
      for (const text of Object.values(copy)) expect(text.trim(), locale).toBeTruthy();
      expect(copy.body, locale).toContain("{domain}");
    }
  });
});
