import { createHash } from "node:crypto";

/**
 * Who is asking, as a hash - the address itself is never stored. For limits
 * on anonymous visitors: the free description tool (lib/tools/
 * description-writer.ts) and "Get Featured" requests on the blog
 * (lib/blog/sponsorship-actions.ts).
 *
 * x-real-ip and the first x-forwarded-for entry are set by the hosting edge
 * (Vercel overwrites whatever the client sent). Without either, everyone
 * shares one bucket, which fails closed rather than open.
 */
export function visitorKey(headers: Pick<Headers, "get">): string {
  const ip =
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
