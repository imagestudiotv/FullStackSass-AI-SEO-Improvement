import { buildSecurityTxt } from "@/lib/security-txt";
import { siteUrl } from "@/lib/site-url";

/**
 * /.well-known/security.txt - contents and reasoning in lib/security-txt.ts.
 *
 * Rebuilt at most daily, so its Expires date rolls forward by itself and the
 * file never goes stale between deploys. Reads no database.
 */
export const revalidate = 86400;

export function GET() {
  return new Response(buildSecurityTxt(siteUrl()), {
    // RFC 9116 asks for text/plain with an explicit UTF-8 charset.
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
