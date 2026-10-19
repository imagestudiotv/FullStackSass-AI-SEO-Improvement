import { describe, expect, it } from "vitest";

import { CurrencyMismatchError, InvalidAmountError, UnsupportedCurrencyError } from "../errors";
import { CommissionRate } from "./commission-rate";
import { currency, isSupportedCurrency } from "./currency";
import { ceilDivide, floorDivide, Money, roundHalfUpDivide } from "./money";

const big = (value: number | string) => BigInt(value);

describe("Money", () => {
  it("adds and subtracts exactly in minor units", () => {
    const a = Money.of(9900, "eur");
    const b = Money.of("8910", "EUR");
    expect(a.add(b).amount).toBe(big(18810));
    expect(a.subtract(b).amount).toBe(big(990));
    expect(b.subtract(a).isNegative()).toBe(true);
  });

  it("never combines currencies", () => {
    expect(() => Money.of(1, "eur").add(Money.of(1, "usd"))).toThrow(CurrencyMismatchError);
    expect(() => Money.of(1, "eur").compare(Money.of(1, "usd"))).toThrow(CurrencyMismatchError);
    expect(Money.of(1, "eur").equals(Money.of(1, "usd"))).toBe(false);
  });

  it("refuses unsafe numbers and non-integers instead of rounding them", () => {
    expect(() => Money.of(1.5, "eur")).toThrow(InvalidAmountError);
    expect(() => Money.of(Number.MAX_SAFE_INTEGER + 1, "eur")).toThrow(InvalidAmountError);
    expect(() => Money.of("12.30", "eur")).toThrow(InvalidAmountError);
    expect(() => Money.of("1e3", "eur")).toThrow(InvalidAmountError);
  });

  it("holds amounts beyond Number's safe range without loss", () => {
    const huge = Money.of("9007199254740993", "eur");
    expect(huge.add(Money.of(2, "eur")).amount.toString()).toBe("9007199254740995");
    const sum = Money.sum([huge, huge, huge], "eur");
    expect(sum.toJSON()).toEqual({ amount: "27021597764222979", currency: "eur" });
  });

  it("serialises bigint as a string, never a number", () => {
    const json = JSON.stringify(Money.of(2475, "eur"));
    expect(json).toBe('{"amount":"2475","currency":"eur"}');
    expect(Money.fromJSON(JSON.parse(json)).equals(Money.of(2475, "eur"))).toBe(true);
  });

  it("formats with the currency's exponent", () => {
    expect(Money.of(2475, "eur").toDecimalString()).toBe("24.75");
    expect(Money.of(5, "eur").toDecimalString()).toBe("0.05");
    expect(Money.of(-2228, "eur").toDecimalString()).toBe("-22.28");
    expect(Money.of(1500, "jpy").toDecimalString()).toBe("1500");
  });
});

describe("currency", () => {
  it("validates against an explicit allowlist", () => {
    expect(currency("EUR")).toEqual({ code: "eur", exponent: 2 });
    expect(currency("jpy").exponent).toBe(0);
    // Stripe's special cases are refused rather than guessed.
    for (const code of ["huf", "isk", "twd", "ugx", "kwd", "xyz"]) {
      expect(isSupportedCurrency(code)).toBe(false);
      expect(() => currency(code)).toThrow(UnsupportedCurrencyError);
    }
  });
});

describe("rounding", () => {
  it("rounds half up at the final unit", () => {
    expect(roundHalfUpDivide(big(22275), big(10))).toBe(big(2228));
    expect(roundHalfUpDivide(big(22274), big(10))).toBe(big(2227));
    expect(roundHalfUpDivide(big(5), big(10))).toBe(big(1));
    expect(roundHalfUpDivide(big(4), big(10))).toBe(big(0));
    // Half away from zero for negatives (symmetric).
    expect(roundHalfUpDivide(big(-5), big(10))).toBe(big(-1));
    expect(roundHalfUpDivide(big(-4), big(10))).toBe(big(0));
  });

  it("floors and ceils toward the infinities", () => {
    expect(floorDivide(big(7), big(2))).toBe(big(3));
    expect(floorDivide(big(-7), big(2))).toBe(big(-4));
    expect(ceilDivide(big(7), big(2))).toBe(big(4));
    expect(ceilDivide(big(-7), big(2))).toBe(big(-3));
    expect(() => floorDivide(big(1), big(0))).toThrow(InvalidAmountError);
  });
});

describe("CommissionRate", () => {
  it("matches the program's worked examples", () => {
    const base = CommissionRate.ofBasisPoints(2500);
    expect(base.apply(Money.of(9900, "eur")).toDecimalString()).toBe("24.75");
    expect(base.apply(Money.of(8910, "eur")).toDecimalString()).toBe("22.28");
    expect(CommissionRate.ofBasisPoints(3000).apply(Money.of(9900, "eur")).toDecimalString()).toBe("29.70");
    expect(CommissionRate.ofBasisPoints(3500).apply(Money.of(9900, "eur")).toDecimalString()).toBe("34.65");
  });

  it("rounds only once, at the end", () => {
    // 1 cent at 25% is 0.25 of a cent: rounds to 0, not up.
    expect(CommissionRate.ofBasisPoints(2500).apply(Money.of(1, "eur")).amount).toBe(big(0));
    // 2 cents at 25% is exactly half a cent: rounds half up to 1.
    expect(CommissionRate.ofBasisPoints(2500).apply(Money.of(2, "eur")).amount).toBe(big(1));
  });

  it("only accepts integer basis points from 0 to 10000", () => {
    expect(() => CommissionRate.ofBasisPoints(25.5)).toThrow(InvalidAmountError);
    expect(() => CommissionRate.ofBasisPoints(-1)).toThrow(InvalidAmountError);
    expect(() => CommissionRate.ofBasisPoints(10001)).toThrow(InvalidAmountError);
    expect(CommissionRate.ofBasisPoints(2750).toPercentLabel()).toBe("27.5%");
    expect(CommissionRate.ofBasisPoints(3000).toPercentLabel()).toBe("30%");
  });
});

describe("Money.parseDecimal (what an administrator types)", () => {
  it("reads typed amounts exactly, as text", () => {
    expect(Money.parseDecimal("24.75", "eur").amount).toBe(big(2475));
    expect(Money.parseDecimal("-0.5", "eur").amount).toBe(big(-50));
    expect(Money.parseDecimal(" 100 ", "eur").amount).toBe(big(10000));
    expect(Money.parseDecimal("0.1", "eur").add(Money.parseDecimal("0.2", "eur")).toDecimalString()).toBe("0.30");
    expect(Money.parseDecimal("500", "jpy").amount).toBe(big(500));
  });

  it("refuses anything that is not a plain amount in that currency", () => {
    for (const text of ["", "1,50", "1.234", "1e3", "abc", "--1", "12.", ".5", "1 000"]) {
      expect(() => Money.parseDecimal(text, "eur")).toThrow(InvalidAmountError);
    }
    expect(() => Money.parseDecimal("1.5", "jpy")).toThrow(InvalidAmountError);
  });
});
