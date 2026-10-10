/**
 * Reading Google Analytics' own cookies, on the server, for the conversions
 * reported after the visitor has left (lib/conversions/conversions.ts).
 *
 * GA keeps the browser's identity in `_ga` and the current visit in
 * `_ga_<ID without "G-">`. Both exist only for a visitor who accepted the
 * cookie banner: in advanced consent mode an undecided visitor gets
 * cookieless pings and no cookie, so there is nothing here to read.
 *
 * NO IMPORTS: plain functions, tested as such.
 */

/** The client id in an `_ga` value: "GA1.1.1234567890.1700000000" -> "1234567890.1700000000". */
export function gaClientId(value: string | undefined | null): string | null {
  if (!value) return null;
  const parts = value.trim().split(".");
  if (parts.length < 4 || !/^GA\d$/.test(parts[0])) return null;
  const id = `${parts[2]}.${parts[3]}`;
  return /^\d{1,20}\.\d{1,20}$/.test(id) ? id : null;
}

/**
 * The session id in an `_ga_<ID>` value, in either of the formats GA has
 * written: "GS1.1.1700000000.3.1..." and, since 2025,
 * "GS2.1.s1700000000$o3$g1$t...".
 */
export function gaSessionId(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  const match = /^GS1\.\d+\.(\d{6,20})(?:\.|$)/.exec(v) ?? /^GS2\.\d+\.s(\d{6,20})(?:\$|$)/.exec(v);
  return match ? match[1] : null;
}

/** The name of the session cookie for a measurement ID. */
export function gaSessionCookie(measurementId: string): string {
  return `_ga_${measurementId.replace(/^G-/, "")}`;
}
