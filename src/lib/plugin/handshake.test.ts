import { createHash, randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * One-click connect for plugin 1.7.0 (docs/wordpress-connect.md): the key
 * travels once, server to server; the browser carries a request id, a
 * one-time code and the plugin's state, none of which works alone.
 *
 * WHY. On 2026-09-29 a client's WordPress said "Connected" while holding a
 * key from a second RepGet account for the same domain. With the handshake
 * nobody copies a key, the page says which account and website WordPress is
 * joining, and moving a site retires the old account's key - only once the
 * new key works.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  after: [] as Array<() => unknown>,
  signalled: [] as Array<{ keyHash: string; syncUrl: string }>,
  /** The host the connect page is requested on. */
  host: "www.repget.com",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: state.host }) }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void state.after.push(task),
}));
vi.mock("@/lib/plugin/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plugin/sync")>()),
  nudgePluginIfDue: vi.fn(async () => "nothing-due"),
  signalRevokedKey: vi.fn(async (endpoint: { keyHash: string; syncUrl: string }) => {
    state.signalled.push(endpoint);
    return true;
  }),
}));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});
vi.mock("@/app/connect/wordpress/switch-account", () => ({ SwitchAccount: () => null }));

import ConnectWordPressPage from "@/app/connect/wordpress/page";
import { approveConnection, cancelConnection } from "@/app/connect/wordpress/actions";
import { POST as disconnect } from "@/app/api/plugin/disconnect/route";
import { POST as start } from "@/app/api/plugin/connect/start/route";
import { POST as token } from "@/app/api/plugin/connect/token/route";
import { POST as verify } from "@/app/api/plugin/verify/route";
import {
  integrationKeys,
  member,
  notifications,
  organization,
  pluginConnectRequests,
  session as sessions,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";

import { connectWordPress } from "./actions";
import {
  approveHandshake,
  cancelHandshake,
  connectCandidates,
  createConnectLink,
  exchangeHandshakeCode,
  loadForViewer,
  MAX_OPEN_PER_CALLER,
  MAX_OPEN_TOTAL,
  parseStart,
  startHandshake,
} from "./handshake";
import { GET as articles } from "@/app/api/plugin/articles/route";

import { CONNECT_KEY_LABEL, createIntegrationKey, mintConnectKey, recordSiteInfo, reportedWordPressAdmin } from "./keys";

let test: TestDb;
const ORG_A = "org_hs_a";
const ORG_B = "org_hs_b";
const ORG_C = "org_hs_c";
let siteA: string;
let siteB: string;
let siteC: string;
const HOST = "imagestudio.example";
/** The WordPress server calling start, for the per-caller limit. */
const CALLER = "203.0.113.7";
const SITE = `https://${HOST}`;
const RETURN = `${SITE}/wp-admin/admin.php?page=repget`;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.after = [];
  state.signalled = [];
  state.host = "www.repget.com";
  await test.client.exec(`
    delete from plugin_connect_requests; delete from notifications; delete from integration_keys;
    delete from website_members; delete from websites; delete from "session";
    delete from "member"; delete from "user"; delete from organization;
  `);
  const now = new Date();
  await test.db.insert(organization).values([
    { id: ORG_A, name: "Photo Booth Studio", slug: "hs-a", createdAt: now },
    { id: ORG_B, name: "Second Account", slug: "hs-b", createdAt: now },
    { id: ORG_C, name: "Stranger Co", slug: "hs-c", createdAt: now },
  ]);
  await test.db.insert(user).values(
    ["u_owner", "u_editor", "u_viewer", "u_stranger"].map((id) => ({
      id,
      name: id,
      email: `${id}@mail.example`,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await test.db.insert(member).values([
    { id: "hm1", organizationId: ORG_A, userId: "u_owner", role: "owner", createdAt: now },
    { id: "hm2", organizationId: ORG_B, userId: "u_owner", role: "owner", createdAt: now },
    { id: "hm3", organizationId: ORG_C, userId: "u_stranger", role: "owner", createdAt: now },
  ]);
  const rows = await test.db
    .insert(websites)
    .values([
      { organizationId: ORG_A, url: SITE, domain: HOST, brandName: "Image Studio" },
      // Typed with www. in the second account: still the same WordPress host.
      { organizationId: ORG_B, url: `https://www.${HOST}`, domain: `www.${HOST}`, brandName: "Image Studio (new)" },
      // Somebody else's account with the same domain: never offered to anyone else.
      { organizationId: ORG_C, url: SITE, domain: HOST, brandName: "Not yours" },
    ])
    .returning({ id: websites.id });
  [siteA, siteB, siteC] = rows.map((row) => row.id);
  await test.db.insert(websiteMembers).values([
    { websiteId: siteA, userId: "u_editor", role: "editor" },
    { websiteId: siteA, userId: "u_viewer", role: "viewer" },
  ]);
  const later = new Date(Date.now() + 86_400_000);
  await test.db.insert(sessions).values(
    ["s_u_owner", "s_u_owner_2", "s_u_editor", "s_u_viewer", "s_u_stranger"].map((id) => ({
      id,
      token: `t_${id}`,
      userId: id.replace(/^s_/, "").replace(/_2$/, ""),
      expiresAt: later,
      createdAt: now,
      updatedAt: now,
    })),
  );
  as("u_owner", ORG_A);
});

function as(userId: string, activeOrganizationId: string, sessionId = `s_${userId}`) {
  state.session = {
    user: { id: userId, email: `${userId}@mail.example` },
    session: { id: sessionId, activeOrganizationId },
  };
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

function startInput(over: Record<string, unknown> = {}) {
  return {
    siteUrl: SITE,
    returnUrl: RETURN,
    state: randomBytes(24).toString("base64url"),
    challenge: pkce().challenge,
    pluginVersion: "1.7.0",
    link: undefined,
    ...over,
  };
}

async function row(id: string) {
  const [found] = await test.db.select().from(pluginConnectRequests).where(eq(pluginConnectRequests.id, id));
  return found;
}

/** A request started in WordPress, opened and approved by u_owner for `websiteId`. */
async function approved(websiteId: string, over: Record<string, unknown> = {}, presentedKey: string | null = null) {
  const { verifier, challenge } = pkce();
  const input = startInput({ challenge, ...over });
  const started = await startHandshake(input, presentedKey, CALLER);
  if (!started.ok) throw new Error(started.error);
  const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
  await loadForViewer(started.id, viewer);
  const outcome = await approveHandshake({ id: started.id, websiteId, ...viewer });
  if (!outcome.ok) throw new Error(outcome.reason);
  const back = new URL(outcome.redirectTo);
  return {
    id: started.id,
    verifier,
    state: input.state as string,
    back,
    code: back.searchParams.get("code")!,
  };
}

async function liveKeys(websiteId: string) {
  const rows = await test.db.select().from(integrationKeys).where(eq(integrationKeys.websiteId, websiteId));
  return rows.filter((key) => !key.revokedAt);
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/* ------------------------------------------------------------------------ */

describe("parseStart", () => {
  it("accepts a public site and its own wp-admin/admin.php, www or not", () => {
    const parsed = parseStart(startInput({ siteUrl: `https://www.${HOST}/`, returnUrl: `${RETURN}#frag` }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.host).toBe(HOST);
    // The fragment is dropped: RepGet adds its answer to the query.
    expect(parsed.value.returnUrl).toBe(RETURN);
  });

  it("accepts the address plugin 1.7.0 sends, with its callback marker", () => {
    expect(parseStart(startInput({ returnUrl: `${RETURN}&repget_connect=callback` })).ok).toBe(true);
  });

  it("accepts a WordPress installed in a subdirectory", () => {
    expect(parseStart(startInput({ siteUrl: `${SITE}/blog`, returnUrl: `${SITE}/blog/wp-admin/admin.php?page=repget` })).ok).toBe(true);
  });

  it.each([
    ["a return address on another host", { returnUrl: "https://evil.example/wp-admin/admin.php?page=repget" }],
    ["a return address that is not admin.php", { returnUrl: `${SITE}/wp-login.php?page=repget` }],
    ["a return address on a look-alike host", { returnUrl: `https://${HOST}.evil.example/wp-admin/admin.php?page=repget` }],
    ["another plugin's screen", { returnUrl: `${SITE}/wp-admin/admin.php?page=other-plugin` }],
    ["the RepGet screen with extra parameters", { returnUrl: `${RETURN}&redirect_to=https://evil.example` }],
    ["the RepGet screen twice", { returnUrl: `${RETURN}&page=other` }],
    ["no screen at all", { returnUrl: `${SITE}/wp-admin/admin.php` }],
    ["credentials in the address", { siteUrl: `https://user:pass@${HOST}` }],
    ["a non-web scheme", { siteUrl: `ftp://${HOST}` }],
    ["localhost", { siteUrl: "http://localhost:8080", returnUrl: "http://localhost:8080/wp-admin/admin.php?page=repget" }],
    ["a private address", { siteUrl: "http://10.0.0.5", returnUrl: "http://10.0.0.5/wp-admin/admin.php?page=repget" }],
    ["a reserved name", { siteUrl: "https://shop.test", returnUrl: "https://shop.test/wp-admin/admin.php?page=repget" }],
    ["a short state", { state: "abc" }],
    ["a state with odd characters", { state: "a".repeat(20) + "<>" }],
    ["a challenge of the wrong length", { challenge: "a".repeat(42) }],
    ["a challenge with odd characters", { challenge: "+".repeat(43) }],
    ["no site at all", { siteUrl: undefined }],
  ])("refuses %s", (_name, over) => {
    expect(parseStart(startInput(over)).ok).toBe(false);
  });
});

describe("startHandshake", () => {
  it("registers a request from WordPress, open for 15 minutes on the database clock", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [found] = await test.db
      .select({
        origin: pluginConnectRequests.origin,
        siteHost: pluginConnectRequests.siteHost,
        minutes: sql<number>`round(extract(epoch from (${pluginConnectRequests.expiresAt} - localtimestamp)) / 60)::int`,
      })
      .from(pluginConnectRequests)
      .where(eq(pluginConnectRequests.id, started.id));
    expect(found).toEqual({ origin: "wordpress", siteHost: HOST, minutes: 15 });
  });

  it("attaches the site to the link from Connect WordPress", async () => {
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    const started = await startHandshake(startInput({ link }), null, CALLER);
    expect(started).toEqual({ ok: true, id: link });
    const found = await row(link);
    expect(found.origin).toBe("repget");
    expect(found.siteHost).toBe(HOST);
    expect(found.websiteId).toBe(siteA);
  });

  it("attaches to a website stored with www., too", async () => {
    const link = await createConnectLink(siteB, "u_owner", "s_u_owner", null);
    expect(await startHandshake(startInput({ link }), null, CALLER)).toEqual({ ok: true, id: link });
  });

  it("never attaches a site to a link for a website with another domain", async () => {
    await test.db.update(websites).set({ domain: "other.example" }).where(eq(websites.id, siteA));
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    const started = await startHandshake(startInput({ link }), null, CALLER);
    expect(started.ok && started.id).not.toBe(link);
    expect((await row(link)).siteHost).toBeNull();
  });

  it("attaches a link once: a second WordPress gets a request of its own", async () => {
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await startHandshake(startInput({ link }), null, CALLER);
    const second = await startHandshake(startInput({ link }), null, CALLER);
    expect(second.ok && second.id).not.toBe(link);
    if (second.ok) expect((await row(second.id)).origin).toBe("wordpress");
  });

  it("does not attach to an expired link", async () => {
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await test.client.exec(`update plugin_connect_requests set expires_at = localtimestamp - interval '1 minute' where id = '${link}'`);
    const started = await startHandshake(startInput({ link }), null, CALLER);
    expect(started.ok && started.id).not.toBe(link);
  });

  it("records the key WordPress holds without marking it used", async () => {
    const held = await createIntegrationKey(siteA);
    const started = await startHandshake(startInput(), held.key, CALLER);
    if (!started.ok) throw new Error(started.error);
    expect((await row(started.id)).presentedKeyId).toBe(held.id);
    const [key] = await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, held.id));
    expect(key.lastUsedAt).toBeNull();
  });

  it("ignores a key that is not valid instead of refusing", async () => {
    const started = await startHandshake(startInput(), "seo_not-a-real-key", CALLER);
    expect(started.ok).toBe(true);
    if (started.ok) expect((await row(started.id)).presentedKeyId).toBeNull();
  });

  it(`limits each caller to ${MAX_OPEN_PER_CALLER} open requests, and nothing per site: nobody can lock a site out`, async () => {
    for (let i = 0; i < MAX_OPEN_PER_CALLER; i++) expect((await startHandshake(startInput(), null, CALLER)).ok).toBe(true);
    expect(await startHandshake(startInput(), null, CALLER)).toMatchObject({ ok: false, status: 429 });
    // The real WordPress, calling from its own address, still gets through for the same site...
    expect((await startHandshake(startInput(), null, "198.51.100.20")).ok).toBe(true);
    // ...and so does a Connect WordPress link from the flooding address itself: attaching adds no row.
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    expect(await startHandshake(startInput({ link }), null, CALLER)).toEqual({ ok: true, id: link });
    // Used requests do not count.
    await test.client.exec(`update plugin_connect_requests set consumed_at = localtimestamp where id in (select id from plugin_connect_requests where caller_hash is not null limit 1)`);
    expect((await startHandshake(startInput(), null, CALLER)).ok).toBe(true);
  });

  it("stores who called only as a hash", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const found = await row(started.id);
    expect(found.callerHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(found)).not.toContain(CALLER);
  });

  describe(`at ${MAX_OPEN_TOTAL} open requests in all`, () => {
    /** Fills the table with open requests from many callers, approved with a live code or not. */
    async function fill(count: number, withLiveCode: boolean) {
      await test.client.exec(`
        insert into plugin_connect_requests (id, origin, site_host, site_url, return_url, plugin_state, code_challenge, caller_hash, created_at, expires_at${withLiveCode ? ", approved_at, code_hash, code_expires_at" : ""})
        select 'filler' || g, 'wordpress', 'h' || g || '.example', 'https://h' || g || '.example/', 'https://h' || g || '.example/wp-admin/admin.php?page=repget',
               repeat('s', 20), repeat('c', 43), 'caller' || g, localtimestamp - make_interval(secs => ${MAX_OPEN_TOTAL} - g), localtimestamp + interval '10 minutes'
               ${withLiveCode ? ", localtimestamp, 'x', localtimestamp + interval '4 minutes'" : ""}
        from generate_series(1, ${count}) g`);
    }

    it("makes room by dropping the oldest request without a live code", async () => {
      await fill(MAX_OPEN_TOTAL, false);
      expect((await startHandshake(startInput(), null, CALLER)).ok).toBe(true);
      expect(await row("filler1")).toBeUndefined();
      expect(await row("filler2")).toBeDefined();
    });

    it("never drops a request whose code is out, and answers 429 when every one has one", async () => {
      await fill(MAX_OPEN_TOTAL, true);
      expect(await startHandshake(startInput(), null, CALLER)).toMatchObject({ ok: false, status: 429 });
      expect(await row("filler1")).toBeDefined();
    });
  });

  it("deletes unused rows once expired, and a used one a day later, when the next is written", async () => {
    const unused = await startHandshake(startInput(), null, CALLER);
    const usedOld = await startHandshake(startInput(), null, CALLER);
    const usedRecent = await startHandshake(startInput(), null, CALLER);
    const codeOpen = await startHandshake(startInput(), null, CALLER);
    if (!unused.ok || !usedOld.ok || !usedRecent.ok || !codeOpen.ok) throw new Error("start failed");
    await test.client.exec(`
      update plugin_connect_requests set expires_at = localtimestamp - interval '1 minute' where id = '${unused.id}';
      update plugin_connect_requests set consumed_at = localtimestamp, expires_at = localtimestamp - interval '25 hours' where id = '${usedOld.id}';
      update plugin_connect_requests set consumed_at = localtimestamp, expires_at = localtimestamp - interval '1 hour' where id = '${usedRecent.id}';
      update plugin_connect_requests set expires_at = localtimestamp - interval '1 minute', code_expires_at = localtimestamp + interval '3 minutes' where id = '${codeOpen.id}';
    `);
    await startHandshake(startInput(), null, CALLER);
    expect(await row(unused.id)).toBeUndefined();
    expect(await row(usedOld.id)).toBeUndefined();
    // Read when its key first verifies.
    expect(await row(usedRecent.id)).toBeDefined();
    // Its code can still be exchanged.
    expect(await row(codeOpen.id)).toBeDefined();
  });
});

describe("the start route", () => {
  it("answers with the RepGet page to open, on the address the plugin called, never cached", async () => {
    const response = await start(post("https://app.example/api/plugin/connect/start", startInput()));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const body = (await response.json()) as { ok: boolean; authorizeUrl: string };
    // The plugin accepts only its own endpoint as the prefix.
    expect(body.authorizeUrl).toMatch(/^https:\/\/app\.example\/connect\/wordpress\?request=[A-Za-z0-9_-]{43}$/);
    const staging = await start(post("https://staging.app.example/api/plugin/connect/start", startInput()));
    expect(((await staging.json()) as { authorizeUrl: string }).authorizeUrl).toMatch(/^https:\/\/staging\.app\.example\/connect\/wordpress\?/);
  });

  it("reads the held key from X-Integration-Key", async () => {
    const held = await createIntegrationKey(siteA);
    const response = await start(post("https://app.example/api/plugin/connect/start", startInput(), { "x-integration-key": held.key }));
    const id = new URL(((await response.json()) as { authorizeUrl: string }).authorizeUrl).searchParams.get("request")!;
    expect((await row(id)).presentedKeyId).toBe(held.id);
  });

  it("refuses bad input with 400", async () => {
    expect((await start(post("https://app.example/api/plugin/connect/start", "not json"))).status).toBe(400);
    expect((await start(post("https://app.example/api/plugin/connect/start", startInput({ state: "x" })))).status).toBe(400);
  });
});

describe("/connect/wordpress: who may approve what", () => {
  it("offers this person's websites for the host in every workspace they are in, and never anyone else's", async () => {
    const offered = await connectCandidates("u_owner", HOST);
    expect(offered.map((c) => c.websiteId).sort()).toEqual([siteA, siteB].sort());
    expect(offered.map((c) => c.workspaceName).sort()).toEqual(["Photo Booth Studio", "Second Account"]);
    expect((await connectCandidates("u_editor", HOST)).map((c) => c.websiteId)).toEqual([siteA]);
    // A viewer may not connect anything.
    expect(await connectCandidates("u_viewer", HOST)).toEqual([]);
    expect((await connectCandidates("u_stranger", HOST)).map((c) => c.websiteId)).toEqual([siteC]);
    expect(await connectCandidates("u_owner", "other.example")).toEqual([]);
  });

  it("belongs to the first session that opens it", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    expect((await loadForViewer(started.id, { sessionId: "s_u_owner", userId: "u_owner" })).state).toBe("ready");
    expect((await loadForViewer(started.id, { sessionId: "s_u_owner_2", userId: "u_owner" })).state).toBe("other_browser");
    expect((await loadForViewer(started.id, { sessionId: "s_u_stranger", userId: "u_stranger" })).state).toBe("other_browser");
    expect(await approveHandshake({ id: started.id, websiteId: siteA, sessionId: "s_u_owner_2", userId: "u_owner" })).toEqual({
      ok: false,
      reason: "other_browser",
    });
  });

  it("passes to a new session once the first one signed out", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    await loadForViewer(started.id, { sessionId: "s_u_stranger", userId: "u_stranger" });
    await test.db.delete(sessions).where(eq(sessions.id, "s_u_stranger"));
    expect((await loadForViewer(started.id, { sessionId: "s_u_owner", userId: "u_owner" })).state).toBe("ready");
  });

  it("is gone when unknown, malformed, expired, cancelled or not yet registered by WordPress", async () => {
    const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
    expect((await loadForViewer("x".repeat(43), viewer)).state).toBe("gone");
    expect((await loadForViewer("../etc", viewer)).state).toBe("gone");
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    expect((await loadForViewer(link, viewer)).state).toBe("gone");
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    await test.client.exec(`update plugin_connect_requests set expires_at = localtimestamp where id = '${started.id}'`);
    expect((await loadForViewer(started.id, viewer)).state).toBe("gone");
  });

  it("approves without asking only for the same session, website and no move", async () => {
    const own = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await startHandshake(startInput({ link: own }), null, CALLER);
    const view = await loadForViewer(own, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(view.state === "ready" && view.autoApprove).toBe(true);

    // Opened by another session, even of the same person: not theirs to open.
    const other = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await startHandshake(startInput({ link: other }), null, CALLER);
    expect((await loadForViewer(other, { sessionId: "s_u_owner_2", userId: "u_owner" })).state).toBe("other_browser");

    // WordPress holds a key of ANOTHER website: moving it always asks.
    const held = await createIntegrationKey(siteB);
    const moving = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await startHandshake(startInput({ link: moving }), held.key, CALLER);
    const move = await loadForViewer(moving, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(move.state === "ready" && move.autoApprove).toBe(false);
    expect(move.state === "ready" && move.presented).toMatchObject({ websiteId: siteB, workspaceName: "Second Account" });

    // Started in WordPress: asks.
    const fromWordPress = await startHandshake(startInput(), null, CALLER);
    if (!fromWordPress.ok) throw new Error(fromWordPress.error);
    const asked = await loadForViewer(fromWordPress.id, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(asked.state === "ready" && asked.autoApprove).toBe(false);
  });

  it("a Connect WordPress link can be opened only by the session that pressed the button", async () => {
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    const attacker = { sessionId: "s_u_stranger", userId: "u_stranger" };
    // Before WordPress attaches it (the link leaked from the WordPress address): nothing to claim.
    expect((await loadForViewer(link, attacker)).state).toBe("gone");
    expect((await row(link)).viewerSessionId).toBeNull();
    await startHandshake(startInput({ link }), null, CALLER);
    // After: still not theirs, even with a website of the same domain (siteC).
    expect((await loadForViewer(link, attacker)).state).toBe("other_browser");
    expect(await approveHandshake({ id: link, websiteId: siteC, ...attacker })).toEqual({ ok: false, reason: "other_browser" });
    // The session that pressed it is untouched.
    const own = await loadForViewer(link, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(own.state === "ready" && own.autoApprove).toBe(true);
  });

  it("a Connect WordPress link connects only the website it was pressed on", async () => {
    const link = await createConnectLink(siteA, "u_owner", "s_u_owner", null);
    await startHandshake(startInput({ link }), null, CALLER);
    const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
    await loadForViewer(link, viewer);
    // siteB is the same person's, with the same domain - but the button was pressed on siteA.
    expect(await approveHandshake({ id: link, websiteId: siteB, ...viewer })).toEqual({ ok: false, reason: "not_allowed" });
    expect((await approveHandshake({ id: link, websiteId: siteA, ...viewer })).ok).toBe(true);
  });

  it("never names another customer's workspace when their key is presented", async () => {
    const theirs = await createIntegrationKey(siteC);
    const started = await startHandshake(startInput(), theirs.key, CALLER);
    if (!started.ok) throw new Error(started.error);
    const view = await loadForViewer(started.id, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(view.state === "ready" && view.presented).toEqual({ websiteId: siteC, organizationId: ORG_C, workspaceName: null, domain: null });
  });

  it("shows the WordPress the code goes back to, not just the address the plugin named", async () => {
    const started = await startHandshake(startInput({ siteUrl: SITE, returnUrl: `${SITE}/shop/wp-admin/admin.php?page=repget` }), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const view = await loadForViewer(started.id, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(view.state === "ready" && view.request.wordpressAt).toBe(`${SITE}/shop/`);
    const html = renderToStaticMarkup(await ConnectWordPressPage({ searchParams: Promise.resolve({ request: started.id }) } as never));
    expect(html).toContain(`The WordPress site at ${SITE}/shop/ will publish`);
  });

  it("sends the browser back only to the address WordPress registered, with a one-time code", async () => {
    const { back, id, state: pluginState } = await approved(siteA, { returnUrl: `${RETURN}&repget_connect=callback` });
    expect(`${back.origin}${back.pathname}`).toBe(`${SITE}/wp-admin/admin.php`);
    expect(back.searchParams.get("page")).toBe("repget");
    expect(back.searchParams.get("repget_connect")).toBe("callback");
    expect(back.searchParams.get("request")).toBe(id);
    expect(back.searchParams.get("state")).toBe(pluginState);
    expect(back.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const found = await row(id);
    expect(found.websiteId).toBe(siteA);
    expect(found.approvedByUserId).toBe("u_owner");
    // Only its hash is stored.
    expect(found.codeHash).toBe(createHash("sha256").update(back.searchParams.get("code")!).digest("hex"));
  });

  it("refuses a website the person cannot edit, and approves once", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
    await loadForViewer(started.id, viewer);
    expect(await approveHandshake({ id: started.id, websiteId: siteC, ...viewer })).toEqual({ ok: false, reason: "not_allowed" });
    expect((await approveHandshake({ id: started.id, websiteId: siteA, ...viewer })).ok).toBe(true);
    expect(await approveHandshake({ id: started.id, websiteId: siteA, ...viewer })).toEqual({ ok: false, reason: "gone" });
  });

  it("says so on RepGet when the website has no room for another key", async () => {
    for (let i = 0; i < 5; i++) await createIntegrationKey(siteA, "Added by hand");
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
    await loadForViewer(started.id, viewer);
    expect(await approveHandshake({ id: started.id, websiteId: siteA, ...viewer })).toEqual({ ok: false, reason: "too_many_keys" });
  });

  it("cancels back to WordPress, and the request is gone", async () => {
    const pluginState = randomBytes(24).toString("base64url");
    const started = await startHandshake(startInput({ state: pluginState }), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const viewer = { sessionId: "s_u_owner", userId: "u_owner" };
    await loadForViewer(started.id, viewer);
    expect(await cancelHandshake(started.id, "s_u_owner_2")).toBeNull();
    const back = new URL((await cancelHandshake(started.id, "s_u_owner"))!);
    expect(back.searchParams.get("repget_connect")).toBe("cancelled");
    expect(back.searchParams.get("state")).toBe(pluginState);
    expect(back.searchParams.get("code")).toBeNull();
    expect((await loadForViewer(started.id, viewer)).state).toBe("gone");
  });
});

describe("exchanging the code", () => {
  it("gives WordPress a key for the approved website, once", async () => {
    const { id, code, verifier } = await approved(siteA);
    const outcome = await exchangeHandshakeCode({ request: id, code, verifier });
    expect(outcome).toMatchObject({
      ok: true,
      website: { id: siteA, domain: HOST, name: "Image Studio" },
      workspace: { name: "Photo Booth Studio" },
    });
    if (!outcome.ok) return;
    expect(outcome.key).toMatch(/^seo_/);
    const [key] = await liveKeys(siteA);
    expect(key.label).toBe(CONNECT_KEY_LABEL);
    expect(key.keyHash).toBe(createHash("sha256").update(outcome.key).digest("hex"));
    const found = await row(id);
    expect(found.issuedKeyId).toBe(key.id);
    expect(found.consumedAt).not.toBeNull();
    expect(found.codeHash).toBeNull();
    // Its install is the WordPress that asked for it, before any copy could report it.
    expect(key.installUrl).toBe(`${SITE}/wp-admin/admin-ajax.php`);

    expect((await exchangeHandshakeCode({ request: id, code, verifier })).ok).toBe(false);
    expect(await liveKeys(siteA)).toHaveLength(1);
  });

  it.each([
    ["a wrong verifier", (a: { code: string; verifier: string }) => ({ code: a.code, verifier: pkce().verifier })],
    ["no verifier", (a: { code: string; verifier: string }) => ({ code: a.code, verifier: "" })],
    ["a wrong code", (a: { code: string; verifier: string }) => ({ code: randomBytes(32).toString("base64url"), verifier: a.verifier })],
  ])("uses the code up on %s", async (_name, wrong) => {
    const attempt = await approved(siteA);
    expect((await exchangeHandshakeCode({ request: attempt.id, ...wrong(attempt) })).ok).toBe(false);
    // Even the right pair no longer works.
    expect((await exchangeHandshakeCode({ request: attempt.id, code: attempt.code, verifier: attempt.verifier })).ok).toBe(false);
    expect(await liveKeys(siteA)).toHaveLength(0);
  });

  it("refuses an expired code", async () => {
    const { id, code, verifier } = await approved(siteA);
    await test.client.exec(`update plugin_connect_requests set code_expires_at = localtimestamp - interval '1 second' where id = '${id}'`);
    expect((await exchangeHandshakeCode({ request: id, code, verifier })).ok).toBe(false);
  });

  it("refuses a request nobody approved", async () => {
    const { verifier, challenge } = pkce();
    const started = await startHandshake(startInput({ challenge }), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    expect((await exchangeHandshakeCode({ request: started.id, code: randomBytes(32).toString("base64url"), verifier })).ok).toBe(false);
  });

  it("makes one key when two exchanges race", async () => {
    const { id, code, verifier } = await approved(siteA);
    const results = await Promise.all([
      exchangeHandshakeCode({ request: id, code, verifier }),
      exchangeHandshakeCode({ request: id, code, verifier }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await liveKeys(siteA)).toHaveLength(1);
  });

  it("answers through the token route, never cached", async () => {
    const { id, code, verifier } = await approved(siteB);
    const response = await token(post("https://app.example/api/plugin/connect/token", { request: id, code, verifier }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, website: { id: siteB }, workspace: { name: "Second Account" } });
    const again = await token(post("https://app.example/api/plugin/connect/token", { request: id, code, verifier }));
    expect(again.status).toBe(400);
  });
});

describe("the new key's first check", () => {
  async function connectWith(websiteId: string, presentedKey: string | null) {
    const attempt = await approved(websiteId, {}, presentedKey);
    const outcome = await exchangeHandshakeCode({ request: attempt.id, code: attempt.code, verifier: attempt.verifier });
    if (!outcome.ok) throw new Error(outcome.error);
    return { ...attempt, key: outcome.key };
  }

  async function verifyWith(key: string, syncUrl?: string) {
    state.after = [];
    const response = await verify(
      post("https://app.example/api/plugin/verify", { pluginVersion: "1.7.0", siteUrl: SITE, syncUrl }, { "x-integration-key": key }),
    );
    for (const task of state.after) await task();
    return response;
  }

  it("moving the site to another account retires the old key, tells its site and its workspace", async () => {
    const old = await createIntegrationKey(siteA);
    await test.db
      .update(integrationKeys)
      .set({ lastUsedAt: new Date(), syncUrl: `${SITE}/wp-admin/admin-ajax.php` })
      .where(eq(integrationKeys.id, old.id));
    const moved = await connectWith(siteB, old.key);

    // Not before the new key works.
    expect((await liveKeys(siteA)).map((key) => key.id)).toEqual([old.id]);

    expect((await verifyWith(moved.key)).status).toBe(200);
    expect(await liveKeys(siteA)).toEqual([]);
    expect(state.signalled).toEqual([
      { keyHash: createHash("sha256").update(old.key).digest("hex"), syncUrl: `${SITE}/wp-admin/admin-ajax.php` },
    ]);
    const told = await test.db.select().from(notifications).where(eq(notifications.organizationId, ORG_A));
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ type: "plugin.moved", href: `/websites/${siteA}/integrations` });
    expect(told[0].title).toContain("another RepGet account");
    expect((await row(moved.id)).presentedKeyId).toBeNull();

    // Once.
    await verifyWith(moved.key);
    expect(await test.db.select().from(notifications).where(eq(notifications.organizationId, ORG_A))).toHaveLength(1);
  });

  it("does not signal the site that moved: only another install of the old key", async () => {
    const old = await createIntegrationKey(siteA);
    const ajax = `${SITE}/wp-admin/admin-ajax.php`;
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date(), syncUrl: ajax }).where(eq(integrationKeys.id, old.id));
    const moved = await connectWith(siteB, old.key);
    await verifyWith(moved.key, ajax);
    expect(await liveKeys(siteA)).toEqual([]);
    expect(state.signalled).toEqual([]);
    expect(await test.db.select().from(notifications).where(eq(notifications.organizationId, ORG_A))).toHaveLength(1);
  });

  it("reconnecting the same website leaves the previous key alone", async () => {
    const old = await createIntegrationKey(siteA);
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, old.id));
    const again = await connectWith(siteA, old.key);
    await verifyWith(again.key);
    expect((await liveKeys(siteA)).map((key) => key.id)).toContain(old.id);
    expect(await test.db.select().from(notifications)).toEqual([]);
  });

  it("a connect that never verifies leaves the working site connected", async () => {
    const old = await createIntegrationKey(siteA);
    await connectWith(siteB, old.key);
    await verifyWith(old.key);
    expect((await liveKeys(siteA)).map((key) => key.id)).toEqual([old.id]);
  });
});

describe("disconnect", () => {
  const live = `${SITE}/wp-admin/admin-ajax.php`;
  const staging = `${SITE}/staging/wp-admin/admin-ajax.php`;
  const call = async (key: string, syncUrl?: string) => {
    const response = await disconnect(post("https://app.example/api/plugin/disconnect", syncUrl ? { syncUrl } : {}, { "x-integration-key": key }));
    return { status: response.status, body: (await response.json()) as { ok: boolean; revoked?: boolean } };
  };
  // What each install does before its Disconnect button is even on screen: its settings page verifies.
  const verifyFrom = (key: string, syncUrl: string) =>
    verify(post("https://app.example/api/plugin/verify", { pluginVersion: "1.7.0", siteUrl: SITE, syncUrl }, { "x-integration-key": key }));
  const pollFrom = (key: string, syncUrl: string) =>
    articles(new NextRequest("https://app.example/api/plugin/articles", { headers: { "x-integration-key": key, "x-repget-sync-url": syncUrl } }));
  const keyRow = async (id: string) => (await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, id)))[0];

  it("revokes the key a one-click connect issued, for the WordPress that asked for it, without recording use", async () => {
    const attempt = await approved(siteA);
    const issued = await exchangeHandshakeCode({ request: attempt.id, code: attempt.code, verifier: attempt.verifier });
    if (!issued.ok) throw new Error(issued.error);
    const [key] = await liveKeys(siteA);
    const { status, body } = await call(issued.key, live);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, revoked: true });
    const after = await keyRow(key.id);
    expect(after.revokedAt).not.toBeNull();
    expect(after.lastUsedAt).toBeNull();
    expect((await call(issued.key, live)).status).toBe(401);
  });

  it("a staging copy in a subfolder that verified first still cannot revoke the live site's key", async () => {
    const attempt = await approved(siteA);
    const issued = await exchangeHandshakeCode({ request: attempt.id, code: attempt.code, verifier: attempt.verifier });
    if (!issued.ok) throw new Error(issued.error);
    const [key] = await liveKeys(siteA);
    await verifyFrom(issued.key, live);
    // The copy opens its RepGet screen (a verify) and polls, from its own address...
    await verifyFrom(issued.key, staging);
    await pollFrom(issued.key, staging);
    // ...and presses Disconnect: the key stays, the copy forgets it.
    expect((await call(issued.key, staging)).body).toEqual({ ok: true, revoked: false });
    expect((await keyRow(key.id)).revokedAt).toBeNull();
    // The live site's own Disconnect is held back too while a copy uses the key: only the copy would lose it.
    expect((await call(issued.key, live)).body).toEqual({ ok: true, revoked: false });
    expect((await keyRow(key.id)).revokedAt).toBeNull();
    // A month after the copy last used it, the live site's word counts again.
    await test.client.exec(`update integration_keys set other_install_at = localtimestamp - interval '31 days' where id = '${key.id}'`);
    expect((await call(issued.key, live)).body).toEqual({ ok: true, revoked: true });
  });

  it("an older key: the first install that reports it, once two quiet hours have passed", async () => {
    const held = await createIntegrationKey(siteA);
    // Made days ago (by hand, or before installs were recorded).
    await test.client.exec(`update integration_keys set created_at = localtimestamp - interval '3 days' where id = '${held.id}'`);
    await pollFrom(held.key, live);
    expect((await keyRow(held.id)).installUrl).toBe(live);
    // Too soon to know no copy uses it.
    expect((await call(held.key, live)).body).toEqual({ ok: true, revoked: false });
    await test.client.exec(`update integration_keys set install_since = localtimestamp - interval '3 hours' where id = '${held.id}'`);
    // Nor for anyone but that install.
    expect((await call(held.key, staging)).body).toEqual({ ok: true, revoked: false });
    expect((await call(held.key, live)).body).toEqual({ ok: true, revoked: true });
  });

  it("never revokes for a caller it cannot recognise, or a key no install has reported", async () => {
    const held = await createIntegrationKey(siteA);
    expect((await call(held.key, live)).body).toEqual({ ok: true, revoked: false });
    await verifyFrom(held.key, live);
    expect((await call(held.key)).body).toEqual({ ok: true, revoked: false });
    expect((await call(held.key, "https://imagestudio.example/not-wordpress")).body).toEqual({ ok: true, revoked: false });
    expect((await keyRow(held.id)).revokedAt).toBeNull();
  });

  it("notes another address at most hourly, and never moves the install", async () => {
    const held = await createIntegrationKey(siteA);
    await verifyFrom(held.key, live);
    await pollFrom(held.key, staging);
    const first = await keyRow(held.id);
    expect(first.installUrl).toBe(live);
    expect(first.otherInstallAt).not.toBeNull();
    await test.client.exec(`update integration_keys set other_install_at = localtimestamp - interval '30 minutes' where id = '${held.id}'`);
    const noted = (await keyRow(held.id)).otherInstallAt;
    await pollFrom(held.key, staging);
    expect((await keyRow(held.id)).otherInstallAt).toEqual(noted);
    expect((await keyRow(held.id)).installUrl).toBe(live);
  });
});

describe("what the card shows", () => {
  it("keeps the plugin version current from the header every call sends", async () => {
    const held = await createIntegrationKey(siteA);
    await recordSiteInfo(held.id, `${SITE} · WP 6.8.3 · plugin 1.6.0`);
    const pull = (version: string) =>
      articles(new NextRequest("https://app.example/api/plugin/articles", { headers: { "x-integration-key": held.key, "x-repget-plugin-version": version } }));
    expect((await pull("1.7.0")).status).toBe(200);
    const info = async () => (await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, held.id)))[0].siteInfo;
    expect(await info()).toBe(`${SITE} · WP 6.8.3 · plugin 1.7.0`);
    await pull("not-a-version");
    expect(await info()).toBe(`${SITE} · WP 6.8.3 · plugin 1.7.0`);
  });

  it("knows where a WordPress in a subdirectory keeps its admin", async () => {
    expect(await reportedWordPressAdmin(siteA)).toBeNull();
    const older = await createIntegrationKey(siteA);
    const newer = await createIntegrationKey(siteA);
    await test.db.update(integrationKeys).set({ syncUrl: `${SITE}/old/wp-admin/admin-ajax.php`, lastUsedAt: new Date(Date.now() - 86_400_000) }).where(eq(integrationKeys.id, older.id));
    await test.db.update(integrationKeys).set({ syncUrl: `${SITE}/blog/wp-admin/admin-ajax.php`, lastUsedAt: new Date() }).where(eq(integrationKeys.id, newer.id));
    expect(await reportedWordPressAdmin(siteA)).toBe(`${SITE}/blog/wp-admin/`);
  });
});

describe("a Connect WordPress press with plugin 1.7", () => {
  async function press() {
    const result = await connectWordPress(siteA);
    if (!result.ok) throw new Error(result.error);
    const { verifier, challenge } = pkce();
    await startHandshake(startInput({ link: result.data.link, challenge }), null, CALLER);
    return { ...result.data, verifier };
  }
  async function finish(link: string, verifier: string) {
    const view = await loadForViewer(link, { sessionId: "s_u_owner", userId: "u_owner" });
    expect(view.state === "ready" && view.autoApprove).toBe(true);
    const approved = await approveHandshake({ id: link, websiteId: siteA, sessionId: "s_u_owner", userId: "u_owner" });
    if (!approved.ok) throw new Error(approved.reason);
    const exchanged = await exchangeHandshakeCode({ request: link, code: new URL(approved.redirectTo).searchParams.get("code")!, verifier });
    if (!exchanged.ok) throw new Error(exchanged.error);
    return exchanged.key;
  }

  it("uses one key slot, not two: the press's key for 1.6 goes when the handshake issues the real one", async () => {
    const { link, keyPrefix, verifier } = await press();
    // Only the key for plugin 1.6 so far.
    expect(await liveKeys(siteA)).toHaveLength(1);
    const key = await finish(link!, verifier);
    const live = await liveKeys(siteA);
    expect(live).toHaveLength(1);
    expect(live[0].keyHash).toBe(createHash("sha256").update(key).digest("hex"));
    expect(live.some((k) => k.keyPrefix === keyPrefix)).toBe(false);
  });

  it("approves on a website with four keys: the press's own key is not counted", async () => {
    for (let i = 0; i < 4; i++) await createIntegrationKey(siteA, "Added by hand");
    const { link, verifier } = await press();
    expect(await liveKeys(siteA)).toHaveLength(5);
    await finish(link!, verifier);
    expect(await liveKeys(siteA)).toHaveLength(5);
  });

  it("does not count button keys a newer connection overtook as still waiting", async () => {
    // Three presses whose tabs were never used, then WordPress connected with a newer key.
    for (let i = 0; i < 3; i++) expect((await mintConnectKey(siteA)).ok).toBe(true);
    expect(await mintConnectKey(siteA)).toEqual({ ok: false, reason: "too_many_pending" });
    const connected = await createIntegrationKey(siteA, CONNECT_KEY_LABEL);
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, connected.id));
    expect((await mintConnectKey(siteA)).ok).toBe(true);
  });

  it("can connect again and again: no slots pile up within the grace period", async () => {
    for (let round = 0; round < 4; round++) {
      const { link, verifier } = await press();
      const key = await finish(link!, verifier);
      await verify(post("https://app.example/api/plugin/verify", { pluginVersion: "1.7.0", siteUrl: SITE }, { "x-integration-key": key }));
    }
    expect((await mintConnectKey(siteA)).ok).toBe(true);
  });
});

describe("Connect WordPress in RepGet", () => {
  it("returns a link for plugin 1.7.0, tied to this person and session", async () => {
    const result = await connectWordPress(siteA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.link).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const found = await row(result.data.link!);
    expect(found).toMatchObject({ origin: "repget", websiteId: siteA, createdByUserId: "u_owner", createdSessionId: "s_u_owner", siteHost: null });
  });
});

describe("the page", () => {
  const open = (id: string, error?: string) =>
    ConnectWordPressPage({ searchParams: Promise.resolve({ request: id, ...(error ? { error } : {}) }) } as never);

  it("sends a signed-out visitor to sign in and back", async () => {
    state.session = null;
    await expect(open("abc")).rejects.toThrow(`redirect:/sign-in?next=${encodeURIComponent("/connect/wordpress?request=abc")}`);
  });

  it("on the old Vercel address (plugin 1.7.0's default), moves to repget.com before asking anyone to sign in", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    try {
      state.host = "full-stack-sass-ai-seo-improvement.vercel.app";
      state.session = null;
      await expect(open("abc")).rejects.toThrow("redirect:https://www.repget.com/connect/wordpress?request=abc");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("goes straight back to WordPress for the session that pressed Connect WordPress", async () => {
    const result = await connectWordPress(siteA);
    if (!result.ok) throw new Error(result.error);
    await startHandshake(startInput({ link: result.data.link }), null, CALLER);
    await expect(open(result.data.link!)).rejects.toThrow(/^redirect:https:\/\/imagestudio\.example\/wp-admin\/admin\.php\?page=repget&repget_connect=callback&request=/);
    expect((await row(result.data.link!)).approvedAt).not.toBeNull();
  });

  it("asks before moving a site, naming the workspace it leaves", async () => {
    const held = await createIntegrationKey(siteB);
    const started = await startHandshake(startInput(), held.key, CALLER);
    if (!started.ok) throw new Error(started.error);
    const html = renderToStaticMarkup(await open(started.id));
    expect(html).toContain("Connect imagestudio.example to RepGet?");
    expect(html).toContain("The WordPress site at https://imagestudio.example/ will publish");
    expect(html).toContain("connected to www.imagestudio.example in workspace “Second Account”");
    expect(html).toContain("Move imagestudio.example to “Photo Booth Studio”");
    expect(html).toContain("Connect imagestudio.example again");
    expect(html).not.toContain("Stranger Co");
    expect((await row(started.id)).approvedAt).toBeNull();
  });

  it("says when the host is in none of this person's websites", async () => {
    as("u_viewer", ORG_A);
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    const html = renderToStaticMarkup(await open(started.id));
    expect(html).toContain("imagestudio.example isn’t in this RepGet account yet");
  });

  it("approves and cancels through its buttons", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    await open(started.id);
    const form = new FormData();
    form.set("request", started.id);
    form.set("websiteId", siteC);
    await expect(approveConnection(form)).rejects.toThrow(`redirect:/connect/wordpress?request=${started.id}&error=not_allowed`);
    form.set("websiteId", siteA);
    await expect(approveConnection(form)).rejects.toThrow(/^redirect:https:\/\/imagestudio\.example\/.*code=/);

    const other = await startHandshake(startInput(), null, CALLER);
    if (!other.ok) throw new Error(other.error);
    await open(other.id);
    const cancel = new FormData();
    cancel.set("request", other.id);
    await expect(cancelConnection(cancel)).rejects.toThrow(/^redirect:https:\/\/imagestudio\.example\/.*repget_connect=cancelled/);
    const [gone] = await test.db
      .select({ open: sql<boolean>`${pluginConnectRequests.expiresAt} > localtimestamp` })
      .from(pluginConnectRequests)
      .where(and(eq(pluginConnectRequests.id, other.id)));
    expect(gone.open).toBe(false);
  });
});
