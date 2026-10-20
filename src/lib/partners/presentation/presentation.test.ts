import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";

import { customerReference, maskDomain, sessionAddressForm } from "../infrastructure/directory";
import { partnerCopy } from "./copy";
import { csvCell, toCsv } from "./csv";
import { percentToBasisPoints, reportPeriod, utcDateFrom } from "./validation";
import { balanceView, commissionRowView, couponView, metricsView, pagerView, payoutRowView } from "./views";

/**
 * Presentation helpers: exports that cannot run formulas, typed input read
 * exactly, privacy-safe customer labels, and the view models in every
 * language with no placeholder left unfilled.
 */

const ZERO = BigInt(0);
const unfilled = /\{\w+\}/;

describe("CSV exports", () => {
  it("neutralises spreadsheet formulas but keeps negative amounts as numbers", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-24.75")).toBe("-24.75");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("writes a BOM, a header and CRLF rows", () => {
    expect(toCsv(["a", "b"], [["1", "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });
});

describe("typed input", () => {
  it("reads percentages as basis points without floats", () => {
    expect(percentToBasisPoints("20")).toBe(2000);
    expect(percentToBasisPoints("12.5")).toBe(1250);
    expect(percentToBasisPoints("0.07")).toBe(7);
    expect(percentToBasisPoints("12.345")).toBeNull();
    expect(percentToBasisPoints("1e2")).toBeNull();
  });

  it("reads a report period as UTC days, both included", () => {
    expect(reportPeriod("2026-10-01", "2026-10-31")).toEqual({
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-11-01T00:00:00.000Z"),
      fromText: "2026-10-01",
      toText: "2026-10-31",
    });
    expect(reportPeriod("2026-10-05", "2026-10-01")).toEqual({});
    expect(reportPeriod("2026-02-30", undefined)).toEqual({});
    expect(reportPeriod(undefined, null)).toEqual({});
  });

  it("reads dates as UTC days and refuses impossible ones", () => {
    expect(utcDateFrom("2026-11-01")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(utcDateFrom("")).toBeNull();
    expect(utcDateFrom("2026-02-30")).toBeUndefined();
    expect(utcDateFrom("01/11/2026")).toBeUndefined();
  });
});

describe("privacy-safe customer labels", () => {
  it("shortens a website address to two letters and its ending", () => {
    expect(maskDomain("example.com")).toBe("ex•••.com");
    expect(maskDomain("www.shop.example.co.uk")).toBe("ex•••.co.uk");
    expect(maskDomain("https://Acme.io/path")).toBe("ac•••.io");
    expect(maskDomain("localhost")).toBe("lo•••");
  });

  it("gives every workspace a stable opaque reference", () => {
    expect(customerReference("org-1")).toMatch(/^Customer [0-9A-F]{6}$/);
    expect(customerReference("org-1")).toBe(customerReference("org-1"));
    expect(customerReference("org-1")).not.toBe(customerReference("org-2"));
  });
});

describe("comparing a signup's address with the partner's sessions", () => {
  it("uses the form Better Auth stores (IPv4 as is, IPv6 as its /64)", () => {
    expect(sessionAddressForm("198.51.100.7")).toBe("198.51.100.7");
    expect(sessionAddressForm("2001:DB8:763d:a5::1")).toBe("2001:0db8:763d:00a5:0000:0000:0000:0000");
    expect(sessionAddressForm("2001:db8:763d:a5:ffff:1:2:3")).toBe("2001:0db8:763d:00a5:0000:0000:0000:0000");
    expect(sessionAddressForm("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(sessionAddressForm("::ffff:c000:201")).toBe("192.0.2.1");
    expect(sessionAddressForm("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0000");
    expect(sessionAddressForm("not an address")).toBe("not an address");
  });
});

describe("portal view models", () => {
  const figures = {
    currency: "eur",
    earned: BigInt(7425),
    pending: BigInt(2475),
    available: BigInt(2475),
    inPayout: BigInt(2475),
    transferred: ZERO,
    bankPaid: ZERO,
    offset: BigInt(1000),
    liability: BigInt(6425),
    threshold: BigInt(2500),
    belowThreshold: true,
    updatedAt: new Date("2026-10-19T00:00:00Z"),
  };

  it.each(LOCALES)("%s: every figure, note, metric and row is filled in", (locale) => {
    const copy = partnerCopy(locale).portal;
    const view = balanceView(figures, copy, locale, 30);
    expect(view.figures.map((f) => f.key)).toEqual(["earned", "pending", "available", "transferred", "bankPaid"]);
    expect(view.notes).toHaveLength(3);
    for (const piece of [...view.figures.flatMap((f) => [f.label, f.value, f.definition]), ...view.notes]) expect(piece).not.toMatch(unfilled);
    expect(view.figures[0].value).toMatch(/74[.,]25/);
    expect(view.notes.join(" ")).toMatch(/25[.,]00/);

    const metrics = metricsView({ clicks: 8, signups: 3, customers: 2, payingCustomers: 1, days: 30, since: new Date("2026-09-19T00:00:00Z"), until: new Date("2026-10-19T00:00:00Z") }, copy, locale);
    expect(metrics.period).not.toMatch(unfilled);
    expect(metrics.tiles.find((t) => t.key === "conversion")?.value).toMatch(/12[.,]5\s?%/);

    const row = commissionRowView({ id: "c", paidAt: new Date("2026-09-01T00:00:00Z"), customer: "ex•••.com", currency: "eur", base: BigInt(8910), rateBasisPoints: 2500, amount: BigInt(2228), reversed: BigInt(500), status: "pending", maturesAt: new Date("2026-10-01T00:00:00Z") }, copy, locale);
    expect([row.status, row.reversed, row.amount].join(" ")).not.toMatch(unfilled);
    expect(row.amount).toMatch(/22[.,]28/);

    const payout = payoutRowView({ id: "s", createdAt: new Date("2026-10-01T00:00:00Z"), currency: "eur", amount: BigInt(4950), offset: BigInt(100), transfer: "confirmed", bank: "in_transit", bankPaidAt: null, bankArrivalDate: new Date("2026-10-03T00:00:00Z") }, copy, locale);
    expect([payout.transfer, payout.bank, payout.offset, payout.bankDetail].join(" ")).not.toMatch(unfilled);

    expect(couponView({ code: "SAVE20", percentOffBasisPoints: 2000, amountOff: null, currency: null, expiresAt: null }, copy, locale).discount).toContain("20%");
    expect(pagerView({ page: 2, pageSize: 20, total: 45 }, copy).label).not.toMatch(unfilled);
  });

  it("shows no conversion rate without clicks rather than dividing by zero", () => {
    const copy = partnerCopy("en").portal;
    const metrics = metricsView({ clicks: 0, signups: 0, customers: 0, payingCustomers: 0, days: 30, since: new Date(), until: new Date() }, copy, "en");
    expect(metrics.tiles.find((t) => t.key === "conversion")?.value).toBe("-");
  });

  it("states an unsupported currency instead of a threshold it does not have", () => {
    const copy = partnerCopy("en").portal;
    const view = balanceView({ ...figures, currency: "usd", threshold: null, belowThreshold: false, offset: ZERO, inPayout: ZERO }, copy, "en", 30);
    expect(view.notes).toEqual([expect.stringContaining("USD")]);
  });
});
