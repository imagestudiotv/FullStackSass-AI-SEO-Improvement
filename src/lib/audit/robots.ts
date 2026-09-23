import "server-only";

/**
 * robots.txt, shared by the public audit and the signed-in one.
 *
 * It lived inside public-audit.ts, so the in-app audit could not check AI
 * crawler access without either importing that module (which carries its own
 * caching and rate limiting) or copying the function. Neither is right for a
 * twenty-line fetch, so it moved here.
 */

/**
 * Fetches robots.txt, returning null when there is none.
 *
 * Short timeout and a small cap: this is one extra request on top of a crawl
 * someone is already waiting on, and a site that hangs serving robots.txt
 * should not hold up the whole audit.
 */
export async function fetchRobotsTxt(siteUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${new URL(siteUrl).origin}/robots.txt`, {
      signal: controller.signal,
      headers: {
        accept: "text/plain",
        /*
          Named for the product, not the company it used to be. The old value
          said SEOVisionBot, which is a different brand - and a user-agent is
          the one string a site owner sees in their own logs when deciding
          whether to allow us.
        */
        "user-agent": "RepGetBot/1.0 (+https://repget.com)",
      },
    });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 200_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
