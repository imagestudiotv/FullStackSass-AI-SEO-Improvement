import { lookup } from "node:dns/promises";

/**
 * Checks that a suggested competitor domain actually exists.
 *
 * WHY THIS IS NEEDED: competitors are the one field the extractor is allowed
 * to infer rather than read off the page, and a language model asked for
 * "likely competitor domains" produces plausible-looking names that were never
 * registered. In a real account, 7 of 20 stored competitors did not resolve or
 * serve a page — four had no DNS record at all. The customer clicked them and
 * got nothing.
 *
 * That is worse than showing no competitors. A made-up domain presented as
 * "your competitor" is a factual claim about their market that we invented,
 * and it also poisons everything downstream: keyword research and content gap
 * analysis read this list, so an imaginary rival quietly shapes real articles.
 *
 * TWO CHECKS, DELIBERATELY IN THIS ORDER:
 *   1. DNS — catches the outright invention, costs a few milliseconds.
 *   2. HTTP — catches parked domains and dead hosts that still have a record.
 *
 * A domain that resolves but refuses our request is KEPT. Cloudflare and
 * similar routinely return 403 to a bare server-side fetch while serving real
 * visitors perfectly; discarding those would throw away real competitors to
 * avoid a cosmetic problem.
 */

/** How long to wait for one domain before giving up on it. */
const TIMEOUT_MS = 6000;

/**
 * Statuses that mean "there is a real site here", beyond the obvious 2xx.
 *
 * 401/403 are access refusals, which prove a server is there and answering.
 * 405 means the method was wrong, not the domain. Anything in this set counts
 * as alive even though it is not a page we could read.
 */
const ALIVE_STATUSES = new Set([401, 403, 405, 429]);

export type DomainCheck = { domain: string; alive: boolean; reason: string };

export async function verifyDomain(domain: string): Promise<DomainCheck> {
  // No DNS record: the domain was invented, or has lapsed. Nothing else to try.
  try {
    await lookup(domain);
  } catch {
    return { domain, alive: false, reason: "no DNS record" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    /**
     * HEAD rather than GET: we only need the status, and a competitor's
     * homepage can be megabytes. Falls back to GET below, because some servers
     * reject HEAD outright.
     */
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Without a real agent string many hosts answer 403 to anything that
        // looks automated, which would fail domains that are perfectly alive.
        "user-agent":
          "Mozilla/5.0 (compatible; RepGetBot/1.0; +https://repget.com/bot)",
      },
    });

    if (response.ok || ALIVE_STATUSES.has(response.status)) {
      return { domain, alive: true, reason: `http ${response.status}` };
    }
    return { domain, alive: false, reason: `http ${response.status}` };
  } catch {
    /**
     * The request failed — a refused connection, an expired certificate, a
     * timeout, or a host that will not answer HEAD.
     *
     * DNS already told us the domain is registered and pointed somewhere, so
     * this is kept rather than discarded: the common causes are our own
     * request being blocked, not the site being absent. The invented domains
     * this function exists to catch fail at the DNS step above.
     */
    return { domain, alive: true, reason: "registered, no response" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Filters a list of suggested domains down to the ones that exist.
 *
 * Checked in parallel: these are independent network calls and a list of five
 * would otherwise add half a minute to website analysis.
 */
export async function keepLiveDomains(domains: string[]): Promise<{
  live: string[];
  dropped: DomainCheck[];
}> {
  const results = await Promise.all(domains.map(verifyDomain));
  return {
    live: results.filter((r) => r.alive).map((r) => r.domain),
    dropped: results.filter((r) => !r.alive),
  };
}
