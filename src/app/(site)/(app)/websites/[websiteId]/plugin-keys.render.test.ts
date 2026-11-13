import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CONNECT_KEY_LABEL, MANUAL_KEY_LABEL } from "@/lib/plugin/connect-label";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The WordPress card's first render in each starting state: what a customer
 * sees before pressing anything, or on returning while a connection is under
 * way. What happens after a click is the wait's logic, tested sequence by
 * sequence in lib/plugin/connect-watch.test.ts.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/plugin/actions", () => ({
  connectWordPress: vi.fn(),
  generateIntegrationKey: vi.fn(),
  revokeKey: vi.fn(),
}));

import { PluginKeys } from "./plugin-keys";

const t = getMessages("en").app.keys;
const tCommon = getMessages("en").app.common;
const context = { domain: "imagestudio.com", workspaceName: "Photo Booth Studio", alsoIn: [] as string[] };

type Key = Parameters<typeof PluginKeys>[0]["keys"][number];
const key = (over: Partial<Key>): Key => ({
  id: "k1",
  keyPrefix: "seo_AbCdEfGh",
  label: null,
  lastUsedAt: null,
  siteInfo: null,
  createdAt: new Date("2026-09-29T10:00:00Z"),
  pending: false,
  ...over,
});

function render(props: Partial<Parameters<typeof PluginKeys>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PluginKeys, {
      websiteId: "w1",
      siteUrl: "https://imagestudio.com",
      keys: [],
      canEdit: true,
      context,
      locale: "en",
      t,
      tCommon,
      ...props,
    }),
  );
}

describe("the WordPress card", () => {
  it("first visit: two steps, the Connect WordPress button, the workspace named - and no key made or shown", () => {
    const html = render();
    expect(html).toContain(t.stepInstall);
    expect(html).toContain(t.stepConnect);
    expect(html).toContain(t.connectButton);
    expect(html).toContain("Connecting imagestudio.com in workspace “Photo Booth Studio”.");
    expect(html).toContain("https://imagestudio.com/wp-admin/plugin-install.php?tab=upload");
    expect(html).not.toContain("seo_");
    expect(html).not.toContain(t.connectedTitle);
  });

  it("connected: green, with the site's report, and Connect again instead of Connect WordPress", () => {
    const html = render({
      keys: [key({ label: CONNECT_KEY_LABEL, lastUsedAt: new Date("2026-09-29T11:00:00Z"), siteInfo: "https://imagestudio.com · WP 7.1.2 · plugin 1.6.0" })],
    });
    expect(html).toContain(`${t.connectedTitle} · https://imagestudio.com · WP 7.1.2 · plugin 1.6.0`);
    expect(html).toContain(t.reconnectButton);
    expect(html).not.toContain(`>${t.connectButton}<`);
    // The button's own label, translated - never the internal marker.
    expect(html).toContain(t.madeByConnect);
    expect(html).not.toContain(`>${CONNECT_KEY_LABEL} ·`);
  });

  it("a key made long ago and never used is listed as such, under Keys (advanced) - no dead-end notice", () => {
    const html = render({ keys: [key({})] });
    expect(html).toContain(t.advancedTitle);
    expect(html).toContain(t.neverUsed);
    expect(html).toContain(t.connectButton);
    expect(html).not.toContain("shown only once");
  });

  it("keys a person made by hand are labelled as such, and the key WordPress uses is marked", () => {
    const html = render({
      keys: [
        key({ id: "k2", keyPrefix: "seo_Manual01", label: MANUAL_KEY_LABEL }),
        key({ id: "k3", keyPrefix: "seo_InUse001", label: CONNECT_KEY_LABEL, lastUsedAt: new Date("2026-09-29T11:00:00Z") }),
      ],
    });
    expect(html).toContain(`${t.madeByHand} · ${t.neverUsed}`);
    expect(html).toMatch(new RegExp(`seo_InUse001<span[^>]*>…</span><span[^>]*>${t.connectedTitle}</span>`));
  });

  it("after a reload with a connection under way, the card is already waiting - it does not start over", () => {
    const html = render({ keys: [key({ label: CONNECT_KEY_LABEL, pending: true })] });
    expect(html).toContain(t.waitingTitle);
    expect(html).toContain(t.waitingResumed);
    expect(html).toContain(t.connectButton);
    // No key to show: its plaintext only ever lived in the tab that made it.
    expect(html).not.toContain(t.copyInstead);
    // A viewer is never put in a waiting state.
    expect(render({ canEdit: false, keys: [key({ label: CONNECT_KEY_LABEL, pending: true })] })).not.toContain(t.waitingTitle);
  });

  it("the same domain in another of the person's workspaces is named", () => {
    const html = render({ context: { ...context, alsoIn: ["Test Account"] } });
    expect(html).toContain("You also have imagestudio.com in “Test Account”.");
  });

  it("a viewer sees the status, and nothing to press", () => {
    const html = render({ canEdit: false, keys: [key({ lastUsedAt: new Date("2026-09-29T11:00:00Z") })] });
    expect(html).toContain(t.connectedTitle);
    expect(html).not.toContain(t.connectButton);
    expect(html).not.toContain(t.reconnectButton);
    expect(html).not.toContain(`${tCommon.revoke}</button>`);
    expect(html).not.toContain(t.newKey);
  });

  it("every language has every new line", () => {
    for (const locale of ["en", "es", "fr", "it", "de"] as const) {
      const keys = getMessages(locale).app.keys;
      for (const name of ["connectButton", "waitingHelp", "stalledHelp", "alsoIn", "madeByConnect", "advancedTitle"] as const) {
        expect(keys[name], `${locale}.${name}`).toBeTruthy();
      }
      expect(keys.connectingIn).toContain("{domain}");
      expect(keys.alsoIn).toContain("{workspaces}");
    }
  });
});
