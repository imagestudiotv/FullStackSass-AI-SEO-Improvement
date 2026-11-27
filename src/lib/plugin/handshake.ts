import crypto from "node:crypto";

import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys, member, organization, pluginConnectRequests, websiteMembers, websites } from "@/lib/db/schema";
import { isInternalHostname } from "@/lib/net/ip";
import { installAddress, lookupIntegrationKey, mintHandshakeKey, roomForHandshakeKey } from "@/lib/plugin/keys";

/**
 * One-click connect for plugin 1.7.0: the key travels once, server to
 * server, and is never shown, copied or put in a URL. The protocol, its
 * three flows and why each check exists: docs/wordpress-connect.md.
 *
 * In short, an OAuth-style authorization code with PKCE:
 *
 *   1. WordPress registers a request (startHandshake): its address, where to
 *      come back to, its state and a PKCE challenge. The browser only ever
 *      carries the request's id.
 *   2. A signed-in RepGet editor approves it on /connect/wordpress
 *      (approveHandshake) and is sent back to the STORED return address
 *      with a one-time code.
 *   3. WordPress exchanges the code and its PKCE verifier for a key
 *      (exchangeHandshakeCode), server to server.
 *
 * Every time that is compared is on the DATABASE's clock (localtimestamp),
 * like the key tidy-up in keys.ts: the rows are stamped by it, and the app's
 * clock and the database's session time zone need not agree.
 */

/** A request started from RepGet's "Connect WordPress" waits this long for WordPress. */
export const REPGET_REQUEST_TTL_SECS = 30 * 60;
/** A request started in WordPress waits this long for someone to approve it. */
export const WORDPRESS_REQUEST_TTL_SECS = 15 * 60;
/** The one-time code is valid this long after approval. */
export const CODE_TTL_SECS = 5 * 60;
/*
  LIMITS. Start needs no credentials, and a request names whatever site its
  caller likes, so nothing is limited per SITE: a cap there would let anyone
  lock a site out of connecting by sending requests in its name. Instead:

   - per CALLER (the address that called start - a WordPress server): at most
     MAX_OPEN_PER_CALLER open requests, else 429 for that caller alone;
   - in all: at most MAX_OPEN_TOTAL open requests. A new one makes room by
     dropping the oldest that has no live code (see makeRoom): only a
     distributed flood gets there, and then it pushes itself out.

  A "Connect WordPress" link is attached before any of this: it adds no row,
  and a RepGet editor made it.
*/
export const MAX_OPEN_PER_CALLER = 30;
export const MAX_OPEN_TOTAL = 5000;
/**
 * A request that issued a key is kept this long past expiry, then deleted
 * when the next row is written: the step that retires a moved site's old key
 * reads it when the new key first verifies, which may be just after expiry.
 * Any other request is deleted as soon as it (and its code) has expired.
 */
const KEEP_USED_SECS = 24 * 60 * 60;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;
/** RFC 7636's verifier alphabet and length. Empty means "use this code up". */
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;

/** 32 random bytes, base64url: 43 characters. Request ids and codes. */
function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest();

/** Lower-case and without "www.": the rule acceptableSyncUrl uses for check-now addresses. */
export function bareHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

/** The same, for a website's stored domain (normally a bare host already). */
const bareDomainSql = sql`regexp_replace(lower(${websites.domain}), '^www\\.', '')`;

const expiresIn = (secs: number) => sql`localtimestamp + make_interval(secs => ${secs})`;
const notExpired = gt(pluginConnectRequests.expiresAt, sql`localtimestamp`);

/* ------------------------------------------------------------------------ */
/* 1. WordPress registers a request                                         */
/* ------------------------------------------------------------------------ */

export type StartInput = {
  siteUrl: unknown;
  returnUrl: unknown;
  state: unknown;
  challenge: unknown;
  pluginVersion: unknown;
  link: unknown;
};

export type ParsedStart = {
  siteUrl: string;
  host: string;
  returnUrl: string;
  state: string;
  challenge: string;
  pluginVersion: string | null;
  link: string | null;
};

function publicUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname || isInternalHostname(url.hostname)) return null;
  return url;
}

/**
 * What start accepts, checked before anything is stored. Pure, for the tests.
 *
 * The return address must be this site's own wp-admin/admin.php: RepGet
 * redirects a browser there with a one-time code, so an address on another
 * host would hand the code to whoever named it.
 */
export function parseStart(input: StartInput): { ok: true; value: ParsedStart } | { ok: false; error: string } {
  // Shown to the WordPress admin: said so they can act on it.
  const useKey = "Connect with a key instead: in RepGet, open Integrations \u2192 WordPress plugin \u2192 Keys (advanced) \u2192 New key, then paste it here under Advanced: use an Integration Key.";
  const site = publicUrl(input.siteUrl);
  if (!site) {
    return { ok: false, error: `This site's address is not a public web address, so one-click connect cannot reach it. ${useKey}` };
  }
  const back = publicUrl(input.returnUrl);
  if (!back || !back.pathname.endsWith("/wp-admin/admin.php")) {
    return { ok: false, error: `This site's admin address is not a public web address ending in /wp-admin/admin.php. ${useKey}` };
  }
  const host = bareHost(site.hostname);
  if (bareHost(back.hostname) !== host) {
    return { ok: false, error: `This site's admin runs on a different address from the site itself, so one-click connect cannot be used. ${useKey}` };
  }
  /*
    And only the RepGet screen itself: admin.php?page=<anything> is any
    plugin's screen, and one that redirects on a query parameter would carry
    the code to whoever registered the request - who holds its verifier.
  */
  const query = [...back.searchParams.entries()];
  const repgetScreen =
    back.searchParams.get("page") === "repget" &&
    query.every(([name, value]) => (name === "page" && value === "repget") || (name === "repget_connect" && value === "callback"));
  if (!repgetScreen) {
    return { ok: false, error: "returnUrl must be the RepGet screen: admin.php?page=repget." };
  }
  if (typeof input.state !== "string" || !STATE_RE.test(input.state)) {
    return { ok: false, error: "state must be 16-128 URL-safe characters." };
  }
  if (typeof input.challenge !== "string" || !TOKEN_RE.test(input.challenge)) {
    return { ok: false, error: "challenge must be a base64url SHA-256 (PKCE S256)." };
  }
  back.hash = "";
  return {
    ok: true,
    value: {
      siteUrl: site.toString(),
      host,
      returnUrl: back.toString(),
      state: input.state,
      challenge: input.challenge,
      pluginVersion:
        typeof input.pluginVersion === "string" && /^[0-9A-Za-z.+-]{1,20}$/.test(input.pluginVersion)
          ? input.pluginVersion
          : null,
      link: typeof input.link === "string" && TOKEN_RE.test(input.link) ? input.link : null,
    },
  };
}

export type StartOutcome =
  | { ok: true; id: string }
  | { ok: false; status: 400 | 429; error: string };

type Executor = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;

async function pruneExpired(tx: Executor) {
  await tx.delete(pluginConnectRequests).where(
    sql`(
      ${pluginConnectRequests.expiresAt} < localtimestamp - make_interval(secs => ${KEEP_USED_SECS})
      or (
        ${pluginConnectRequests.expiresAt} < localtimestamp
        and ${pluginConnectRequests.consumedAt} is null
        and (${pluginConnectRequests.codeExpiresAt} is null or ${pluginConnectRequests.codeExpiresAt} < localtimestamp)
      )
    )`,
  );
}

/**
 * Test hook: runs inside start right after makeRoom chose which requests to
 * drop, before it drops them. The concurrency test approves one of them here
 * to prove the drop checks again. Never set outside tests.
 */
export const handshakeTestHooks: { afterRoomChosen?: (ids: string[]) => Promise<void> } = {};

/** Open, and without a code that can still be exchanged: may give way to a new request. */
const replaceable = sql`(
  ${pluginConnectRequests.consumedAt} is null
  and (${pluginConnectRequests.approvedAt} is null or ${pluginConnectRequests.codeExpiresAt} <= localtimestamp)
)`;

/**
 * Room for one more open request within MAX_OPEN_TOTAL: the oldest open
 * requests without a live code give way. Only a request whose code is out
 * (approved, not yet exchanged - minutes at most) is never dropped: holding
 * one takes a RepGet editor's approval. The delete checks that again, so a
 * request approved meanwhile stays. False when there is no room even so.
 */
async function makeRoom(tx: Executor): Promise<boolean> {
  const open = await tx
    .select({ id: pluginConnectRequests.id, replaceable: sql<boolean>`${replaceable}` })
    .from(pluginConnectRequests)
    .where(and(isNotNull(pluginConnectRequests.siteHost), isNull(pluginConnectRequests.consumedAt), notExpired))
    .orderBy(asc(pluginConnectRequests.createdAt));
  const excess = open.length - MAX_OPEN_TOTAL + 1;
  if (excess <= 0) return true;
  const victims = open.filter((row) => row.replaceable).slice(0, excess);
  if (victims.length < excess) return false;
  if (handshakeTestHooks.afterRoomChosen) await handshakeTestHooks.afterRoomChosen(victims.map((row) => row.id));
  await tx.delete(pluginConnectRequests).where(
    and(
      inArray(
        pluginConnectRequests.id,
        victims.map((row) => row.id),
      ),
      replaceable,
    ),
  );
  return true;
}

/** Who called start, as stored: a hash of the address, never the address. */
export function callerHash(address: string | null): string {
  return crypto.createHash("sha256").update(`plugin-connect:${address ?? "unknown"}`).digest("hex").slice(0, 32);
}

/**
 * Registers a connection request for a WordPress site and returns its id.
 *
 * With a `link` (the id "Connect WordPress" put in the WordPress address),
 * the site is attached to THAT request - only while it is open, still
 * without a site, and for a website whose domain is this host. Anything else
 * starts a fresh request, which then needs someone to approve it.
 *
 * `presentedKey` is the key the plugin holds now, if any: looked up without
 * recording use, and a bad one is simply ignored.
 */
export async function startHandshake(
  input: StartInput,
  presentedKey: string | null,
  /** The address that called start (x-real-ip): the per-caller limit. */
  caller: string | null,
): Promise<StartOutcome> {
  const parsed = parseStart(input);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const start = parsed.value;
  const presented = await lookupIntegrationKey(presentedKey);

  const registered = {
    siteUrl: start.siteUrl,
    siteHost: start.host,
    returnUrl: start.returnUrl,
    pluginState: start.state,
    codeChallenge: start.challenge,
    pluginVersion: start.pluginVersion,
    presentedKeyId: presented?.keyId ?? null,
  };

  const by = callerHash(caller);

  return db.transaction(async (tx) => {
    // One at a time, so the limits below cannot be overrun by requests arriving together.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('plugin-connect-start'))`);
    await pruneExpired(tx);

    // First: attaching the link from "Connect WordPress" adds no row, and a
    // RepGet editor made that link - no limit applies to it.
    if (start.link) {
      const attached = await tx
        .update(pluginConnectRequests)
        .set(registered)
        .where(
          and(
            eq(pluginConnectRequests.id, start.link),
            eq(pluginConnectRequests.origin, "repget"),
            notExpired,
            isNull(pluginConnectRequests.siteHost),
            isNull(pluginConnectRequests.approvedAt),
            isNull(pluginConnectRequests.consumedAt),
            sql`exists (
              select 1 from websites w
              where w.id = plugin_connect_requests.website_id
                and regexp_replace(lower(w.domain), '^www\\.', '') = ${start.host}
            )`,
          ),
        )
        .returning({ id: pluginConnectRequests.id });
      if (attached.length > 0) return { ok: true as const, id: start.link };
    }

    const [mine] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(pluginConnectRequests)
      .where(and(eq(pluginConnectRequests.callerHash, by), isNull(pluginConnectRequests.consumedAt), notExpired));
    if ((mine?.n ?? 0) >= MAX_OPEN_PER_CALLER || !(await makeRoom(tx))) {
      return { ok: false as const, status: 429 as const, error: "Too many connection attempts from this server. Try again in 15 minutes." };
    }

    const id = newToken();
    await tx.insert(pluginConnectRequests).values({
      id,
      origin: "wordpress",
      ...registered,
      callerHash: by,
      expiresAt: expiresIn(WORDPRESS_REQUEST_TTL_SECS),
    });
    return { ok: true as const, id };
  });
}

/**
 * The link "Connect WordPress" puts in the WordPress address (flow A): a
 * request made by this person, in this browser session, for this website,
 * which plugin 1.7.0 attaches its site to. Approved without asking when the
 * same session comes back with it (see loadForViewer).
 */
export async function createConnectLink(
  websiteId: string,
  userId: string,
  sessionId: string,
  /** The key made in the same press for plugin 1.6 (see mintHandshakeKey). */
  linkKeyId: string | null,
): Promise<string> {
  const id = newToken();
  await db.transaction(async (tx) => {
    await pruneExpired(tx);
    await tx.insert(pluginConnectRequests).values({
      id,
      origin: "repget",
      websiteId,
      createdByUserId: userId,
      createdSessionId: sessionId,
      linkKeyId,
      expiresAt: expiresIn(REPGET_REQUEST_TTL_SECS),
    });
  });
  return id;
}

/* ------------------------------------------------------------------------ */
/* 2. A RepGet editor approves it                                           */
/* ------------------------------------------------------------------------ */

export type Candidate = {
  websiteId: string;
  domain: string;
  brandName: string | null;
  organizationId: string;
  workspaceName: string;
};

/**
 * Websites this person may connect a WordPress site on `host` to: in ANY of
 * their workspaces, or invited to as an editor (website_members), whose
 * domain is this host. Never anyone else's.
 */
export async function connectCandidates(userId: string, host: string): Promise<Candidate[]> {
  return db
    .selectDistinct({
      websiteId: websites.id,
      domain: websites.domain,
      brandName: websites.brandName,
      organizationId: websites.organizationId,
      workspaceName: organization.name,
    })
    .from(websites)
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(member, and(eq(member.organizationId, websites.organizationId), eq(member.userId, userId)))
    .leftJoin(
      websiteMembers,
      and(eq(websiteMembers.websiteId, websites.id), eq(websiteMembers.userId, userId), eq(websiteMembers.role, "editor")),
    )
    .where(and(sql`${bareDomainSql} = ${bareHost(host)}`, sql`(${member.id} is not null or ${websiteMembers.id} is not null)`))
    .orderBy(organization.name, websites.domain);
}

export type PresentedKey = {
  websiteId: string;
  organizationId: string;
  /** Only when the person belongs to that workspace: never another customer's name. */
  workspaceName: string | null;
  /** Likewise: that website's domain, only for a workspace the person is in. */
  domain: string | null;
};

export type ViewerRequest = {
  id: string;
  origin: "repget" | "wordpress";
  siteHost: string;
  siteUrl: string;
  /**
   * The WordPress the code goes back to: its admin address without
   * wp-admin/admin.php. What the page shows - the site address is only what
   * the plugin said, and another install on the same host could name it.
   */
  wordpressAt: string;
  /** The website "Connect WordPress" was pressed on (flow A), if any. */
  websiteId: string | null;
  createdSessionId: string | null;
};

export type ViewerOutcome =
  /** Unknown, expired, used or cancelled: press Connect to RepGet again. */
  | { state: "gone" }
  /** Another RepGet session opened it first. */
  | { state: "other_browser" }
  | {
      state: "ready";
      request: ViewerRequest;
      candidates: Candidate[];
      /** The key the WordPress site holds now, when it is still live. */
      presented: PresentedKey | null;
      /** Same session that pressed "Connect WordPress", same website, nothing moved: no question to ask. */
      autoApprove: boolean;
    };

const TOKEN_ONLY = (id: string) => TOKEN_RE.test(id);

async function presentedKeyInfo(keyId: string | null, userId: string): Promise<PresentedKey | null> {
  if (!keyId) return null;
  const [row] = await db
    .select({
      websiteId: integrationKeys.websiteId,
      organizationId: websites.organizationId,
      workspaceName: organization.name,
      domain: websites.domain,
      isMember: sql<boolean>`(${member.id} is not null or ${websiteMembers.id} is not null)`,
    })
    .from(integrationKeys)
    .innerJoin(websites, eq(websites.id, integrationKeys.websiteId))
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(member, and(eq(member.organizationId, websites.organizationId), eq(member.userId, userId)))
    .leftJoin(websiteMembers, and(eq(websiteMembers.websiteId, websites.id), eq(websiteMembers.userId, userId)))
    .where(and(eq(integrationKeys.id, keyId), isNull(integrationKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  return {
    websiteId: row.websiteId,
    organizationId: row.organizationId,
    workspaceName: row.isMember ? row.workspaceName : null,
    domain: row.isMember ? row.domain : null,
  };
}

/**
 * What /connect/wordpress shows. The first RepGet session to open a request
 * claims it; any other session is refused, so a request id copied into
 * someone else's browser approves nothing there.
 */
export async function loadForViewer(id: string, viewer: { sessionId: string; userId: string }): Promise<ViewerOutcome> {
  if (!TOKEN_ONLY(id)) return { state: "gone" };

  await db
    .update(pluginConnectRequests)
    .set({ viewerSessionId: viewer.sessionId })
    .where(
      and(
        eq(pluginConnectRequests.id, id),
        notExpired,
        // Only once WordPress has registered it: a link is not a request yet.
        isNotNull(pluginConnectRequests.siteHost),
        isNull(pluginConnectRequests.approvedAt),
        isNull(pluginConnectRequests.consumedAt),
        /*
          A "Connect WordPress" link is the address of the WordPress tab it
          opened, so it can leak (access logs, history); only the session that
          pressed the button may open it. Anyone else would otherwise claim it,
          approve it for a website of their own with the same domain, and hand
          the WordPress admin a callback that connects their site to it.
        */
        sql`(${pluginConnectRequests.origin} <> 'repget' or ${pluginConnectRequests.createdSessionId} = ${viewer.sessionId})`,
        // Unclaimed, or claimed by a session that has since signed out
        // ("Use a different account"): nobody can finish it there any more.
        sql`(${pluginConnectRequests.viewerSessionId} is null or not exists (
          select 1 from "session" s where s.id = plugin_connect_requests.viewer_session_id
        ))`,
      ),
    );

  const [row] = await db
    .select({
      id: pluginConnectRequests.id,
      origin: pluginConnectRequests.origin,
      siteHost: pluginConnectRequests.siteHost,
      siteUrl: pluginConnectRequests.siteUrl,
      returnUrl: pluginConnectRequests.returnUrl,
      websiteId: pluginConnectRequests.websiteId,
      createdSessionId: pluginConnectRequests.createdSessionId,
      viewerSessionId: pluginConnectRequests.viewerSessionId,
      presentedKeyId: pluginConnectRequests.presentedKeyId,
    })
    .from(pluginConnectRequests)
    .where(
      and(
        eq(pluginConnectRequests.id, id),
        notExpired,
        isNotNull(pluginConnectRequests.siteHost),
        isNull(pluginConnectRequests.approvedAt),
        isNull(pluginConnectRequests.consumedAt),
      ),
    )
    .limit(1);
  if (!row || !row.siteHost || !row.siteUrl || !row.returnUrl) return { state: "gone" };
  if (row.viewerSessionId !== viewer.sessionId) return { state: "other_browser" };

  const candidates = await connectCandidates(viewer.userId, row.siteHost);
  const presented = await presentedKeyInfo(row.presentedKeyId, viewer.userId);
  const origin = row.origin === "repget" ? "repget" : "wordpress";
  const autoApprove =
    origin === "repget" &&
    row.createdSessionId === viewer.sessionId &&
    candidates.some((candidate) => candidate.websiteId === row.websiteId) &&
    (!presented || presented.websiteId === row.websiteId);

  return {
    state: "ready",
    request: {
      id: row.id,
      origin,
      siteHost: row.siteHost,
      siteUrl: row.siteUrl,
      wordpressAt: wordpressAt(row.returnUrl),
      websiteId: row.websiteId,
      createdSessionId: row.createdSessionId,
    },
    candidates,
    presented,
    autoApprove,
  };
}

/** ".../wp-admin/admin-ajax.php" for ".../wp-admin/admin.php?page=repget": the same install's check-now address. */
function installFromReturnUrl(returnUrl: string): string {
  const url = new URL(returnUrl);
  url.pathname = url.pathname.replace(/admin\.php$/, "admin-ajax.php");
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** "https://example.com/blog/" for ".../blog/wp-admin/admin.php?page=repget". */
function wordpressAt(returnUrl: string): string {
  const url = new URL(returnUrl);
  return `${url.origin}${url.pathname.slice(0, -"wp-admin/admin.php".length)}`;
}

/** The stored return address with RepGet's answer added. Never any other address. */
function backToWordPress(returnUrl: string, params: Record<string, string>): string {
  const url = new URL(returnUrl);
  url.hash = "";
  if (!url.searchParams.get("page")) url.searchParams.set("page", "repget");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

export type ApproveOutcome =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: "gone" | "other_browser" | "not_allowed" | "too_many_keys" };

/**
 * Approves a request for one of the person's websites: a one-time code,
 * valid CODE_TTL_SECS, and the browser goes back to the address WordPress
 * registered. Everything is checked again here - the page may be old.
 */
export async function approveHandshake(input: {
  id: string;
  websiteId: string;
  sessionId: string;
  userId: string;
}): Promise<ApproveOutcome> {
  if (!TOKEN_ONLY(input.id)) return { ok: false, reason: "gone" };
  const [row] = await db
    .select({
      siteHost: pluginConnectRequests.siteHost,
      returnUrl: pluginConnectRequests.returnUrl,
      pluginState: pluginConnectRequests.pluginState,
      viewerSessionId: pluginConnectRequests.viewerSessionId,
      linkKeyId: pluginConnectRequests.linkKeyId,
      origin: pluginConnectRequests.origin,
      linkWebsiteId: pluginConnectRequests.websiteId,
    })
    .from(pluginConnectRequests)
    .where(
      and(
        eq(pluginConnectRequests.id, input.id),
        notExpired,
        isNull(pluginConnectRequests.approvedAt),
        isNull(pluginConnectRequests.consumedAt),
      ),
    )
    .limit(1);
  if (!row || !row.siteHost || !row.returnUrl || !row.pluginState) return { ok: false, reason: "gone" };
  if (row.viewerSessionId !== input.sessionId) return { ok: false, reason: "other_browser" };

  // A "Connect WordPress" link connects the website it was pressed on, and no other.
  if (row.origin === "repget" && row.linkWebsiteId !== input.websiteId) return { ok: false, reason: "not_allowed" };
  const candidates = await connectCandidates(input.userId, row.siteHost);
  if (!candidates.some((candidate) => candidate.websiteId === input.websiteId)) return { ok: false, reason: "not_allowed" };
  // Asked now, so a full website hears it here and not as an error inside WordPress.
  if (!(await roomForHandshakeKey(input.websiteId, row.linkKeyId))) return { ok: false, reason: "too_many_keys" };

  const code = newToken();
  const approved = await db
    .update(pluginConnectRequests)
    .set({
      websiteId: input.websiteId,
      approvedByUserId: input.userId,
      approvedAt: sql`localtimestamp`,
      codeHash: sha256(code).toString("hex"),
      codeExpiresAt: expiresIn(CODE_TTL_SECS),
    })
    .where(
      and(
        eq(pluginConnectRequests.id, input.id),
        eq(pluginConnectRequests.viewerSessionId, input.sessionId),
        notExpired,
        isNull(pluginConnectRequests.approvedAt),
        isNull(pluginConnectRequests.consumedAt),
      ),
    )
    .returning({ id: pluginConnectRequests.id });
  // Approved twice at once (a double click): only the first code exists.
  if (approved.length === 0) return { ok: false, reason: "gone" };

  return {
    ok: true,
    redirectTo: backToWordPress(row.returnUrl, {
      repget_connect: "callback",
      request: input.id,
      code,
      state: row.pluginState,
    }),
  };
}

/** "Cancel": the request ends and WordPress is told nothing changed. */
export async function cancelHandshake(id: string, sessionId: string): Promise<string | null> {
  if (!TOKEN_ONLY(id)) return null;
  const [row] = await db
    .update(pluginConnectRequests)
    .set({ expiresAt: sql`localtimestamp` })
    .where(
      and(
        eq(pluginConnectRequests.id, id),
        eq(pluginConnectRequests.viewerSessionId, sessionId),
        notExpired,
        isNull(pluginConnectRequests.approvedAt),
        isNull(pluginConnectRequests.consumedAt),
      ),
    )
    .returning({ returnUrl: pluginConnectRequests.returnUrl, state: pluginConnectRequests.pluginState });
  if (!row?.returnUrl || !row.state) return null;
  return backToWordPress(row.returnUrl, { repget_connect: "cancelled", state: row.state });
}

/* ------------------------------------------------------------------------ */
/* 3. WordPress exchanges the code for a key                                */
/* ------------------------------------------------------------------------ */

export type ExchangeOutcome =
  | {
      ok: true;
      key: string;
      website: { id: string; domain: string; name: string };
      workspace: { name: string };
    }
  | { ok: false; error: string };

const REFUSED: ExchangeOutcome = { ok: false, error: "That connection code is not valid. Press Connect to RepGet again." };

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The one-time code and its PKCE verifier, for a key. Once: a wrong code or
 * verifier uses the code up, and a second exchange - even a correct one -
 * finds it consumed. The key is made under the same lock and cap as every
 * other key (mintHandshakeKey).
 */
export async function exchangeHandshakeCode(input: {
  request: unknown;
  code: unknown;
  verifier: unknown;
}): Promise<ExchangeOutcome> {
  if (typeof input.request !== "string" || !TOKEN_ONLY(input.request)) return REFUSED;
  if (typeof input.code !== "string" || !TOKEN_ONLY(input.code)) return REFUSED;
  const requestId = input.request;
  const code = input.code;
  const verifier = typeof input.verifier === "string" && VERIFIER_RE.test(input.verifier) ? input.verifier : null;

  const outcome = await db.transaction(async (tx): Promise<ExchangeOutcome | "burn"> => {
    const [row] = await tx
      .select({
        websiteId: pluginConnectRequests.websiteId,
        codeHash: pluginConnectRequests.codeHash,
        codeChallenge: pluginConnectRequests.codeChallenge,
        linkKeyId: pluginConnectRequests.linkKeyId,
        returnUrl: pluginConnectRequests.returnUrl,
        live: sql<boolean>`${pluginConnectRequests.codeExpiresAt} > localtimestamp`,
      })
      .from(pluginConnectRequests)
      .where(
        and(
          eq(pluginConnectRequests.id, requestId),
          isNotNull(pluginConnectRequests.approvedAt),
          isNull(pluginConnectRequests.consumedAt),
          isNotNull(pluginConnectRequests.codeHash),
        ),
      )
      .for("update")
      .limit(1);
    if (!row || !row.websiteId || !row.codeHash || !row.codeChallenge || !row.live) return REFUSED;

    const codeMatches = sameBytes(sha256(code), Buffer.from(row.codeHash, "hex"));
    const verifierMatches =
      verifier !== null && sameBytes(Buffer.from(sha256(verifier).toString("base64url")), Buffer.from(row.codeChallenge));
    if (!codeMatches || !verifierMatches) return "burn";

    const consumed = await tx
      .update(pluginConnectRequests)
      .set({ consumedAt: sql`localtimestamp`, codeHash: null })
      .where(and(eq(pluginConnectRequests.id, requestId), isNull(pluginConnectRequests.consumedAt)))
      .returning({ id: pluginConnectRequests.id });
    if (consumed.length === 0) return REFUSED;

    const minted = await mintHandshakeKey(tx, row.websiteId, row.linkKeyId);
    if (!minted.ok) {
      return { ok: false, error: "This website already has 5 keys in RepGet. Revoke one you no longer use under Integrations → Keys (advanced), then connect again." };
    }
    await tx
      .update(pluginConnectRequests)
      .set({ issuedKeyId: minted.id })
      .where(eq(pluginConnectRequests.id, requestId));
    /*
      The key's install is the WordPress that asked for it - its check-now
      address, beside the admin.php it registered - known now, before any
      copy of the site could report it (lib/plugin/keys.ts, revokeForDisconnect).
    */
    const install = row.returnUrl ? installAddress(installFromReturnUrl(row.returnUrl)) : null;
    if (install) {
      await tx
        .update(integrationKeys)
        .set({ installUrl: install, installSince: sql`localtimestamp` })
        .where(eq(integrationKeys.id, minted.id));
    }

    const [site] = await tx
      .select({ id: websites.id, domain: websites.domain, brandName: websites.brandName, workspace: organization.name })
      .from(websites)
      .innerJoin(organization, eq(organization.id, websites.organizationId))
      .where(eq(websites.id, row.websiteId))
      .limit(1);
    if (!site) return REFUSED;
    return {
      ok: true,
      key: minted.key,
      website: { id: site.id, domain: site.domain, name: site.brandName?.trim() || site.domain },
      workspace: { name: site.workspace },
    };
  });

  if (outcome !== "burn") return outcome;
  // Outside the transaction above, which returned rather than threw: the code is used up either way.
  await db
    .update(pluginConnectRequests)
    .set({ codeHash: null })
    .where(and(eq(pluginConnectRequests.id, requestId), isNull(pluginConnectRequests.consumedAt)));
  return REFUSED;
}

/* ------------------------------------------------------------------------ */
/* 4. The new key's first check: a site moved from another website          */
/* ------------------------------------------------------------------------ */

export type RetiredKey = {
  keyId: string;
  websiteId: string;
  organizationId: string;
  domain: string;
  /** The website the site moved TO. */
  movedToOrganizationId: string;
};

/**
 * When a key issued by a handshake first verifies: the key that WordPress
 * site held before, if it belongs to a DIFFERENT website - the site was
 * moved to another website or account (flow C) - is revoked. Only now, never
 * earlier: a connect that fails leaves the working site as it was.
 *
 * A previous key of the SAME website is left alone here. A staging copy
 * reports the same address and holds the same key, and reconnecting it must
 * not cut the live site off; tidyKeys retires a replaced key once it has been
 * silent for a day (lib/plugin/keys.ts).
 *
 * Once: the request forgets the old key as it is handled.
 */
export async function retirePresentedKey(issuedKeyId: string): Promise<RetiredKey | null> {
  // Every verify comes through here; almost none has anything to do.
  const [pending] = await db
    .select({ id: pluginConnectRequests.id })
    .from(pluginConnectRequests)
    .where(and(eq(pluginConnectRequests.issuedKeyId, issuedKeyId), isNotNull(pluginConnectRequests.presentedKeyId)))
    .limit(1);
  if (!pending) return null;

  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: pluginConnectRequests.id,
        presentedKeyId: pluginConnectRequests.presentedKeyId,
        websiteId: pluginConnectRequests.websiteId,
      })
      .from(pluginConnectRequests)
      .where(and(eq(pluginConnectRequests.issuedKeyId, issuedKeyId), isNotNull(pluginConnectRequests.presentedKeyId)))
      .for("update")
      .limit(1);
    if (!request?.presentedKeyId || !request.websiteId) return null;
    await tx.update(pluginConnectRequests).set({ presentedKeyId: null }).where(eq(pluginConnectRequests.id, request.id));

    const oldKeyId = request.presentedKeyId;
    if (oldKeyId === issuedKeyId) return null;
    const [old] = await tx
      .select({ websiteId: integrationKeys.websiteId, organizationId: websites.organizationId, domain: websites.domain })
      .from(integrationKeys)
      .innerJoin(websites, eq(websites.id, integrationKeys.websiteId))
      .where(eq(integrationKeys.id, oldKeyId))
      .limit(1);
    if (!old || old.websiteId === request.websiteId) return null;

    const now = new Date();
    const revoked = await tx
      .update(integrationKeys)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(eq(integrationKeys.id, oldKeyId), isNull(integrationKeys.revokedAt)))
      .returning({ id: integrationKeys.id });
    if (revoked.length === 0) return null;

    const [movedTo] = await tx
      .select({ organizationId: websites.organizationId })
      .from(websites)
      .where(eq(websites.id, request.websiteId))
      .limit(1);
    return {
      keyId: oldKeyId,
      websiteId: old.websiteId,
      organizationId: old.organizationId,
      domain: old.domain,
      movedToOrganizationId: movedTo?.organizationId ?? "",
    };
  });
}
