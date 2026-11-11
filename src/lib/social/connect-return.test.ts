import { describe, expect, it } from "vitest";

import { CONNECTIONS_ANCHOR, connectReturnPath, isConnectNotice } from "./connect-return";

/** Where a connection comes back to (api/social/connected): the panel the next account is connected from. */
describe("connectReturnPath", () => {
  const site = "6f1c2f9e-3b1a-4c55-9b0e-2d7f1a9c4e11";

  it("lands on the Opportunities page at the Social connections panel, with the result for its toast", () => {
    expect(connectReturnPath(site, "social", { social: "connected", platform: "reddit" })).toBe(
      `/websites/${site}/social?social=connected&platform=reddit#${CONNECTIONS_ANCHOR}`,
    );
    expect(CONNECTIONS_ANCHOR).toBe("social-connections");
  });

  it("keeps the anchor without a result", () => {
    expect(connectReturnPath(site, "social", {})).toBe(`/websites/${site}/social#social-connections`);
  });

  it("sends a video platform back to the Videos page, as before", () => {
    expect(connectReturnPath(site, "videos", { social: "not_connected", platform: "tiktok" })).toBe(
      `/websites/${site}/videos?social=not_connected&platform=tiktok`,
    );
  });
});

describe("isConnectNotice", () => {
  it("knows the route's results and nothing else", () => {
    for (const value of ["connected", "not_connected", "connect_failed", "not_configured"]) expect(isConnectNotice(value)).toBe(true);
    for (const value of [null, "", "hacked", "Connected"]) expect(isConnectNotice(value)).toBe(false);
  });
});
