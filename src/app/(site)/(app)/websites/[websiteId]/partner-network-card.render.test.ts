import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The Partner Network card before the website is connected (Daniel,
 * 2026-11-24): how to join, and every setting off and disabled. The actions'
 * own refusal is tested on the database (lib/backlinks/managed-network.test.ts).
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/backlinks/network-settings", () => ({
  addTarget: vi.fn(),
  moveTarget: vi.fn(),
  removeTarget: vi.fn(),
  setMinSourceRank: vi.fn(),
  setParticipation: vi.fn(),
  setBacklinkExchange: vi.fn(),
  setTargetPriority: vi.fn(),
}));

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { PARTNER_NETWORK_CONNECT } from "@/lib/i18n/partner-network-connect";
import { BACKLINK_EXCHANGE_COPY } from "@/lib/i18n/backlink-exchange";

import { PartnerNetworkCard } from "./partner-network-card";

const SITE = "11111111-1111-4111-8111-111111111111";
const NETWORK = {
  connected: true,
  participating: true,
  exchange: false,
  monthlyCap: 3,
  targets: [{ id: "t1", url: "https://acme.test/a/", note: null, priority: "high", position: 0 }],
  inReview: 0,
  commitments: 0,
  minSourceRank: null,
  maxMinSourceRank: 60,
  authority: "available" as const,
};

function render(network: object, options: { canEdit?: boolean; locale?: (typeof LOCALES)[number] } = {}) {
  const locale = options.locale ?? "en";
  return renderToStaticMarkup(
    createElement(PartnerNetworkCard, {
      websiteId: SITE,
      network: { ...NETWORK, ...network },
      credits: { available: 248, reserved: 0 },
      canEdit: options.canEdit ?? true,
      t: getMessages(locale).app.partnerNetwork,
      connectText: PARTNER_NETWORK_CONNECT[locale],
      exchangeText: BACKLINK_EXCHANGE_COPY[locale],
    }),
  );
}

const controls = (html: string) => html.match(/<(button|input|select)\b[^>]*>/g) ?? [];

describe("PartnerNetworkCard", () => {
  it("not connected: says so, leads to Integrations, and turns every setting off", () => {
    const html = render({ connected: false, participating: false });
    expect(html).toContain("Not connected");
    expect(html).toContain("How it works");
    expect(html).toContain("Connect your website to join the Partner Network");
    expect(html).toContain("Not available yet");
    // Both the button and "How it works".
    expect(html.match(new RegExp(`href="/websites/${SITE}/integrations"`, "g"))).toHaveLength(2);
    expect(html).toContain('aria-checked="false"');
    // Nothing on the card can be changed: every control is disabled.
    expect(controls(html).length).toBeGreaterThan(5);
    for (const control of controls(html)) expect(control, control).toMatch(/\bdisabled/);
  });

  it("not connected, for a viewer: no button they cannot use, and who can", () => {
    const html = render({ connected: false, participating: false }, { canEdit: false });
    expect(html).toContain("Ask the website&#x27;s owner to connect it.");
    // Only "How it works" leads to Integrations.
    expect(html.split(`/websites/${SITE}/integrations`)).toHaveLength(2);
  });

  it("connected: as before", () => {
    const html = render({});
    expect(html).not.toContain("Not connected");
    expect(html).not.toContain("How it works");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Enabled");
    expect(html).not.toContain("/integrations");
  });

  it("the Backlink Exchange: a switch, OFF by default, with the risk said - in every language", () => {
    for (const locale of LOCALES) {
      const copy = BACKLINK_EXCHANGE_COPY[locale];
      const html = render({}, { locale });
      const box = html.slice(html.indexOf('data-testid="backlink-exchange"'));
      expect(box).toMatch(/role="switch" aria-checked="false" aria-labelledby="pn-exchange"/);
      expect(html).toContain(copy.whenOff.replace(/'/g, "&#x27;"));
      expect(html).toContain(copy.risk.replace(/'/g, "&#x27;"));
      // The old promise is gone: never "you never have to approve each link".
      expect(html).not.toContain("approve each link");
    }
    const on = render({ exchange: true });
    expect(on).toContain(BACKLINK_EXCHANGE_COPY.en.whenOn);
    // Not in the network: the switch waits for it.
    const out = render({ participating: false });
    expect(out).toContain(BACKLINK_EXCHANGE_COPY.en.needsParticipation);
  });

  it("says it in every language", () => {
    for (const locale of LOCALES) {
      const html = render({ connected: false, participating: false }, { locale });
      expect(html).toContain(PARTNER_NETWORK_CONNECT[locale].notConnected);
      expect(html).toContain(PARTNER_NETWORK_CONNECT[locale].stepJoin);
    }
  });
});
