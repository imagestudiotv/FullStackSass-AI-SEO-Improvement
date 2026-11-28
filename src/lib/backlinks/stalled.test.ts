import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization } from "@/lib/db/auth-tables";
import { backlinkRequests, member, networkSites, notifications, placements, user, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Nothing stalls with credits held forever now that the Backlink Exchange is
 * opt-in and OFF for every existing website (eval 2026-11-28, R1).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { writeBacklinkExchange } from "@/lib/backlinks/exchange-switch";
import { matchWaitingRequests, releaseStalledRequests, returnLinksFromHostsSwitchedOff, WAIT_LIMIT_DAYS } from "@/lib/backlinks/stalled";
import { BACKLINK_EXCHANGE_COPY } from "@/lib/i18n/backlink-exchange";
import { format } from "@/lib/i18n/format";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from notifications;
    delete from placements;
    delete from backlink_requests;
    delete from credit_settings;
    delete from network_sites;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-12-01T07:00:00Z");

async function workspace(locale = "en") {
  const id = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id, name: id, slug: id, createdAt: NOW });
  const userId = `user_${id}`;
  await test.db.insert(user).values({ id: userId, name: id, email: `${id}@example.com`, locale, createdAt: NOW, updatedAt: NOW });
  await test.db.insert(member).values({ id: `m_${id}`, organizationId: id, userId, role: "owner", createdAt: NOW });
  return id;
}

async function site(orgId: string, options: { network?: boolean; exchange?: boolean } = {}) {
  const domain = `site-${randomUUID().slice(0, 6)}.test`;
  const [row] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  if (options.network) await test.db.insert(networkSites).values({ websiteId: row.id, acceptingLinks: true, monthlyCap: 10 });
  if (options.exchange !== undefined) await writeBacklinkExchange(row.id, options.exchange, null);
  return row;
}

async function request(websiteId: string, status: string, waitedDays: number, credits = 1) {
  const at = new Date(NOW.getTime() - waitedDays * DAY);
  const [row] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId, targetUrl: `https://example.test/${randomUUID().slice(0, 6)}`, status, creditsReserved: credits, createdAt: at, updatedAt: at })
    .returning();
  return row;
}

async function placement(requestId: string, hostWebsiteId: string, status: string, managed = false) {
  const [row] = await test.db.insert(placements).values({ requestId, hostWebsiteId, status, managed, credits: 1 }).returning();
  return row;
}

const requestRow = async (id: string) => (await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.id, id)))[0];
const placementsOf = (requestId: string) => test.db.select().from(placements).where(eq(placements.requestId, requestId));

describe("returnLinksFromHostsSwitchedOff", () => {
  it("takes back an automatic link not yet written on a host with the switch off, and its request waits again from now", async () => {
    const ben = await site(await workspace());
    const offHost = await site(await workspace(), { network: true });
    const onHost = await site(await workspace(), { network: true, exchange: true });

    const stuck = await request(ben.id, "matched", 40);
    await placement(stuck.id, offHost.id, "pending");
    const fine = await request(ben.id, "matched", 40);
    await placement(fine.id, onHost.id, "pending");
    const written = await request(ben.id, "matched", 40);
    await placement(written.id, offHost.id, "drafted");
    const team = await request(ben.id, "matched", 40);
    await placement(team.id, offHost.id, "pending", true);

    expect(await returnLinksFromHostsSwitchedOff(NOW)).toBe(1);

    expect(await placementsOf(stuck.id)).toHaveLength(0);
    expect(await requestRow(stuck.id)).toMatchObject({ status: "pending", creditsReserved: 1, updatedAt: NOW });
    // A host that is on, a link already in an article, and the RepGet team's own: untouched.
    expect(await placementsOf(fine.id)).toHaveLength(1);
    expect((await requestRow(fine.id)).status).toBe("matched");
    expect((await placementsOf(written.id))[0].status).toBe("drafted");
    expect((await placementsOf(team.id))[0].status).toBe("pending");
    expect((await requestRow(team.id)).status).toBe("matched");

    // Run again: nothing more to do.
    expect(await returnLinksFromHostsSwitchedOff(NOW)).toBe(0);
  });
});

describe("matchWaitingRequests", () => {
  it("matches nothing while no website has the exchange on", async () => {
    const ben = await site(await workspace());
    await site(await workspace(), { network: true, exchange: false });
    const waiting = await request(ben.id, "pending", 3);
    expect(await matchWaitingRequests(NOW)).toBe(0);
    expect((await requestRow(waiting.id)).status).toBe("pending");
  });

  it("gives a waiting request a host whose switch is on, never one that is off", async () => {
    const ben = await site(await workspace());
    await site(await workspace(), { network: true, exchange: false });
    const onHost = await site(await workspace(), { network: true, exchange: true });
    const waiting = await request(ben.id, "pending", 3, 2);

    expect(await matchWaitingRequests(NOW)).toBe(1);
    expect(await requestRow(waiting.id)).toMatchObject({ status: "matched", creditsReserved: 2, updatedAt: NOW });
    const [link] = await placementsOf(waiting.id);
    expect(link).toMatchObject({ hostWebsiteId: onHost.id, status: "pending", managed: false, credits: 2 });

    // Matched now: not waiting any more.
    expect(await matchWaitingRequests(NOW)).toBe(0);
  });
});

describe("releaseStalledRequests", () => {
  it(`closes a request that waited more than ${WAIT_LIMIT_DAYS} days, frees its hold and tells the workspace in its owner's language`, async () => {
    const benOrg = await workspace("es");
    const ben = await site(benOrg);
    const host = await site(await workspace(), { network: true });
    const old = await request(ben.id, "pending", WAIT_LIMIT_DAYS + 1, 1);
    const older = await request(ben.id, "pending", 90, 2);
    const recent = await request(ben.id, "pending", WAIT_LIMIT_DAYS - 1);
    // Not waiting for a host: a link not found yet (a recheck can revive it), the RepGet team's, a matched one.
    const unverified = await request(ben.id, "pending", 60);
    await placement(unverified.id, host.id, "unverified");
    const team = await request(ben.id, "pending", 60);
    await placement(team.id, host.id, "unverified", true);
    const matched = await request(ben.id, "matched", 60);
    await placement(matched.id, host.id, "pending");

    expect(await releaseStalledRequests(NOW)).toEqual({ requests: 2, credits: 3, workspaces: 1 });

    for (const id of [old.id, older.id]) {
      expect(await requestRow(id)).toMatchObject({ status: "cancelled", creditsReserved: 0, updatedAt: NOW });
    }
    for (const row of [recent, unverified, team]) expect(await requestRow(row.id)).toMatchObject({ status: "pending", creditsReserved: 1 });
    expect((await requestRow(matched.id)).status).toBe("matched");

    const notices = await test.db.select().from(notifications).where(eq(notifications.organizationId, benOrg));
    expect(notices).toHaveLength(1);
    const copy = BACKLINK_EXCHANGE_COPY.es;
    expect(notices[0]).toMatchObject({
      type: "backlink.released",
      title: format(copy.releasedTitle, { domain: ben.domain }),
      href: `/websites/${ben.id}/backlinks`,
    });
    expect(notices[0].body).toContain("2 solicitudes");
    expect(notices[0].body).toContain("(3)");
    expect(notices[0].body).toContain(`${WAIT_LIMIT_DAYS} días`);

    // Once only.
    expect(await releaseStalledRequests(NOW)).toEqual({ requests: 0, credits: 0, workspaces: 0 });
  });

  it("says one request in the singular", async () => {
    const benOrg = await workspace("en");
    const ben = await site(benOrg);
    await request(ben.id, "pending", 30);
    await releaseStalledRequests(NOW);
    const [notice] = await test.db.select().from(notifications).where(eq(notifications.organizationId, benOrg));
    expect(notice.body).toMatch(/^Your link request found no partner site/);
    expect(notice.body).toContain("(1)");
  });

  it("every language has both forms of the notice", () => {
    for (const copy of Object.values(BACKLINK_EXCHANGE_COPY)) {
      expect(copy.releasedTitle).toContain("{domain}");
      const forms = copy.releasedBody.split("|");
      expect(forms).toHaveLength(2);
      for (const form of forms) expect(form).toContain("{credits}");
      expect(forms[1]).toContain("{n}");
    }
  });
});
