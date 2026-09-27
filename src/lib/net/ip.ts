import { BlockList, isIP } from "node:net";

/**
 * Which network addresses a user-supplied URL may reach.
 *
 * The rule for every server-side request to a URL a user (or a user's
 * server) chose: the destination must be on the public internet. Loopback,
 * private networks, link-local (cloud metadata at 169.254.169.254 lives
 * there), carrier-grade NAT, multicast, documentation and reserved ranges are
 * all refused, for IPv4 and IPv6 alike.
 *
 * Checked against ADDRESSES, never hostnames: a public-looking name can
 * resolve anywhere. lib/net/safe-fetch.ts runs every resolved address of
 * every connection through isPublicIp before connecting to it.
 */

const NON_PUBLIC = new BlockList();

// IPv4 - RFC 6890 special-purpose registry, plus multicast and reserved.
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and 255.255.255.255
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}

// IPv6.
for (const [network, prefix] of [
  ["::", 96], // unspecified, loopback (::1) and IPv4-compatible
  ["64:ff9b::", 96], // NAT64 - can translate onto private IPv4
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard-only
  ["2001::", 23], // IETF protocol assignments, incl. Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 - embeds an arbitrary IPv4 address
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}

/**
 * The IPv4 address inside an IPv4-mapped IPv6 address (::ffff:a.b.c.d, also
 * written ::ffff:7f00:1), or null. Such an address reaches the IPv4 host, so
 * it must be judged by the IPv4 rules.
 */
function mappedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  const dotted = /^(?:0{0,4}:){0,5}:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (dotted) return dotted[1];
  const hex = /^(?:0{0,4}:){0,5}:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return null;
}

/** True only for a syntactically valid IP on the public internet. */
export function isPublicIp(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0];
  const version = isIP(bare);
  if (version === 4) return !NON_PUBLIC.check(bare, "ipv4");
  if (version === 6) {
    const v4 = mappedIpv4(bare);
    if (v4) return isIP(v4) === 4 && !NON_PUBLIC.check(v4, "ipv4");
    return !NON_PUBLIC.check(bare, "ipv6");
  }
  return false;
}

/**
 * A URL hostname in the one form every check compares: lowercased, without
 * IPv6 brackets and without trailing dots.
 *
 * "localhost." is the fully-qualified spelling of "localhost" and resolves to
 * the same loopback address; the old text check compared it against
 * "localhost", found no match, saw a dot and let it through.
 */
export function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
}

/**
 * Names that are never a public website, whatever they resolve to: loopback
 * names, and suffixes reserved for private networks and cloud metadata
 * (metadata.google.internal). Refused before any DNS lookup is made.
 */
const INTERNAL_SUFFIXES = [
  ".localhost",
  ".internal",
  ".local",
  ".localdomain",
  ".home.arpa",
  ".intranet",
  ".private",
  ".corp",
  ".lan",
  ".test",
  ".invalid",
];

export function isInternalHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host || host === "localhost") return true;
  if (isIP(host)) return !isPublicIp(host);
  // A single label ("intranet", "db") is never a public domain.
  if (!host.includes(".")) return true;
  return INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
