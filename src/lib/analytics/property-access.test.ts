import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * Google properties are a website owner's (or the connector's) to choose -
 * not anyone's who can read or edit the RepGet website.
 *
 * Reproduced first: an invited VIEWER could list every Search Console site
 * and GA4 property in the owner's Google account (an agency's, with all its
 * clients), and an invited EDITOR could save another client's property, which
 * the next import pulled into this website. See lib/analytics/property-access.ts.
 *
 * Real tenant checks (requireWebsite / requireEditor on PGlite, sessions
 * mocked) and the real import function; Google itself is mocked.
 */

process.env.CREDENTIALS_ENCRYPTION_KEY = "property-access-test-key-0123456789abcdefghij";

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => state.session,
  requireSession: async () => state.session,
}));
vi.mock("@/lib/auth", () => ({
  ensureOrganization: async () => {
    throw new Error("ensureOrganization should not be reached");
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ queueJob: vi.fn() }));
vi.mock("@/inngest/send", () => queue);
const inngestMock = vi.hoisted(() => ({ createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/usage", () => ({ PRICING: new Proxy({}, { get: () => 0 }), track: vi.fn() }));

// The agency's Google account: this client's properties AND another client's.
const ACCOUNT = {
  searchConsole: [
    { siteUrl: "sc-domain:client-a.example", permissionLevel: "siteOwner" },
    { siteUrl: "sc-domain:client-b.example", permissionLevel: "siteOwner" },
  ],
  analytics: [
    { name: "properties/111", displayName: "Client A" },
    { name: "properties/222", displayName: "Client B (another client)" },
  ],
};
const google = vi.hoisted(() => ({
  listSearchConsoleSites: vi.fn(),
  listAnalyticsProperties: vi.fn(),
  fetchSearchPageDaily: vi.fn(),
  fetchSearchDailyTotals: vi.fn(),
  fetchSearchAnalytics: vi.fn(),
  fetchAnalyticsDailyTotals: vi.fn(),
  fetchAnalyticsReport: vi.fn(),
}));
vi.mock("@/lib/analytics/google-api", async (original) => ({ ...(await original<object>()), ...google }));
vi.mock("@/lib/analytics/google-oauth", async (original) => ({
  ...(await original<object>()),
  isGoogleConfigured: () => true,
  authorizeUrl: () => "https://accounts.google.example/consent",
  refreshAccessToken: vi.fn(),
}));

import { importAnalytics } from "@/inngest/functions/import-analytics";
import { integrations, member, organization, user, websiteMembers, websites } from "@/lib/db/schema";
import { WebsiteNotFoundError } from "@/lib/tenant";

import {
  disconnectGoogle,
  getAnalyticsConnection,
  listProperties,
  selectProperties,
  startGoogleConnect,
  startImport,
} from "./actions";
import { saveTokens, type GoogleMeta } from "./connection";

const CANNOT_MANAGE =
  "Only the website's owner, or the person who connected this Google account, can see and choose its properties.";
const CANNOT_REPLACE =
  "This Google connection belongs to the website's owner. Only the owner can disconnect it or connect a different account.";
const VIEW_ONLY = "You have view-only access to this website.";

const people = {
  owner: { userId: "u_pa_owner", orgId: "org_pa_agency" },
  editor: { userId: "u_pa_editor", orgId: "org_pa_editor" },
  viewer: { userId: "u_pa_viewer", orgId: "org_pa_viewer" },
  stranger: { userId: "u_pa_stranger", orgId: "org_pa_stranger" },
};
type Who = keyof typeof people;

function as(who: Who) {
  const p = people[who];
  state.session = {
    user: { id: p.userId, name: who, email: `${who}@pa.example` },
    session: { id: `s_${p.userId}`, activeOrganizationId: p.orgId },
  };
}

const tokens = () => ({
  accessToken: "access-token-not-real",
  refreshToken: "refresh-token-not-real",
  expiresAt: new Date(Date.now() + 3_600_000),
  scope: "analytics.readonly webmasters.readonly",
});

let test: TestDb;
let site: string;

async function meta(websiteId = site): Promise<GoogleMeta> {
  const [row] = await test.db.select({ meta: integrations.meta }).from(integrations).where(eq(integrations.websiteId, websiteId));
  return row.meta as GoogleMeta;
}

async function setMeta(next: GoogleMeta, websiteId = site) {
  await test.db.update(integrations).set({ meta: next }).where(eq(integrations.websiteId, websiteId));
}

async function connect(who: "owner" | "editor", websiteId = site) {
  await saveTokens(websiteId, tokens(), {}, {
    connectedBy: { userId: people[who].userId, access: who === "owner" ? "owner" : "editor", at: new Date().toISOString() },
  });
}

/** Runs the real import function, step by step, the way Inngest would. */
async function runImport(websiteId = site) {
  const handler = (importAnalytics as unknown as { handler: (ctx: unknown) => Promise<{ searchConsole?: unknown; analytics?: unknown }> }).handler;
  const results: Record<string, unknown> = {};
  const step = {
    run: async (id: string, fn: () => unknown) => {
      results[id] = await fn();
      return results[id];
    },
    sendEvent: vi.fn(),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  await handler({ event: { data: { websiteId, organizationId: people.owner.orgId } }, step, logger });
  return results as { "import-search-console": { skipped: string | null }; "import-analytics": { skipped: string | null } };
}

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const now = new Date();
  for (const [who, p] of Object.entries(people)) {
    await test.db.insert(organization).values({ id: p.orgId, name: `${who} workspace`, slug: p.orgId, createdAt: now });
    await test.db.insert(user).values({ id: p.userId, name: who, email: `${who}@pa.example`, createdAt: now, updatedAt: now });
    await test.db.insert(member).values({ id: `m_${p.userId}`, organizationId: p.orgId, userId: p.userId, role: "owner", createdAt: now });
  }
});

beforeEach(async () => {
  vi.clearAllMocks();
  google.listSearchConsoleSites.mockResolvedValue(ACCOUNT.searchConsole);
  google.listAnalyticsProperties.mockResolvedValue(ACCOUNT.analytics);
  for (const fn of [google.fetchSearchPageDaily, google.fetchSearchDailyTotals, google.fetchSearchAnalytics, google.fetchAnalyticsDailyTotals, google.fetchAnalyticsReport]) {
    fn.mockResolvedValue([]);
  }
  // A fresh client website for every test, owned by the agency, with one invited editor and one viewer.
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId: people.owner.orgId, url: "https://client-a.example", domain: "client-a.example", status: "ready" })
    .returning({ id: websites.id });
  site = row.id;
  await test.db.insert(websiteMembers).values([
    { websiteId: site, userId: people.editor.userId, role: "editor" },
    { websiteId: site, userId: people.viewer.userId, role: "viewer" },
  ]);
});

describe("the owner of the connection", () => {
  it("lists the account and approves this website's properties", async () => {
    await connect("owner");
    as("owner");
    const listed = await listProperties(site);
    expect(listed.ok && listed.data.analytics.map((p) => p.name)).toEqual(["properties/111", "properties/222"]);

    expect(await selectProperties(site, { searchConsoleSite: "sc-domain:client-a.example", analyticsProperty: "properties/111" })).toEqual({ ok: true, data: null });
    const stored = await meta();
    expect(stored.approval).toMatchObject({
      searchConsoleSite: "sc-domain:client-a.example",
      analyticsProperty: "properties/111",
      approvedBy: people.owner.userId,
      connection: people.owner.userId,
    });
    expect(await getAnalyticsConnection(site)).toMatchObject({ canManageProperties: true, canReplaceConnection: true, needsApproval: false });

    const run = await runImport();
    expect(run["import-search-console"].skipped).toBeNull();
    expect(run["import-analytics"].skipped).toBeNull();
    expect(google.fetchAnalyticsReport).toHaveBeenCalledWith(expect.any(String), "properties/111", expect.any(String), expect.any(String));
  });
});

describe("an invited editor", () => {
  beforeEach(async () => {
    await connect("owner");
    as("owner");
    await selectProperties(site, { searchConsoleSite: "sc-domain:client-a.example", analyticsProperty: "properties/111" });
    vi.clearAllMocks();
    google.listSearchConsoleSites.mockResolvedValue(ACCOUNT.searchConsole);
    google.listAnalyticsProperties.mockResolvedValue(ACCOUNT.analytics);
    as("editor");
  });

  it("cannot browse the owner's Google account", async () => {
    expect(await listProperties(site)).toEqual({ ok: false, error: CANNOT_MANAGE });
    expect(google.listSearchConsoleSites).not.toHaveBeenCalled();
    expect(google.listAnalyticsProperties).not.toHaveBeenCalled();
  });

  it("cannot point this website at another client's property", async () => {
    expect(await selectProperties(site, { analyticsProperty: "properties/222" })).toEqual({ ok: false, error: CANNOT_MANAGE });
    expect((await meta()).analyticsProperty).toBe("properties/111");
  });

  it("cannot replace or disconnect the owner's connection", async () => {
    expect(await startGoogleConnect(site)).toEqual({ ok: false, error: CANNOT_REPLACE });
    expect(await disconnectGoogle(site)).toEqual({ ok: false, error: CANNOT_REPLACE });
    expect((await meta()).connectedBy?.userId).toBe(people.owner.userId);
  });

  it("still sees the connection, and may run the import of what the owner approved", async () => {
    expect(await getAnalyticsConnection(site)).toMatchObject({
      analyticsProperty: "properties/111",
      canManageProperties: false,
      canReplaceConnection: false,
    });
    expect(await startImport(site)).toEqual({ ok: true, data: null });
  });
});

describe("an invited viewer", () => {
  it("gets neither the list nor any control", async () => {
    await connect("owner");
    as("viewer");
    expect(await listProperties(site)).toEqual({ ok: false, error: CANNOT_MANAGE });
    expect(await selectProperties(site, { analyticsProperty: "properties/222" })).toEqual({ ok: false, error: VIEW_ONLY });
    expect(await getAnalyticsConnection(site)).toMatchObject({ canManageProperties: false, canReplaceConnection: false });
    expect(google.listAnalyticsProperties).not.toHaveBeenCalled();
  });
});

describe("an unrelated tenant", () => {
  it("cannot reach the website at all", async () => {
    await connect("owner");
    as("stranger");
    await expect(listProperties(site)).rejects.toBeInstanceOf(WebsiteNotFoundError);
    await expect(selectProperties(site, { analyticsProperty: "properties/222" })).rejects.toBeInstanceOf(WebsiteNotFoundError);
    expect(google.listAnalyticsProperties).not.toHaveBeenCalled();
  });
});

describe("property identifiers", () => {
  beforeEach(async () => {
    await connect("owner");
    as("owner");
  });

  it("refuses malformed ids before asking Google", async () => {
    expect(await selectProperties(site, { searchConsoleSite: "javascript:alert(1)" })).toEqual({ ok: false, error: "That is not a Search Console property" });
    expect(await selectProperties(site, { analyticsProperty: "properties/../accounts/9" })).toEqual({ ok: false, error: "That is not a Google Analytics property" });
    expect(google.listAnalyticsProperties).not.toHaveBeenCalled();
  });

  it("refuses a well-formed id the connected account cannot read", async () => {
    expect(await selectProperties(site, { analyticsProperty: "properties/999" })).toEqual({
      ok: false,
      error: "The connected Google account cannot read that Analytics property",
    });
    expect(await selectProperties(site, { searchConsoleSite: "sc-domain:not-ours.example" })).toEqual({
      ok: false,
      error: "The connected Google account cannot read that Search Console property",
    });
    expect((await meta()).approval ?? null).toBeNull();
  });
});

describe("the import", () => {
  beforeEach(async () => {
    await connect("owner");
    as("owner");
    await selectProperties(site, { searchConsoleSite: "sc-domain:client-a.example", analyticsProperty: "properties/111" });
    vi.clearAllMocks();
    google.listSearchConsoleSites.mockResolvedValue(ACCOUNT.searchConsole);
    google.listAnalyticsProperties.mockResolvedValue(ACCOUNT.analytics);
  });

  it("never fetches another client's property written into the metadata (queued or modified)", async () => {
    await setMeta({ ...(await meta()), analyticsProperty: "properties/222" });
    const run = await runImport();
    expect(run["import-analytics"].skipped).toBe("unapproved");
    expect(google.fetchAnalyticsReport).not.toHaveBeenCalled();
    expect(google.fetchAnalyticsDailyTotals).not.toHaveBeenCalled();
    // The approved Search Console property still imports.
    expect(run["import-search-console"].skipped).toBeNull();
  });

  it("drops a binding approved on another connection (stale)", async () => {
    // As if the owner disconnected and the editor then connected their own account.
    await connect("editor");
    expect(await meta()).toMatchObject({ searchConsoleSite: null, analyticsProperty: null, approval: null });
    // And a hand-made stale record - an old approval left on a newer connection - imports nothing either.
    await setMeta({ ...(await meta()), analyticsProperty: "properties/111", approval: { searchConsoleSite: null, analyticsProperty: "properties/111", approvedBy: people.owner.userId, approvedAt: new Date().toISOString(), connection: people.owner.userId } });
    const run = await runImport();
    expect(run["import-analytics"].skipped).toBe("unapproved");
    expect(google.fetchAnalyticsReport).not.toHaveBeenCalled();
  });

  it("stops fetching an approved property the account can no longer read", async () => {
    google.listAnalyticsProperties.mockResolvedValue([ACCOUNT.analytics[1]]);
    const run = await runImport();
    expect(run["import-analytics"].skipped).toBe("forbidden");
    expect(google.fetchAnalyticsReport).not.toHaveBeenCalled();
  });
});

describe("a guest who connected their own Google account", () => {
  it("manages its properties; the owner may replace the connection but not browse the guest's account", async () => {
    await connect("editor");
    as("editor");
    expect((await listProperties(site)).ok).toBe(true);
    expect(await selectProperties(site, { analyticsProperty: "properties/111" })).toEqual({ ok: true, data: null });

    as("owner");
    expect(await listProperties(site)).toEqual({ ok: false, error: CANNOT_MANAGE });
    expect(await getAnalyticsConnection(site)).toMatchObject({ canManageProperties: false, canReplaceConnection: true });
    expect(await disconnectGoogle(site)).toEqual({ ok: true, data: null });
  });
});

describe("connections made before approvals were recorded", () => {
  beforeEach(async () => {
    // A legacy row: tokens and a choice, but no connector and no approval.
    await saveTokens(site, tokens(), { searchConsoleSite: "sc-domain:client-a.example", analyticsProperty: "properties/111" });
  });

  it("keep importing their choice, and ask the owner to confirm it", async () => {
    as("owner");
    expect(await getAnalyticsConnection(site)).toMatchObject({ needsApproval: true, canManageProperties: true });
    const run = await runImport();
    expect(run["import-analytics"].skipped).toBeNull();
    expect(await selectProperties(site, { searchConsoleSite: "sc-domain:client-a.example", analyticsProperty: "properties/111" })).toEqual({ ok: true, data: null });
    expect(await getAnalyticsConnection(site)).toMatchObject({ needsApproval: false });
  });

  it("are the owner's: a guest editor cannot manage or replace them", async () => {
    as("editor");
    expect(await listProperties(site)).toEqual({ ok: false, error: CANNOT_MANAGE });
    expect(await startGoogleConnect(site)).toEqual({ ok: false, error: CANNOT_REPLACE });
  });

  it("keep the choice visible but unapproved when the owner reconnects", async () => {
    await connect("owner");
    const stored = await meta();
    expect(stored).toMatchObject({ analyticsProperty: "properties/111", approval: null });
    const run = await runImport();
    expect(run["import-analytics"].skipped).toBe("unapproved");
  });

});
