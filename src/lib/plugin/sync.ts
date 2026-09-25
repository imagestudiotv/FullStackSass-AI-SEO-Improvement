import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

import { and, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys, websites } from "@/lib/db/schema";
import { dueArticlesForPlugin } from "@/lib/plugin/due";

/**
 * "Check now" for the WordPress plugin, so Publish publishes immediately.
 *
 * The plugin PULLS: it asks RepGet for due articles every hour. A Publish
 * press therefore used to wait up to an hour, or for the customer to press
 * "Check for articles now" inside WordPress - and the client's rule is that
 * pressing Publish publishes. From 1.4.0 the plugin exposes one action on its
 * own site that runs that same check, and RepGet calls it after a press.
 *
 * admin-ajax.php rather than the REST API: the plugin exists for sites whose
 * host blocks /wp-json, and admin-ajax is what every WordPress site keeps
 * open for its own front end.
 *
 * AUTHENTICATION without a new secret. RepGet stores only the SHA-256 of the
 * integration key; the plugin holds the key itself and can compute the same
 * hash. That hash signs a timestamp (HMAC-SHA256), the plugin rejects
 * anything older than five minutes or seen before, and all a valid call can
 * do is make the plugin fetch its own due articles from RepGet - nothing an
 * attacker could steer.
 */

/** Long enough to create a post and pull in its featured image. */
const SYNC_TIMEOUT_MS = 60_000;

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * The plugin's check-now address, if it is safe to call.
 *
 * Only http(s), and only on the website's own domain. The plugin reports
 * this address itself, so without the domain check a key holder could point
 * RepGet's servers at any URL - an internal address included.
 */
export function acceptableSyncUrl(
  value: unknown,
  websiteDomain: string,
): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const domain = bare(websiteDomain.replace(/^https?:\/\//, "").split("/")[0]);
  if (bare(url.hostname) !== domain) return null;
  if (!url.pathname.endsWith("/admin-ajax.php")) return null;
  return url.toString();
}

/** Stores the address a plugin reported, when it changed and is acceptable. */
export async function recordSyncUrl(
  keyId: string,
  websiteDomain: string,
  reported: unknown,
): Promise<void> {
  const url = acceptableSyncUrl(reported, websiteDomain);
  if (!url) return;
  await db
    .update(integrationKeys)
    .set({ syncUrl: url, updatedAt: new Date() })
    // Only when it changed: every hourly check reports it.
    .where(
      and(
        eq(integrationKeys.id, keyId),
        or(isNull(integrationKeys.syncUrl), ne(integrationKeys.syncUrl, url)),
      ),
    );
}

export type SyncOutcome =
  /** The plugin ran its check; anything due has been created. */
  | "synced"
  /** A plugin before 1.4.0, or one that has not reported its address yet. */
  | "no-endpoint"
  /** The site did not answer, or refused. The article stays queued. */
  | "unreachable";

/** Asks the website's plugin to collect its due articles now. */
export async function triggerPluginSync(websiteId: string): Promise<SyncOutcome> {
  const [key] = await db
    .select({ keyHash: integrationKeys.keyHash, syncUrl: integrationKeys.syncUrl })
    .from(integrationKeys)
    .innerJoin(websites, eq(websites.id, integrationKeys.websiteId))
    .where(
      and(
        eq(integrationKeys.websiteId, websiteId),
        isNull(integrationKeys.revokedAt),
        isNotNull(integrationKeys.lastUsedAt),
        isNotNull(integrationKeys.syncUrl),
      ),
    )
    .orderBy(desc(integrationKeys.lastUsedAt))
    .limit(1);
  if (!key?.syncUrl) return "no-endpoint";

  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac("sha256", key.keyHash).update(ts).digest("hex");

  const body = new URLSearchParams({ action: "repget_sync", ts, sig }).toString();
  const result = await postForm(key.syncUrl, body);
  if (!result || result.status < 200 || result.status >= 300) return "unreachable";
  try {
    const data = JSON.parse(result.body) as { success?: boolean };
    return data.success ? "synced" : "unreachable";
  } catch {
    return "unreachable";
  }
}

/**
 * Asks the plugin to check now - but only when it has something to collect.
 *
 * The plugin's own hourly check is WordPress cron, which only runs when
 * somebody visits the site: imagestudio.com's first article sat written for
 * 21 minutes after the plugin connected, until a visit happened to run it.
 * RepGet therefore nudges the plugin at the moments something becomes due -
 * when the plugin connects, when an article finishes writing, and on each
 * scheduled release - so plugin sites publish on time without visitors.
 *
 * A no-op when nothing is due, or for plugins before 1.4.0 (no address).
 */
export async function nudgePluginIfDue(
  websiteId: string,
): Promise<SyncOutcome | "nothing-due"> {
  const [due] = await dueArticlesForPlugin(websiteId, 1);
  if (!due) return "nothing-due";
  return triggerPluginSync(websiteId);
}

/**
 * One plain HTTP(S) POST, and nothing else.
 *
 * node:https rather than fetch, deliberately. fetch always adds headers of
 * its own - sec-fetch-mode, accept-language, accept-encoding - and the web
 * host's firewall in front of imagestudio.com refused every such request with
 * a bare 403 before WordPress saw it, whatever user agent was sent, while the
 * identical request from curl got through. This sends only the headers below,
 * like curl does. No redirects are followed: the stored address is the only
 * one ever called.
 */
function postForm(
  url: string,
  body: string,
): Promise<{ status: number; body: string } | null> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      resolve(null);
      return;
    }
    const client = target.protocol === "http:" ? http : https;
    const request = client.request(
      {
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout: SYNC_TIMEOUT_MS,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": Buffer.byteLength(body),
          accept: "application/json",
          /*
            Named, so a site owner reading their logs can see who is calling
            and allow it. Node's own default ("node") is blocked outright by
            many firewalls.
          */
          "user-agent": "RepGet/1.0 (+https://repget.com; WordPress plugin sync)",
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          // A check-now reply is a few bytes of JSON; stop reading garbage.
          if (text.length < 10_000) text += chunk;
        });
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body: text }),
        );
      },
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
    request.end(body);
  });
}
