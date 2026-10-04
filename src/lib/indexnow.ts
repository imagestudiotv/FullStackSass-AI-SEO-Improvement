import "server-only";

import { after } from "next/server";

import { isProductionDeployment } from "@/lib/deployment";
import { siteUrl } from "@/lib/site-url";

/**
 * IndexNow: tells Bing - and the other engines that share IndexNow, such as
 * Yandex, Seznam and Naver - that a page on RepGet's own site changed, so it
 * is recrawled within hours instead of whenever the crawler next comes by
 * (client's launch review, 2026-10-03). Google does not take part; it still
 * learns from the sitemap and Search Console.
 *
 * Only RepGet's own public pages - today the blog (lib/admin/blog.ts).
 * Customers' articles live on their sites, under their own ownership proof.
 *
 * Never in the way: the report is sent after the response (next/server
 * after), so a slow or failing IndexNow cannot delay or fail the save that
 * changed the page. A failure is logged and dropped - the sitemap still
 * carries the change, just later.
 *
 * Production only (lib/deployment.ts): a preview, a laptop or a test run must
 * never announce pages as repget.com's.
 */

/**
 * The site's IndexNow key. NOT A SECRET: the protocol proves the site is ours
 * by fetching the same key back from public/<key>.txt, so it is public by
 * design. Change both together - indexnow.test.ts fails if they drift.
 */
export const INDEXNOW_KEY = "6e730dc25ed57ce78519e5391b3bb7f0";

/** The shared endpoint; it passes each report on to every IndexNow engine. */
const DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Long enough for a healthy endpoint, short enough not to hold a function open. */
const TIMEOUT_MS = 5_000;

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

/**
 * The report for some paths of this site, or null when there is nothing to
 * report. Each path becomes the absolute address it is canonical at; a
 * duplicate is sent once, and an address on any other host is left out - the
 * engines reject a report naming a host the key does not belong to.
 */
export function indexNowPayload(paths: readonly string[], site: string = siteUrl()): IndexNowPayload | null {
  const origin = new URL(site);
  const urlList = [
    ...new Set(
      paths
        .map((path) => new URL(path, origin))
        .filter((url) => url.host === origin.host)
        .map((url) => url.toString()),
    ),
  ];
  if (urlList.length === 0) return null;
  return {
    host: origin.host,
    key: INDEXNOW_KEY,
    keyLocation: `${origin.origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

/**
 * Sends one report and returns the HTTP status: 200 or 202 is accepted (202:
 * the key is still being checked); 403 is a key the engines could not fetch
 * back, 422 an address not on the key's host, 429 too many reports.
 *
 * INDEXNOW_ENDPOINT replaces the endpoint, for checking the report against a
 * local stand-in. It is never set on a real deployment.
 */
export async function submitToIndexNow(
  payload: IndexNowPayload,
  {
    endpoint = process.env.INDEXNOW_ENDPOINT?.trim() || DEFAULT_ENDPOINT,
    fetchImpl = fetch,
    timeoutMs = TIMEOUT_MS,
  }: { endpoint?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<number> {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  return response.status;
}

/**
 * Reports that these paths changed - added, updated or gone - once the
 * current response is finished. Never throws and never waits: whatever
 * happens to the report, the caller's save has already succeeded.
 */
export function notifyIndexNow(paths: readonly string[]): void {
  try {
    if (!isProductionDeployment()) return;
    const payload = indexNowPayload(paths);
    if (!payload) return;
    after(async () => {
      try {
        const status = await submitToIndexNow(payload);
        if (status !== 200 && status !== 202) {
          console.warn(`[indexnow] HTTP ${status} for ${payload.urlList.join(", ")}`);
        }
      } catch (error) {
        console.warn(`[indexnow] not sent: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  } catch (error) {
    // after() outside a request, a malformed site address: never the caller's problem.
    console.warn(`[indexnow] not scheduled: ${error instanceof Error ? error.message : String(error)}`);
  }
}
