import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { member, organization, user } from "@/lib/db/auth-tables";
import { jobOutbox, networkSites, websites } from "@/lib/db/schema";
import { settingsForMode } from "@/lib/publishing/policy";
import { createTestDb, type TestDb } from "@/test/db";

import { NEW_SITE_DEFAULTS } from "./new-site-defaults";
import { applyOwnSite, OWN_SITE_SETTINGS, OWN_SITE_TRIGGERS, planOwnSite } from "./own-site-setup";

/**
 * RepGet's own website in its owner's dashboard (client, 2026-11-05), on a real
 * in-process database: dry by default, one record however often it runs, never a
 * guessed workspace, and settings that start no blog, publishing or link job.
 */

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
});

async function workspace(options: { name?: string; owner?: boolean } = {}) {
  const id = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id, name: options.name ?? `Workspace ${id}`, slug: id, createdAt: new Date() });
  if (options.owner !== false) {
    const userId = `user_${randomUUID()}`;
    await test.db.insert(user).values({ id: userId, name: "Owner", email: `${userId}@example.test`, createdAt: new Date(), updatedAt: new Date() });
    await test.db.insert(member).values({ id: `member_${randomUUID()}`, organizationId: id, userId, role: "owner", createdAt: new Date() });
  }
  return id;
}

/** Another domain per test, so tests in one database never see each other's site. */
const address = () => `https://www.own-${randomUUID().slice(0, 8)}.example`;
const rowsFor = (domain: string) => test.db.select().from(websites).where(eq(websites.domain, domain));

describe("the setup", () => {
  it("writes nothing on a dry run", async () => {
    const id = await workspace();
    const url = address();
    const plan = await planOwnSite(test.db, { workspace: id, address: url });
    expect(plan).toMatchObject({ action: "create", websiteId: null, workspace: { id } });
    if (plan.action === "refuse") throw new Error(plan.reason);
    expect(await rowsFor(plan.domain)).toEqual([]);
  });

  it("uses normal validation, stores what addWebsite stores, and keeps the site from writing, publishing or swapping links", async () => {
    const id = await workspace();
    const url = address();
    const plan = await applyOwnSite(test.db, { workspace: id, address: url });
    if (plan.action === "refuse") throw new Error(plan.reason);
    expect(plan.domain).toBe(url.replace("https://www.", ""));
    expect(plan.url).toBe(url.replace("www.", ""));

    const [site] = await rowsFor(plan.domain);
    expect(site).toMatchObject({
      organizationId: id,
      status: "pending",
      generationMode: "manual",
      autoPublish: false,
      publishAs: "live",
      // The rest of the normal defaults.
      tableOfContents: NEW_SITE_DEFAULTS.tableOfContents,
      poweredByLink: NEW_SITE_DEFAULTS.poweredByLink,
    });
    // "Review" in the publishing settings: nothing goes out by itself.
    expect({ autoPublish: OWN_SITE_SETTINGS.autoPublish, publishAs: OWN_SITE_SETTINGS.publishAs }).toEqual(settingsForMode("review"));

    const [network] = await test.db.select().from(networkSites).where(eq(networkSites.websiteId, site.id));
    expect(network.acceptingLinks).toBe(false);

    // The normal analysis, and only that.
    const jobs = await test.db.select().from(jobOutbox).where(eq(jobOutbox.eventId, `website-analyze:own-site:${site.id}`));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ name: "website/analyze.requested", status: "pending", data: { websiteId: site.id, organizationId: id, reservations: [] } });
  });

  it("does not duplicate: a second run finds it and changes nothing, with www or without", async () => {
    const id = await workspace();
    const url = address();
    const first = await applyOwnSite(test.db, { workspace: id, address: url });
    if (first.action === "refuse") throw new Error(first.reason);
    const again = await applyOwnSite(test.db, { workspace: id, address: url.replace("www.", "") });
    expect(again).toMatchObject({ action: "nothing", websiteId: first.websiteId, changes: [] });
    expect(await rowsFor(first.domain)).toHaveLength(1);
    expect(await planOwnSite(test.db, { workspace: id, address: url })).toMatchObject({ action: "nothing" });
  });

  it("two runs at once still make one", async () => {
    const id = await workspace();
    const url = address();
    const results = await Promise.all([applyOwnSite(test.db, { workspace: id, address: url }), applyOwnSite(test.db, { workspace: id, address: url })]);
    expect(results.map((result) => result.action).sort()).toEqual(["create", "nothing"]);
    const plan = results[0];
    if (plan.action === "refuse") throw new Error(plan.reason);
    expect(await rowsFor(plan.domain)).toHaveLength(1);
  });

  it("brings an existing record to the safe settings on --apply only, saying what changes, and adds no job", async () => {
    const id = await workspace();
    const url = address();
    const domain = url.replace("https://www.", "");
    const [site] = await test.db.insert(websites).values({ organizationId: id, url: `https://${domain}`, domain, status: "ready", autoPublish: true, generationMode: "automatic" }).returning();
    await test.db.insert(networkSites).values({ websiteId: site.id, acceptingLinks: true, monthlyCap: 3 });

    const plan = await planOwnSite(test.db, { workspace: id, address: url });
    if (plan.action === "refuse") throw new Error(plan.reason);
    expect(plan.action).toBe("update");
    expect(plan.changes).toEqual([
      { field: "generationMode", from: "automatic", to: "manual" },
      { field: "autoPublish", from: true, to: false },
      { field: "network.acceptingLinks", from: true, to: false },
    ]);
    expect((await rowsFor(domain))[0].generationMode).toBe("automatic");

    await applyOwnSite(test.db, { workspace: id, address: url });
    const [after] = await rowsFor(domain);
    expect(after).toMatchObject({ id: site.id, generationMode: "manual", autoPublish: false, status: "ready" });
    const [network] = await test.db.select().from(networkSites).where(eq(networkSites.websiteId, site.id));
    expect(network.acceptingLinks).toBe(false);
    expect(await test.db.select().from(jobOutbox).where(eq(jobOutbox.eventId, `website-analyze:own-site:${site.id}`))).toEqual([]);
  });

  it.each([[undefined], [""], ["   "]])("refuses without a workspace: %j", async (named) => {
    expect(await applyOwnSite(test.db, { workspace: named, address: address() })).toMatchObject({ action: "refuse", reason: expect.stringContaining("Name the owner workspace") });
  });

  it("refuses a workspace that does not exist, an ambiguous one and one with no owner: never a guess", async () => {
    expect(await applyOwnSite(test.db, { workspace: "org_nobody", address: address() })).toMatchObject({ action: "refuse", reason: expect.stringContaining("No workspace") });
    const name = `Same name ${randomUUID()}`;
    await workspace({ name });
    await workspace({ name: name.toUpperCase() });
    expect(await applyOwnSite(test.db, { workspace: name, address: address() })).toMatchObject({ action: "refuse", reason: expect.stringContaining("matches 2 workspaces") });
    const ownerless = await workspace({ owner: false });
    expect(await applyOwnSite(test.db, { workspace: ownerless, address: address() })).toMatchObject({ action: "refuse", reason: expect.stringContaining("no owner") });
  });

  it("refuses when the site is already in another workspace, and writes nothing", async () => {
    const owner = await workspace();
    const other = await workspace();
    const url = address();
    const first = await applyOwnSite(test.db, { workspace: owner, address: url });
    if (first.action === "refuse") throw new Error(first.reason);
    expect(await applyOwnSite(test.db, { workspace: other, address: url })).toMatchObject({ action: "refuse", reason: expect.stringContaining("another workspace") });
    expect(await test.db.select().from(websites).where(and(eq(websites.organizationId, other), eq(websites.domain, first.domain)))).toEqual([]);
  });

  it("refuses an address normal validation refuses", async () => {
    const id = await workspace();
    await expect(planOwnSite(test.db, { workspace: id, address: "http://localhost:3000" })).rejects.toThrow("not a public website");
  });

  it("says what a new website sets off", () => {
    const named = OWN_SITE_TRIGGERS.map((trigger) => trigger.what).join(" ");
    for (const job of ["website/analyze.requested", "activate-exchange", "scheduled-articles", "blog autopilot", "site-inventory", "collect-authority", "social-suggestions-daily"]) expect(named).toContain(job);
  });
});
