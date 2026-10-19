import { CurrencyMismatchError, InvalidAmountError } from "../errors";
import { currency as resolveCurrency, type Currency } from "./currency";

/**
 * An exact amount of one currency, in integer minor units (cents for EUR).
 *
 * bigint throughout: no floating point ever touches money here, and sums of
 * many commissions cannot overflow. Amounts in different currencies cannot be
 * added, subtracted or compared - there is no conversion anywhere in the
 * partner program, so EUR and USD balances stay separate numbers.
 *
 * BigInt() calls instead of `1n` literals: the project compiles to ES2017.
 */

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

export type SerializedMoney = { amount: string; currency: string };

export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: Currency,
  ) {}

  /** From minor units. Numbers must be safe integers; strings must be integer literals. */
  static of(amount: bigint | number | string, currencyCode: string): Money {
    return new Money(toBigInt(amount), resolveCurrency(currencyCode));
  }

  static zero(currencyCode: string): Money {
    return new Money(ZERO, resolveCurrency(currencyCode));
  }

  static fromJSON(value: SerializedMoney): Money {
    return Money.of(value.amount, value.currency);
  }

  /**
   * From what a person typed: "12", "12.5", "-0.75" (a dot, at most the
   * currency's decimals). Exact - the digits are read as text, never as a
   * float. Anything else throws InvalidAmountError.
   */
  static parseDecimal(text: string, currencyCode: string): Money {
    const resolved = resolveCurrency(currencyCode);
    const match = /^(-)?(\d{1,15})(?:\.(\d+))?$/.exec(text.trim());
    if (!match) throw new InvalidAmountError(`Not an amount: ${text.slice(0, 40)}`);
    const [, sign, whole, fraction = ""] = match;
    if (fraction.length > resolved.exponent) throw new InvalidAmountError(`More decimals than ${resolved.code.toUpperCase()} has`);
    const minor = BigInt(whole + fraction.padEnd(resolved.exponent, "0"));
    return new Money(sign ? -minor : minor, resolved);
  }

  get code(): string {
    return this.currency.code;
  }

  isZero(): boolean {
    return this.amount === ZERO;
  }

  isNegative(): boolean {
    return this.amount < ZERO;
  }

  isPositive(): boolean {
    return this.amount > ZERO;
  }

  add(other: Money): Money {
    this.assertSame(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSame(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  negate(): Money {
    return new Money(-this.amount, this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSame(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  min(other: Money): Money {
    return this.compare(other) <= 0 ? this : other;
  }

  max(other: Money): Money {
    return this.compare(other) >= 0 ? this : other;
  }

  equals(other: Money): boolean {
    return this.currency.code === other.currency.code && this.amount === other.amount;
  }

  /**
   * This amount times numerator/denominator, rounded half up at the final
   * minor unit (half away from zero for a negative amount). The only
   * rounding in the program happens here.
   */
  multiplyFraction(numerator: bigint, denominator: bigint): Money {
    return new Money(roundHalfUpDivide(this.amount * numerator, denominator), this.currency);
  }

  /** Exact sum of amounts that must share one currency. */
  static sum(values: Money[], currencyCode: string): Money {
    return values.reduce((total, value) => total.add(value), Money.zero(currencyCode));
  }

  /** For the browser and JSON columns: the amount as a decimal string, never a number. */
  toJSON(): SerializedMoney {
    return { amount: this.amount.toString(), currency: this.currency.code };
  }

  /** "24.75" for EUR 2475. Formatting for people lives in presentation. */
  toDecimalString(): string {
    const exponent = this.currency.exponent;
    const negative = this.amount < ZERO;
    const digits = (negative ? -this.amount : this.amount).toString();
    if (exponent === 0) return `${negative ? "-" : ""}${digits}`;
    const padded = digits.padStart(exponent + 1, "0");
    const whole = padded.slice(0, padded.length - exponent);
    const fraction = padded.slice(padded.length - exponent);
    return `${negative ? "-" : ""}${whole}.${fraction}`;
  }

  private assertSame(other: Money): void {
    if (this.currency.code !== other.currency.code) {
      throw new CurrencyMismatchError(this.currency.code, other.currency.code);
    }
  }
}

/** Integer division rounded half up (half away from zero for negatives). */
export function roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === ZERO) throw new InvalidAmountError("Division by zero");
  const negative = numerator < ZERO !== denominator < ZERO;
  const n = numerator < ZERO ? -numerator : numerator;
  const d = denominator < ZERO ? -denominator : denominator;
  const quotient = n / d;
  const remainder = n % d;
  const rounded = remainder * TWO >= d ? quotient + ONE : quotient;
  return negative ? -rounded : rounded;
}

/** Integer division rounded down (toward negative infinity). */
export function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === ZERO) throw new InvalidAmountError("Division by zero");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder !== ZERO && numerator < ZERO !== denominator < ZERO ? quotient - ONE : quotient;
}

/** Integer division rounded up (toward positive infinity). */
export function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return -floorDivide(-numerator, denominator);
}

export function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new InvalidAmountError(`Amount ${value} is not a safe integer`);
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new InvalidAmountError(`Amount "${value}" is not an integer`);
  return BigInt(value);
}
