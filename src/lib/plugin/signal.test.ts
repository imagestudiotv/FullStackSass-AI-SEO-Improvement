import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Telling a WordPress site at once that its key was revoked
 * (signalRevokedKey): one signed check-now to the address the site reported,
 * signed with the REVOKED key's hash - the only key that site will accept.
 */

const net = vi.hoisted(() => ({ calls: [] as Array<{ url: string; body: string; redirect?: string }>, reply: null as Response | null }));
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: vi.fn(async (url: string, init: { body: string; redirect?: string }) => {
    net.calls.push({ url, body: init.body, redirect: init.redirect });
    if (!net.reply) throw new Error("connection refused");
    return net.reply;
  }),
}));

import { signalRevokedKey } from "./sync";

beforeEach(() => {
  net.calls = [];
  net.reply = new Response('{"success":false,"data":{"error":"invalid_key"}}', { status: 200 });
});

describe("signalRevokedKey", () => {
  const endpoint = { keyHash: "a".repeat(64), syncUrl: "https://imagestudio.test/wp-admin/admin-ajax.php" };

  it("posts one check-now to the reported address, signed with the revoked key's hash, never following redirects", async () => {
    expect(await signalRevokedKey(endpoint)).toBe(true);
    expect(net.calls).toHaveLength(1);
    const [call] = net.calls;
    expect(call.url).toBe(endpoint.syncUrl);
    expect(call.redirect).toBe("error");
    const form = new URLSearchParams(call.body);
    expect(form.get("action")).toBe("repget_sync");
    const ts = form.get("ts")!;
    expect(Math.abs(Number(ts) - Date.now() / 1000)).toBeLessThan(5);
    expect(form.get("sig")).toBe(createHmac("sha256", endpoint.keyHash).update(ts).digest("hex"));
  });

  it("reports whether the site answered at all, and never throws", async () => {
    net.reply = null;
    await expect(signalRevokedKey(endpoint)).resolves.toBe(false);
  });
});
