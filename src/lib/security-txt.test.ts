import { describe, expect, it } from "vitest";

import { buildSecurityTxt, SECURITY_CONTACT } from "./security-txt";

/**
 * /.well-known/security.txt against RFC 9116 (client's launch review,
 * 2026-10-03).
 */

const NOW = new Date("2026-10-03T12:34:56.789Z");
const file = buildSecurityTxt("https://www.repget.com/", NOW);

/** Field lines only: "Name: value", comments and blanks dropped. */
const fields = file
  .split("\n")
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const at = line.indexOf(": ");
    return [line.slice(0, at), line.slice(at + 2)] as const;
  });
const field = (name: string) => fields.filter(([key]) => key === name).map(([, value]) => value);

describe("buildSecurityTxt", () => {
  it("names the owner's chosen address as the contact, as a mailto URI", () => {
    expect(SECURITY_CONTACT).toBe("mailto:support@repget.com");
    expect(field("Contact")).toEqual(["mailto:support@repget.com"]);
  });

  it("has exactly one Expires, in UTC, under a year away (RFC 9116 §2.5.5)", () => {
    const [expires] = field("Expires");
    expect(field("Expires")).toHaveLength(1);
    expect(expires).toBe("2027-04-01T12:34:56.000Z");

    const ahead = new Date(expires).getTime() - NOW.getTime();
    expect(ahead).toBeGreaterThan(0);
    expect(ahead).toBeLessThan(365 * 24 * 60 * 60 * 1000);
  });

  it("states the language and its own canonical address", () => {
    expect(field("Preferred-Languages")).toEqual(["en"]);
    expect(field("Canonical")).toEqual(["https://www.repget.com/.well-known/security.txt"]);
  });

  it("uses only fields the RFC defines, every line well-formed", () => {
    const known = new Set(["Contact", "Expires", "Preferred-Languages", "Canonical", "Policy", "Acknowledgments", "Encryption", "Hiring", "CSAF"]);
    for (const [name] of fields) expect(known.has(name), name).toBe(true);
    for (const line of file.split("\n")) {
      expect(line === "" || line.startsWith("# ") || /^[A-Za-z-]+: \S/.test(line), line).toBe(true);
    }
  });

  it("rolls Expires forward as time passes, so the file never lapses", () => {
    const later = buildSecurityTxt("https://www.repget.com", new Date("2027-03-01T00:00:00Z"));
    expect(later).toContain("Expires: 2027-08-28T00:00:00.000Z");
  });
});
