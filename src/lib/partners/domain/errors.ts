/**
 * Errors raised by the partner program's pure business rules.
 *
 * Domain code never imports a framework, a database or a provider. When a
 * rule is broken it throws one of these, and the application layer decides
 * what the caller sees (a typed outcome, a review case, a 4xx).
 */

export class PartnerDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerDomainError";
  }
}

/** Two amounts in different currencies were combined. Never converted silently. */
export class CurrencyMismatchError extends PartnerDomainError {
  constructor(left: string, right: string) {
    super(`Cannot combine ${left} with ${right}`);
    this.name = "CurrencyMismatchError";
  }
}

/** A currency the program has no validated minor-unit exponent for. */
export class UnsupportedCurrencyError extends PartnerDomainError {
  constructor(readonly currency: string) {
    super(`Currency "${currency}" is not supported by the partner program`);
    this.name = "UnsupportedCurrencyError";
  }
}

/** A non-integer, unsafe or otherwise invalid amount. */
export class InvalidAmountError extends PartnerDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/** A state machine was asked to make a move it does not allow. */
export class InvalidTransitionError extends PartnerDomainError {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`${machine}: ${from} -> ${to} is not allowed`);
    this.name = "InvalidTransitionError";
  }
}

/** Financial facts that do not add up. Becomes a review case, never a guess. */
export class InconsistentFinancialDataError extends PartnerDomainError {
  constructor(
    readonly reason: string,
    readonly detail: Record<string, string | number | boolean | null> = {},
  ) {
    super(`Inconsistent financial data: ${reason}`);
    this.name = "InconsistentFinancialDataError";
  }
}
