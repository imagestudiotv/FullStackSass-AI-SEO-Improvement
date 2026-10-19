import { describe, expect, it } from "vitest";

import { InconsistentFinancialDataError } from "../errors";
import { Money } from "../value-objects/money";
import { CommissionRate } from "../value-objects/commission-rate";
import { decideCouponAttribution, decideSignup, type SignupInput } from "./attribution";
import { commissionFor, disputeEffect, eligibleBases, reversalTarget } from "./commission";
import { addCalendarMonthsUtc, eligibilityWindow, isWithinWindow } from "./eligibility";
import { emailSignals, evaluateFraud } from "./fraud";
import { maturesAt, monthlyRunKey, nextMonthlyRun, planSettlement } from "./maturity";
import { commissionDisplayStatus } from "../entities/commission";
import { bankDisplayState, transferDisplayState } from "../entities/settlement";
import { DEFAULT_PROGRAM_POLICY, parseProgramPolicy, payoutThreshold } from "./program";
import { tierAt, tierForCount, tierProgress } from "./tiers";

const big = (n: number | string) => BigInt(n);
const eur = (n: number | string) => Money.of(n, "eur");
const policy = DEFAULT_PROGRAM_POLICY;
const at = (iso: string) => new Date(iso);

describe("eligibility window (12 calendar months, UTC, [start, end))", () => {
  it("adds calendar months, clamping to the month's last day", () => {
    expect(addCalendarMonthsUtc(at("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addCalendarMonthsUtc(at("2028-02-29T00:00:00Z"), 12).toISOString()).toBe("2029-02-28T00:00:00.000Z");
    expect(addCalendarMonthsUtc(at("2026-11-15T23:59:59.999Z"), 2).toISOString()).toBe("2027-01-15T23:59:59.999Z");
  });

  it("includes its start and excludes its end", () => {
    const window = eligibilityWindow(at("2026-03-10T12:00:00Z"), 12);
    expect(window.end.toISOString()).toBe("2027-03-10T12:00:00.000Z");
    expect(isWithinWindow(window, at("2026-03-10T12:00:00Z"))).toBe(true);
    expect(isWithinWindow(window, at("2027-03-10T11:59:59.999Z"))).toBe(true);
    expect(isWithinWindow(window, at("2027-03-10T12:00:00Z"))).toBe(false);
    expect(isWithinWindow(window, at("2026-03-10T11:59:59.999Z"))).toBe(false);
  });

  it("puts an annual renewal exactly twelve months later outside the window", () => {
    const window = eligibilityWindow(at("2026-05-01T08:00:00Z"), policy.eligibilityMonths);
    expect(isWithinWindow(window, at("2027-05-01T08:00:00Z"))).toBe(false);
  });
});

describe("tiers count distinct qualifying organizations", () => {
  it("moves at 10 and 25", () => {
    expect(tierForCount(policy, 0).key).toBe("base");
    expect(tierForCount(policy, 9).key).toBe("base");
    expect(tierForCount(policy, 10).key).toBe("growth");
    expect(tierForCount(policy, 24).key).toBe("growth");
    expect(tierForCount(policy, 25).key).toBe("premier");
    expect(tierForCount(policy, 400).key).toBe("premier");
  });

  it("reports progress like the dashboard shows it", () => {
    const progress = tierProgress(policy, 17);
    expect(progress.current.name).toBe("Growth Partner");
    expect(progress.rate.toPercentLabel()).toBe("30%");
    expect(progress.next?.name).toBe("Premier Partner");
    expect(progress.remaining).toBe(8);
    expect(tierProgress(policy, 30).next).toBeNull();
    expect(tierProgress(policy, 30).remaining).toBe(0);
  });

  it("applies the tier in force at the payment's own time", () => {
    const periods = [
      { tierKey: "base", rateBasisPoints: 2500, effectiveFrom: at("2026-01-01T00:00:00Z"), effectiveTo: at("2026-06-01T00:00:00Z") },
      { tierKey: "growth", rateBasisPoints: 3000, effectiveFrom: at("2026-06-01T00:00:00Z"), effectiveTo: null },
    ];
    expect(tierAt(periods, at("2026-05-31T23:59:59Z"))?.tierKey).toBe("base");
    expect(tierAt(periods, at("2026-06-01T00:00:00Z"))?.tierKey).toBe("growth");
    // A payment from before the partner existed uses the first period.
    expect(tierAt(periods, at("2025-12-01T00:00:00Z"))?.tierKey).toBe("base");
  });
});

describe("eligible base: subscription cash collected, excluding tax", () => {
  const invoice = { currency: "eur", total: big(9900), tax: big(0), allLinesSubscription: true, linesComplete: true };

  it("takes the whole payment when there is no tax", () => {
    const [one] = eligibleBases(invoice, [{ id: "inpay_1", cash: big(9900), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(one.base.amount).toBe(big(9900));
    expect(commissionFor(one.base, CommissionRate.ofBasisPoints(2500)).toDecimalString()).toBe("24.75");
  });

  it("does not subtract a discount twice (the total is already discounted)", () => {
    const discounted = { ...invoice, total: big(8910) };
    const [one] = eligibleBases(discounted, [{ id: "inpay_1", cash: big(8910), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(commissionFor(one.base, CommissionRate.ofBasisPoints(2500)).toDecimalString()).toBe("22.28");
  });

  it("excludes inclusive tax", () => {
    // EUR 99.00 including 22% VAT: 17.85 tax, 81.15 revenue.
    const taxed = { ...invoice, total: big(9900), tax: big(1785) };
    const [one] = eligibleBases(taxed, [{ id: "inpay_1", cash: big(9900), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(one.base.amount).toBe(big(8115));
    expect(one.taxShare.amount).toBe(big(1785));
  });

  it("excludes exclusive tax added on top", () => {
    const taxed = { ...invoice, total: big(12078), tax: big(2178) };
    const [one] = eligibleBases(taxed, [{ id: "inpay_1", cash: big(12078), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(one.base.amount).toBe(big(9900));
  });

  it("excludes credit: only cash counts, with tax allocated in proportion", () => {
    // EUR 99.00 invoice, EUR 40.00 paid from customer credit, EUR 59.00 in cash.
    const [one] = eligibleBases(invoice, [{ id: "inpay_1", cash: big(5900), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(one.base.amount).toBe(big(5900));
    const taxed = { ...invoice, tax: big(1785) };
    const [two] = eligibleBases(taxed, [{ id: "inpay_1", cash: big(5900), paidAt: at("2026-10-01T00:00:00Z") }]);
    // floor(8115 * 5900 / 9900) = 4836
    expect(two.base.amount).toBe(big(4836));
  });

  it("splits partial payments without drift, whatever order they are processed in", () => {
    const taxed = { ...invoice, tax: big(1785) };
    const parts = [
      { id: "inpay_b", cash: big(3333), paidAt: at("2026-10-02T00:00:00Z") },
      { id: "inpay_a", cash: big(3333), paidAt: at("2026-10-01T00:00:00Z") },
      { id: "inpay_c", cash: big(3234), paidAt: at("2026-10-03T00:00:00Z") },
    ];
    const bases = eligibleBases(taxed, parts);
    expect(bases.map((b) => b.id)).toEqual(["inpay_a", "inpay_b", "inpay_c"]);
    const sum = bases.reduce((total, b) => total + b.base.amount, big(0));
    expect(sum).toBe(big(8115));
    expect(eligibleBases(taxed, [...parts].reverse()).map((b) => b.base.amount)).toEqual(bases.map((b) => b.base.amount));
  });

  it("earns nothing on a zero invoice (trial start, 100% coupon)", () => {
    const zero = { ...invoice, total: big(0) };
    const [one] = eligibleBases(zero, [{ id: "inpay_1", cash: big(0), paidAt: at("2026-10-01T00:00:00Z") }]);
    expect(one.base.isZero()).toBe(true);
    expect(eligibleBases({ ...invoice, total: big(-500) }, [])).toEqual([]);
  });

  it("refuses to guess on inconsistent facts", () => {
    const paid = [{ id: "inpay_1", cash: big(9900), paidAt: at("2026-10-01T00:00:00Z") }];
    expect(() => eligibleBases({ ...invoice, allLinesSubscription: false }, paid)).toThrow(InconsistentFinancialDataError);
    expect(() => eligibleBases({ ...invoice, linesComplete: false }, paid)).toThrow(InconsistentFinancialDataError);
    expect(() => eligibleBases({ ...invoice, total: big(5000) }, paid)).toThrow(/cash_exceeds_total/);
    expect(() => eligibleBases({ ...invoice, tax: big(10000) }, paid)).toThrow(/tax_exceeds_total/);
    expect(() => eligibleBases({ ...invoice, currency: "huf" }, paid)).toThrow(/not supported/);
    expect(() => eligibleBases({ ...invoice, total: big(0) }, paid)).toThrow(/cash_on_zero_invoice/);
  });
});

describe("refunds and chargebacks are cumulative", () => {
  const commission = eur(2475);
  const cash = eur(9900);
  const zero = eur(0);

  it("reverses in proportion, exactly all of it on a full refund", () => {
    expect(reversalTarget({ commission, cash, refunded: eur(4950), disputeLost: zero }).amount).toBe(big(1238));
    expect(reversalTarget({ commission, cash, refunded: cash, disputeLost: zero }).equals(commission)).toBe(true);
    expect(reversalTarget({ commission, cash, refunded: zero, disputeLost: zero }).isZero()).toBe(true);
  });

  it("never reverses more than the commission when a refund and a lost dispute overlap", () => {
    const target = reversalTarget({ commission, cash, refunded: eur(6000), disputeLost: eur(9900) });
    expect(target.equals(commission)).toBe(true);
  });

  it("converges on the same total however the refunds are split", () => {
    // Two refunds of 33.00 then 66.00 reach the same reversal as one of 99.00.
    const first = reversalTarget({ commission, cash, refunded: eur(3300), disputeLost: zero });
    const second = reversalTarget({ commission, cash, refunded: eur(9900), disputeLost: zero });
    expect(first.amount).toBe(big(825));
    expect(second.subtract(first).amount + first.amount).toBe(big(2475));
  });

  it("maps dispute statuses to holds, releases and reversals", () => {
    expect(disputeEffect("needs_response")).toBe("hold");
    expect(disputeEffect("under_review")).toBe("hold");
    expect(disputeEffect("warning_needs_response")).toBe("hold");
    expect(disputeEffect("won")).toBe("release");
    expect(disputeEffect("warning_closed")).toBe("release");
    expect(disputeEffect("lost")).toBe("reverse");
    expect(disputeEffect("something_new")).toBe("unknown");
  });
});

describe("signup attribution", () => {
  const partner = { id: "p1", userId: "partner-user", email: "pat@partner.example", status: "active" as const };
  const click = {
    clickId: "c1",
    partnerId: "p1",
    clickedAt: at("2026-10-01T00:00:00Z"),
    expiresAt: at("2026-12-30T00:00:00Z"),
  };
  const input = (overrides: Partial<SignupInput> = {}): SignupInput => ({
    userId: "new-user",
    email: "new@customer.example",
    signedUpAt: at("2026-10-05T00:00:00Z"),
    invited: false,
    existingAccount: false,
    click,
    clickPartner: partner,
    fraud: { sharedNetwork: false, sharedDevice: false },
    ...overrides,
  });

  it("attributes a genuine new signup from a valid link", () => {
    const decision = decideSignup(policy, input());
    expect(decision.eligible).toBe(true);
    expect(decision.link).toMatchObject({ outcome: "attribute", partnerId: "p1", clickId: "c1" });
    expect(decision.couponDeadline.toISOString()).toBe("2027-01-03T00:00:00.000Z");
  });

  it("excludes invited team members and existing accounts entirely", () => {
    const invited = decideSignup(policy, input({ invited: true }));
    expect(invited.eligible).toBe(false);
    expect(invited.exclusions).toEqual(["invited"]);
    expect(invited.link).toEqual({ outcome: "none", reason: "not_eligible" });
    expect(decideSignup(policy, input({ existingAccount: true })).eligible).toBe(false);
  });

  it("does not attribute expired clicks, inactive partners or self-referrals", () => {
    expect(decideSignup(policy, input({ signedUpAt: at("2026-12-30T00:00:00Z") })).link).toEqual({
      outcome: "none",
      reason: "click_expired",
    });
    expect(decideSignup(policy, input({ clickPartner: { ...partner, status: "suspended" } })).link).toMatchObject({
      reason: "partner_inactive",
    });
    expect(decideSignup(policy, input({ email: "PAT@partner.example" })).link).toMatchObject({ reason: "self_referral" });
    // Without a click the account stays eligible for a coupon later.
    const noClick = decideSignup(policy, input({ click: null, clickPartner: null }));
    expect(noClick.eligible).toBe(true);
    expect(noClick.link).toEqual({ outcome: "none", reason: "no_click" });
  });

  it("sends shared-network signals to review instead of rejecting", () => {
    const decision = decideSignup(policy, input({ fraud: { sharedNetwork: true, sharedDevice: false } }));
    expect(decision.link).toMatchObject({ outcome: "attribute", fraud: { decision: "review", reasons: ["shared_network"] } });
  });
});

describe("coupon attribution", () => {
  const couponPartner = { id: "p2", userId: "p2-user", email: "p2@example.com", status: "active" as const };
  const base = {
    organizationId: "org1",
    eligibility: {
      eligible: true,
      userId: "u1",
      email: "u1@example.com",
      foundingOrganizationId: "org1",
      couponDeadline: at("2027-01-01T00:00:00Z"),
    },
    existingAttribution: null,
    couponPartner,
    priorPayment: false,
    paidAt: at("2026-11-01T00:00:00Z"),
    partnerIsMember: false,
    fraud: { sharedNetwork: false, sharedDevice: false },
  };

  it("attributes an eligible, unattributed first payment", () => {
    expect(decideCouponAttribution(base)).toMatchObject({ outcome: "attribute", partnerId: "p2" });
  });

  it("never reassigns: a different partner's coupon is a conflict", () => {
    expect(decideCouponAttribution({ ...base, existingAttribution: { partnerId: "p1" } })).toEqual({
      outcome: "conflict",
      existingPartnerId: "p1",
      couponPartnerId: "p2",
    });
    expect(decideCouponAttribution({ ...base, existingAttribution: { partnerId: "p2" } })).toEqual({ outcome: "same_partner" });
  });

  it("requires signup eligibility, the founding organization, no prior payment and the 90-day window", () => {
    expect(decideCouponAttribution({ ...base, eligibility: null })).toMatchObject({ reason: "not_eligible" });
    expect(decideCouponAttribution({ ...base, eligibility: { ...base.eligibility, eligible: false } })).toMatchObject({ reason: "not_eligible" });
    expect(decideCouponAttribution({ ...base, organizationId: "org2" })).toMatchObject({ reason: "not_founding_organization" });
    expect(decideCouponAttribution({ ...base, priorPayment: true })).toMatchObject({ reason: "existing_customer" });
    expect(decideCouponAttribution({ ...base, paidAt: at("2027-01-01T00:00:00Z") })).toMatchObject({ reason: "coupon_window_expired" });
    expect(decideCouponAttribution({ ...base, partnerIsMember: true })).toMatchObject({ reason: "self_referral" });
  });
});

describe("fraud signals", () => {
  it("rejects only on clear evidence", () => {
    expect(evaluateFraud({ sameEmail: true, partnerIsMember: false, plusAddressOfPartner: false, sharedNetwork: false, sharedDevice: false }).decision).toBe("reject");
    expect(evaluateFraud({ sameEmail: false, partnerIsMember: false, plusAddressOfPartner: true, sharedNetwork: false, sharedDevice: false }).decision).toBe("review");
    expect(evaluateFraud({ sameEmail: false, partnerIsMember: false, plusAddressOfPartner: false, sharedNetwork: true, sharedDevice: true }).reasons).toEqual(["shared_device"]);
    expect(evaluateFraud({ sameEmail: false, partnerIsMember: false, plusAddressOfPartner: false, sharedNetwork: false, sharedDevice: false }).decision).toBe("allow");
  });

  it("recognises plus-addresses as a signal, not a match", () => {
    expect(emailSignals("ann+promo@x.com", "ann@x.com")).toEqual({ sameEmail: false, plusAddressOfPartner: true });
    expect(emailSignals("Ann@X.com", "ann@x.com")).toEqual({ sameEmail: true, plusAddressOfPartner: false });
  });
});

describe("maturity and settlement planning", () => {
  const now = at("2026-12-01T00:00:00Z");
  const commission = (id: string, amount: number, overrides: Record<string, unknown> = {}) => ({
    id,
    status: "pending" as const,
    reviewState: "approved" as const,
    holdReason: null,
    amount: eur(amount),
    reversedAmount: eur(0),
    maturesAt: at("2026-11-01T00:00:00Z"),
    ...overrides,
  });
  const plan = (candidates: ReturnType<typeof commission>[], liability: number, extra: Partial<{ notYetPayable: number; reserved: number }> = {}) =>
    planSettlement({
      currency: "eur",
      candidates,
      liability: eur(liability),
      notYetPayable: eur(extra.notYetPayable ?? 0),
      reservedInFlight: eur(extra.reserved ?? 0),
      threshold: payoutThreshold(policy, "eur"),
      now,
    });

  it("matures 30 days after the payment and runs on the first of the month, UTC", () => {
    expect(maturesAt(at("2026-10-15T09:00:00Z"), 30).toISOString()).toBe("2026-11-14T09:00:00.000Z");
    expect(nextMonthlyRun(at("2026-11-14T09:00:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextMonthlyRun(at("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(monthlyRunKey(at("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });

  it("carries EUR 24.75 forward: it is below the EUR 25.00 threshold", () => {
    expect(plan([commission("a", 2475)], 2475)).toEqual({ kind: "carry_forward", reason: "below_threshold", payable: eur(2475) });
  });

  it("pays once mature commissions reach the threshold", () => {
    const result = plan([commission("a", 2475), commission("b", 2475)], 4950);
    expect(result).toMatchObject({ kind: "settle" });
    if (result.kind !== "settle") return;
    expect(result.transferAmount.amount).toBe(big(4950));
    expect(result.offset.isZero()).toBe(true);
    expect(result.allocations.map((a) => a.commissionId)).toEqual(["a", "b"]);
  });

  it("does not pay immature, held, unapproved or reversed commissions", () => {
    const candidates = [
      commission("young", 5000, { maturesAt: at("2026-12-02T00:00:00Z") }),
      commission("held", 5000, { holdReason: "dispute" }),
      commission("review", 5000, { reviewState: "needs_review" }),
      commission("gone", 5000, { reversedAmount: eur(5000) }),
    ];
    expect(plan(candidates, 15000, { notYetPayable: 15000 })).toMatchObject({ reason: "nothing_payable" });
  });

  it("offsets a clawback on money already paid, once", () => {
    // 100.00 was paid and later refunded (liability -100.00); 130.00 is now payable.
    const result = plan([commission("b", 5000), commission("c", 8000)], 3000);
    expect(result).toMatchObject({ kind: "settle" });
    if (result.kind !== "settle") return;
    expect(result.gross.amount).toBe(big(13000));
    expect(result.offset.amount).toBe(big(10000));
    expect(result.transferAmount.amount).toBe(big(3000));
  });

  it("pays nothing while the partner owes more than is payable", () => {
    expect(plan([commission("b", 5000)], -5000)).toMatchObject({ reason: "negative_position" });
  });

  it("never pays a currency without a configured threshold", () => {
    const usd = planSettlement({
      currency: "usd",
      candidates: [{ ...commission("u", 9000), amount: Money.of(9000, "usd"), reversedAmount: Money.of(0, "usd") }],
      liability: Money.of(9000, "usd"),
      notYetPayable: Money.of(0, "usd"),
      reservedInFlight: Money.of(0, "usd"),
      threshold: payoutThreshold(policy, "usd"),
      now,
    });
    expect(usd).toMatchObject({ kind: "carry_forward", reason: "no_threshold" });
  });
});

describe("program policy", () => {
  it("round-trips the shipped defaults (as seeded by migration 0064)", () => {
    expect(parseProgramPolicy(JSON.parse(JSON.stringify(DEFAULT_PROGRAM_POLICY)))).toEqual(DEFAULT_PROGRAM_POLICY);
    expect(payoutThreshold(policy, "EUR")?.toDecimalString()).toBe("25.00");
  });

  it("rejects inconsistent tiers and thresholds", () => {
    const bad = (patch: Record<string, unknown>) => () => parseProgramPolicy({ ...DEFAULT_PROGRAM_POLICY, ...patch });
    expect(bad({ tiers: [] })).toThrow();
    expect(bad({ tiers: [{ key: "base", name: "B", rateBasisPoints: 2500, minCustomers: 1 }] })).toThrow();
    expect(bad({ tiers: [{ key: "base", name: "B", rateBasisPoints: 12000, minCustomers: 0 }] })).toThrow();
    expect(bad({ payoutThresholds: { eur: "-1" } })).toThrow();
    expect(bad({ payoutThresholds: { huf: "100" } })).toThrow();
    expect(bad({ maturityDays: 0 })).toThrow();
  });
});

describe("what a person is shown (partner portal and admin alike)", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const base = { status: "pending" as const, reviewState: "approved" as const, holdReason: null, maturesAt: new Date("2026-10-30T00:00:00Z") };

  it("shows commissions as stored, with held / review / matured views of unpaid money", () => {
    expect(commissionDisplayStatus(base, now)).toBe("pending");
    expect(commissionDisplayStatus({ ...base, maturesAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe("available");
    expect(commissionDisplayStatus({ ...base, holdReason: "dispute_open", maturesAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe("held");
    expect(commissionDisplayStatus({ ...base, reviewState: "needs_review" }, now)).toBe("review");
    expect(commissionDisplayStatus({ ...base, status: "reserved" }, now)).toBe("reserved");
    expect(commissionDisplayStatus({ ...base, status: "paid", holdReason: "x" }, now)).toBe("paid");
    expect(commissionDisplayStatus({ ...base, status: "reversed" }, now)).toBe("reversed");
  });

  it("calls a transfer sent only once Stripe confirmed it, and a bank payout paid only once Stripe says so", () => {
    expect(transferDisplayState("reserved", null)).toBe("pending");
    expect(transferDisplayState("transfer_processing", "processing")).toBe("processing");
    expect(transferDisplayState("transfer_unknown", "unknown")).toBe("processing");
    expect(transferDisplayState("needs_review", "unknown")).toBe("processing");
    expect(transferDisplayState("needs_review", "confirmed")).toBe("confirmed");
    expect(transferDisplayState("transferred", "confirmed")).toBe("confirmed");
    expect(transferDisplayState("payout_failed", "confirmed")).toBe("confirmed");
    expect(transferDisplayState("paid", "reversed")).toBe("reversed");
    expect(bankDisplayState(null)).toBe("not_started");
    expect(bankDisplayState("unknown")).toBe("pending");
    expect(bankDisplayState("in_transit")).toBe("in_transit");
    expect(bankDisplayState("canceled")).toBe("failed");
    expect(bankDisplayState("paid")).toBe("paid");
  });
});
