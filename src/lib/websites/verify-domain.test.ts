import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Competitor-domain verification must REFUSE a domain that resolves or points
  off the public internet - it used to count any failed request as "alive,
  registered, no response". DNS is mocked for both lookups (the existence
  check here and the connection lookup inside safeFetch), so nothing in this
  file reaches the network: every case below is refused before a connection.
*/
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";

import { keepLiveDomains, verifyDomain } from "./verify-domain";

const mockedLookup = vi.mocked(lookup);

/** Every name resolves to `address`, for both lookup shapes Node uses. */
function resolveEverythingTo(address: string) {
  mockedLookup.mockImplementation((async (_host: string, options?: { all?: boolean }) =>
    options?.all ? [{ address, family: 4 }] : { address, family: 4 }) as never);
}

beforeEach(() => {
  mockedLookup.mockReset();
});

describe("verifyDomain", () => {
  it("refuses a registered domain whose DNS points at a private address", async () => {
    resolveEverythingTo("10.0.0.7");
    const check = await verifyDomain("rival.example.com");
    expect(check).toEqual({ domain: "rival.example.com", alive: false, reason: "not a public website" });
  });

  it("refuses a domain that resolves to cloud metadata", async () => {
    resolveEverythingTo("169.254.169.254");
    expect((await verifyDomain("metadata-rival.com")).alive).toBe(false);
  });

  it("refuses localhost spellings before any connection", async () => {
    resolveEverythingTo("127.0.0.1");
    for (const domain of ["localhost", "localhost.", "app.localhost"]) {
      const check = await verifyDomain(domain);
      expect(check.alive, domain).toBe(false);
    }
  });

  it("still reports a name with no DNS record as invented", async () => {
    mockedLookup.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
    expect(await verifyDomain("never-registered-rival.com")).toEqual({
      domain: "never-registered-rival.com",
      alive: false,
      reason: "no DNS record",
    });
  });

  it("drops private destinations from the competitor list", async () => {
    resolveEverythingTo("192.168.1.20");
    const { live, dropped } = await keepLiveDomains(["a-rival.com", "b-rival.com"]);
    expect(live).toEqual([]);
    expect(dropped.map((d) => d.reason)).toEqual(["not a public website", "not a public website"]);
  });
});
