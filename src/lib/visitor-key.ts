import { createHash } from "node:crypto";
import { isIP } from "node:net";

/** The environment variables read here (process.env by default). */
type Env = Record<string, string | undefined>;

/**
 * Who is asking, as a hash - the address itself is never stored. For limits
 * on anonymous visitors: the free tools and the public audit
 * (lib/tools/public-guard.ts), the description writer
 * (lib/tools/description-writer.ts) and "Get Featured" requests on the blog
 * (lib/blog/sponsorship-actions.ts).
 *
 * TRUSTED INGRESS ONLY. A forwarding header is just text a client can send,
 * so it identifies a visitor only where the hosting edge OVERWRITES it:
 *  - on Vercel (VERCEL=1 at runtime) the edge sets x-real-ip and
 *    x-forwarded-for itself, replacing whatever the client sent;
 *  - anywhere else, only the header named in TRUSTED_CLIENT_IP_HEADER, for a
 *    deployment behind its own proxy that overwrites that header;
 *  - otherwise no header is trusted: every visitor shares one bucket, which
 *    fails closed (per-visitor limits then act as one more global limit)
 *    rather than letting a rotated header reset them.
 * The value must be a valid IP address, or it is ignored the same way.
 * IPv6 visitors are counted per /64 (one subscriber's block), so cycling
 * through the addresses of their own block does not give them new limits.
 */
export function trustedClientIpHeaders(env: Env = process.env): string[] {
  const configured = env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (configured) return [configured];
  if (env.VERCEL === "1") return ["x-real-ip", "x-forwarded-for"];
  return [];
}

/** The visitor's address from a trusted header, or null. */
export function clientAddress(headers: Pick<Headers, "get">, env: Env = process.env): string | null {
  for (const name of trustedClientIpHeaders(env)) {
    const raw = headers.get(name);
    if (!raw) continue;
    // x-forwarded-for: the edge's own entry is the first one.
    const candidate = (name === "x-forwarded-for" ? raw.split(",")[0] : raw).trim();
    if (isIP(candidate)) return candidate;
  }
  return null;
}

/** What one visitor is counted as: the IPv4 address, or the IPv6 /64. */
export function visitorIdentity(ip: string | null): string {
  if (!ip) return "unknown";
  if (isIP(ip) !== 6) return ip;
  const groups = ipv6Groups(ip);
  // IPv4-mapped (::ffff:a.b.c.d): the IPv4 visitor.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(ip: string): number[] {
  let text = ip.toLowerCase();
  // An embedded IPv4 tail ("::ffff:192.0.2.1") is the last two groups.
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    text = `${text.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail === undefined ? [] : tail ? tail.split(":") : [];
  const zeros = Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((g) => Number.parseInt(g, 16));
}

export function visitorKey(headers: Pick<Headers, "get">, env: Env = process.env): string {
  const identity = visitorIdentity(clientAddress(headers, env));
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}
