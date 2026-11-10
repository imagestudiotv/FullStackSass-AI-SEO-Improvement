import { canReceiveAutomaticPayout } from "../../domain/entities/partner";
import { Money } from "../../domain/value-objects/money";
import type { AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PayPalPayoutEvidence } from "../ports/payout-gateway";
import type { Environment, PartnerRecord, PayPalPayoutRecord, SettlementRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * Partners paid through PayPal (Daniel's design; review "PAY").
 *
 * WHAT IS THE SAME AS STRIPE. The monthly run reserves the same mature
 * commissions in the same settlement (prepare-settlement.ts), so a commission
 * is in at most one active settlement and can never be paid by Stripe AND by
 * PayPal. The liability is settled by ONE `transfer_confirmed` ledger entry,
 * written once (keyed by the payout attempt), only on PayPal's evidence or -
 * in manual mode - a person's recorded confirmation. Refunds after payment
 * are offset against later payouts, as for card.
 *
 * WHAT IS DIFFERENT. One step instead of two: a PayPal payout moves the money
 * from RepGet's PayPal balance straight to the partner's PayPal account, so a
 * confirmed payout is "paid". Two modes, the owner's choice (Q4):
 *
 *   automated  PayPal Payouts: the attempt is recorded "processing" BEFORE
 *              the request; its sender_batch_id is the request's idempotency
 *              id, so a lost answer is repeated, never re-sent anew (PayPal
 *              keeps both 30 days). The item's status, from PayPal's webhook
 *              or the sweep, decides: SUCCESS settles; PENDING, UNCLAIMED,
 *              ONHOLD wait; FAILED, RETURNED, BLOCKED, DENIED, CANCELED mean
 *              nothing reached the partner (review); REFUNDED or REVERSED
 *              after SUCCESS takes it back (review).
 *   manual     A person sends the money in PayPal, then records PayPal's
 *              transaction id here; a second step confirms it once checked in
 *              PayPal's activity. Labelled manual everywhere. Nothing is
 *              settled by recording alone.
 *
 * OFF until configured: PARTNER_PAYPAL_PAYOUTS, a fee bearer and the
 * countries (infrastructure/settings.ts), plus the partner_payouts switch and,
 * for live money, PARTNER_LIVE_PAYOUTS=enabled.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const CODE_TTL_MS = 30 * MINUTE;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PayPal item statuses, by what they mean for the money. */
const ITEM_SETTLED = new Set(["SUCCESS"]);
const ITEM_WAITING = new Set(["PENDING", "UNCLAIMED", "ONHOLD", "PROCESSING", "NEW"]);
const ITEM_NOT_PAID = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "CANCELED"]);
const ITEM_TAKEN_BACK = new Set(["REFUNDED", "REVERSED"]);

export function payPalSenderBatchId(settlementId: string, attempt: number): string {
  return `repget-partner-${settlementId}-${attempt}`;
}

/* ----------------------------------------------------------- availability */

export type PayPalAvailability = { available: true; mode: "automated" | "manual" } | { available: false; reason: string };

/**
 * Whether this partner may be paid through PayPal here, decided on the server
 * from the deployment's settings and the partner's own country (from their
 * application). The partner portal shows the same answer; it is not a
 * browser decision.
 */
export function payPalPayoutAvailability(deps: PartnerDeps, partner: Pick<PartnerRecord, "country">): PayPalAvailability {
  const mode = deps.settings.paypalPayoutMode?.() ?? "off";
  if (mode === "off") return { available: false, reason: "paypal_payouts_off" };
  const bearer = deps.settings.paypalFeeBearer?.() ?? null;
  if (bearer === null) return { available: false, reason: "fee_policy_undecided" };
  // Only RepGet bearing PayPal's fee is built; the other needs its deduction rule agreed first.
  if (bearer !== "repget") return { available: false, reason: "partner_fee_not_built" };
  const countries = deps.settings.paypalPayoutCountries?.() ?? [];
  if (!partner.country || !countries.includes(partner.country.toUpperCase())) return { available: false, reason: "country_not_supported" };
  if (mode === "automated" && !deps.paypalPayouts) return { available: false, reason: "paypal_not_configured" };
  return { available: true, mode };
}

/**
 * Every country a partner can be paid in here: Stripe Connect's, and
 * PayPal's while PayPal payouts can actually run (a mode, RepGet bearing the
 * fee). The server's answer for applications and the apply page's list - a
 * country only PayPal covers is not refused while PayPal can pay it.
 */
export function payableCountries(deps: PartnerDeps): string[] {
  const stripe = deps.settings.payoutCountries();
  const mode = deps.settings.paypalPayoutMode?.() ?? "off";
  const paypal = mode !== "off" && deps.settings.paypalFeeBearer?.() === "repget" ? (deps.settings.paypalPayoutCountries?.() ?? []) : [];
  return [...new Set([...stripe, ...paypal])].sort();
}

/* -------------------------------------------------------- recipient setup */

/**
 * The partner gives their PayPal email. A 6-digit code goes TO that address;
 * entering it proves the partner controls it. A change of address needs a
 * new code; until then the old method stays in use.
 */
export async function setPayPalRecipient(deps: PartnerDeps, input: { partnerId: string; email: string }): Promise<Result<{ receiver: string }>> {
  const environment = deps.settings.environment();
  if (!environment) return fail("ineligible", "not_configured");
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(input.partnerId);
  if (!partner || partner.status !== "active") return fail("forbidden");
  const availability = payPalPayoutAvailability(deps, partner);
  if (!availability.available) return fail("ineligible", availability.reason);
  const receiver = input.email.trim().toLowerCase();
  if (receiver.length > 127 || !EMAIL_RE.test(receiver)) return fail("invalid", "email");
  const admitted = await deps.quotaLimiter.admit([{ key: `partner-paypal-code:${partner.id}`, limit: 5, windowSeconds: 3600 }], "partner.paypal.verification");
  if (!admitted) return fail("rate_limited");

  const code = deps.random.indexes(6, 10).join("");
  const now = deps.clock.now();
  await repos.paypalPayouts.setAccount({
    partnerId: partner.id,
    environment,
    receiver,
    codeHash: codeHash(deps, partner.id, receiver, code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    now,
  });
  const sent = await deps.mailer.sendPartnerNotice({
    to: receiver,
    name: partner.displayName,
    subject: "Confirm your PayPal address for RepGet payouts",
    lines: [
      `Your confirmation code is ${code}.`,
      "Enter it on your RepGet partner payout page within 30 minutes to receive your payouts at this PayPal address.",
      "If you did not ask for this, ignore this email: nothing changes.",
    ],
    portalUrl: `${deps.settings.appUrl()}/partner/payouts`,
  });
  if (!sent.ok) return fail("ineligible", "email_not_sent");
  return ok({ receiver });
}

function codeHash(deps: PartnerDeps, partnerId: string, receiver: string, code: string): string {
  return deps.hasher.hmac(`partner-paypal:${partnerId}:${receiver}:${code}`);
}

export async function verifyPayPalRecipient(deps: PartnerDeps, input: { partnerId: string; code: string }): Promise<Result<{ receiver: string }>> {
  const environment = deps.settings.environment();
  if (!environment) return fail("ineligible", "not_configured");
  const repos = deps.uow.repositories;
  const account = await repos.paypalPayouts.findAccount(input.partnerId, environment);
  if (!account || account.status !== "pending_verification" || !account.verificationCodeHash || !account.verificationExpiresAt) {
    return fail("invalid", "no_code");
  }
  const now = deps.clock.now();
  if (account.verificationExpiresAt.getTime() < now.getTime()) return fail("invalid", "code_expired");
  const attempts = await repos.paypalPayouts.countVerificationAttempt(account.id, now);
  if (attempts > MAX_CODE_ATTEMPTS) return fail("rate_limited", "too_many_attempts");
  const code = input.code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code) || codeHash(deps, input.partnerId, account.receiver, code) !== account.verificationCodeHash) {
    return fail("invalid", "code");
  }
  await repos.paypalPayouts.markVerified(account.id, now);
  return ok({ receiver: account.receiver });
}

/** The partner's choice between their Stripe bank payouts and PayPal. Future runs follow it; one already prepared does not change. */
export async function choosePayoutMethod(deps: PartnerDeps, input: { partnerId: string; method: "stripe" | "paypal" }): Promise<Result<null>> {
  const environment = deps.settings.environment();
  if (!environment) return fail("ineligible", "not_configured");
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(input.partnerId);
  if (!partner || partner.status !== "active") return fail("forbidden");
  if (input.method === "paypal") {
    const availability = payPalPayoutAvailability(deps, partner);
    if (!availability.available) return fail("ineligible", availability.reason);
    const account = await repos.paypalPayouts.findAccount(partner.id, environment);
    if (account?.status !== "verified") return fail("invalid", "paypal_not_verified");
  }
  await repos.paypalPayouts.setPayoutMethod(partner.id, input.method, deps.clock.now());
  return ok(null);
}

/* ---------------------------------------------------------------- execute */

type Step = { next: Date; error?: string };

/**
 * One run of a PayPal settlement, under the settlement's work lease
 * (execute-transfer.ts executeSettlement). Safe to repeat at any point.
 */
export async function payPalStage(deps: PartnerDeps, settlement: SettlementRecord): Promise<Step> {
  const now = deps.clock.now();
  const repos = deps.uow.repositories;
  const attempts = await repos.paypalPayouts.attempts(settlement.id);
  if (attempts.some((attempt) => attempt.status === "succeeded" || attempt.status === "reversed")) {
    // Settled already (a reversal since is a review case of its own).
    return { next: new Date(now.getTime() + 24 * HOUR) };
  }
  const live = attempts.find((attempt) => ["processing", "unknown", "pending"].includes(attempt.status));
  if (live) {
    if (live.mode === "manual") return { next: new Date(now.getTime() + 24 * HOUR), error: "manual_payout_awaiting_confirmation" };
    return syncAutomatedAttempt(deps, settlement, live);
  }
  if (settlement.state !== "reserved") return { next: new Date(now.getTime() + 24 * HOUR) };

  // ---- a new attempt: only from "reserved", only after the pre-flight passes ----
  const partner = await repos.partners.findById(settlement.partnerId);
  const preflight = await payPalPreflight(deps, settlement, partner);
  if (preflight) return { next: new Date(now.getTime() + 6 * HOUR), error: preflight };
  const availability = payPalPayoutAvailability(deps, partner!);
  if (!availability.available) return { next: new Date(now.getTime() + 6 * HOUR), error: availability.reason };
  // Manual: a person sends it and records it (recordManualPayPalPayout); nothing automatic.
  if (availability.mode === "manual") return { next: new Date(now.getTime() + 24 * HOUR), error: "manual_payout_to_send" };

  const account = (await repos.paypalPayouts.findAccountById(settlement.paypalAccountId!))!;
  const number = attempts.length + 1;
  const attempt = await recordAttempt(deps, settlement, { mode: "automated", number, receiver: account.receiver });
  if (attempt === "changed") return { next: new Date(now.getTime() + 24 * HOUR), error: "allocations_changed" };
  if (!attempt) return { next: new Date(now.getTime() + 5 * MINUTE), error: "attempt_exists" };
  return submit(deps, settlement, attempt);
}

/** Everything a new or repeated PayPal payout needs, re-checked each time. Null when it may go. */
async function payPalPreflight(deps: PartnerDeps, settlement: SettlementRecord, partner: PartnerRecord | null): Promise<string | null> {
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_payouts"))) return "payouts_disabled";
  if (!deps.settings.moneyMovementAllowed(settlement.environment)) return "money_movement_blocked";
  if (!partner || !canReceiveAutomaticPayout(partner)) return partner?.status === "suspended" ? "partner_suspended" : "payout_hold";
  if (!settlement.paypalAccountId) return "no_paypal_account";
  const account = await repos.paypalPayouts.findAccountById(settlement.paypalAccountId);
  // The account the settlement was made for, still verified: a changed address is not paid.
  if (!account || account.status !== "verified" || account.partnerId !== settlement.partnerId) return "paypal_account_not_verified";
  const mode = deps.settings.paypalPayoutMode?.() ?? "off";
  if (mode === "automated" && deps.paypalPayouts && deps.paypalPayouts.environment() !== settlement.environment) return "wrong_environment";
  return null;
}

/**
 * Records a new attempt, re-checking the allocations IN the same transaction
 * (a refund, hold or rejection since the reservation means the plan no
 * longer holds) and moving the settlement to transfer_processing.
 */
async function recordAttempt(
  deps: PartnerDeps,
  settlement: SettlementRecord,
  input: { mode: "automated" | "manual"; number: number; receiver: string; status?: "processing" | "pending"; transactionId?: string; recordedBy?: string; note?: string },
): Promise<PayPalPayoutRecord | "changed" | null> {
  return deps.uow.transaction(async (tx) => {
    const items = await tx.settlements.items(settlement.id, true);
    const gross = items.reduce((sum, item) => sum + item.amount, BigInt(0));
    for (const item of [...items].sort((a, b) => (a.commissionId < b.commissionId ? -1 : 1))) {
      const commission = await tx.commissions.lockCommission(item.commissionId);
      const unchanged =
        commission !== null &&
        commission.status === "reserved" &&
        commission.amount - commission.reversedAmount === item.amount &&
        commission.holdReason === null &&
        commission.reviewState === "approved";
      if (!unchanged) return "changed" as const;
    }
    if (gross !== settlement.grossAmount) return "changed" as const;
    const created = await tx.paypalPayouts.createAttempt({
      settlementId: settlement.id,
      attemptNumber: input.number,
      environment: settlement.environment,
      mode: input.mode,
      paypalAccountId: settlement.paypalAccountId!,
      receiver: input.receiver,
      currency: settlement.currency,
      amount: settlement.transferAmount,
      senderBatchId: payPalSenderBatchId(settlement.id, input.number),
      status: input.status ?? "processing",
      transactionId: input.transactionId ?? null,
      recordedBy: input.recordedBy ?? null,
      note: input.note ?? null,
      submittedAt: deps.clock.now(),
    });
    if (!created) return null;
    if (!(await tx.settlements.setState(settlement.id, ["reserved"], "transfer_processing"))) throw new Error("Settlement changed state during submission");
    return created;
  });
}

/** Sends (or re-sends, with the same ids) an automated attempt's request. */
async function submit(deps: PartnerDeps, settlement: SettlementRecord, attempt: PayPalPayoutRecord): Promise<Step> {
  const gateway = deps.paypalPayouts!;
  const now = deps.clock.now();
  const outcome = await gateway.createPayout({
    senderBatchId: attempt.senderBatchId,
    receiver: attempt.receiver,
    amount: attempt.amount,
    currency: attempt.currency,
    note: "Your RepGet partner commission",
  });
  if (outcome.kind === "unknown") {
    await deps.uow.transaction(async (tx) => {
      await tx.paypalPayouts.updateAttempt(attempt.id, ["processing", "unknown"], { status: "unknown", error: outcome.message.slice(0, 300), now });
      await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown"], "transfer_unknown", { lastError: "paypal_payout_unknown" });
    });
    return { next: new Date(now.getTime() + 10 * MINUTE), error: "paypal_payout_unknown" };
  }
  if (outcome.kind === "refused") {
    // PayPal processed the request and made nothing: released for a person (a wrong address, no Payouts access...).
    await deps.uow.transaction(async (tx) => {
      await tx.paypalPayouts.updateAttempt(attempt.id, ["processing", "unknown"], { status: "failed", error: `${outcome.code ?? "refused"}: ${outcome.message}`.slice(0, 300), now });
    });
    await review(deps, settlement, `PayPal refused a partner payout (${outcome.code ?? "no code"})`, { senderBatchId: attempt.senderBatchId, message: outcome.message });
    return { next: new Date(now.getTime() + 24 * HOUR), error: outcome.code ?? "refused" };
  }
  await deps.uow.repositories.paypalPayouts.updateAttempt(attempt.id, ["processing", "unknown"], {
    status: "pending",
    payoutBatchId: outcome.value.batchId,
    payoutItemId: outcome.value.itemId,
    providerStatus: outcome.value.itemStatus ?? outcome.value.batchStatus,
    now,
  });
  // The batch is processed by PayPal shortly; its item is read on the next run, or arrives by webhook.
  return { next: new Date(now.getTime() + 5 * MINUTE) };
}

/** An automated attempt with no final answer yet: read from PayPal, or repeated with the same ids. */
async function syncAutomatedAttempt(deps: PartnerDeps, settlement: SettlementRecord, attempt: PayPalPayoutRecord): Promise<Step> {
  const gateway = deps.paypalPayouts;
  const now = deps.clock.now();
  if (!gateway) return { next: new Date(now.getTime() + 6 * HOUR), error: "paypal_not_configured" };
  if (!attempt.payoutBatchId) {
    /*
      No batch id: the request may never have reached PayPal, so repeating it
      may be its FIRST real submission - allowed only while a new payout
      would be. Within PayPal's 30 days the same sender_batch_id and request
      id return the original batch if there was one.
    */
    const partner = await deps.uow.repositories.partners.findById(settlement.partnerId);
    const blocked = await payPalPreflight(deps, settlement, partner);
    if (blocked) return { next: new Date(now.getTime() + HOUR), error: `paypal_payout_unknown_held:${blocked}` };
    if (now.getTime() - attempt.submittedAt.getTime() > 29 * 24 * HOUR) {
      await review(deps, settlement, "a PayPal payout had no answer for its whole idempotency window", { senderBatchId: attempt.senderBatchId });
      return { next: new Date(now.getTime() + 24 * HOUR), error: "paypal_payout_unresolved" };
    }
    return submit(deps, settlement, attempt);
  }
  const evidence = attempt.payoutItemId ? await gateway.getItem(attempt.payoutItemId) : await gateway.getBatch(attempt.payoutBatchId);
  return applyItem(deps, settlement, attempt, evidence);
}

/** A PayPal item's status, applied once. Also the webhook's path (syncPayPalPayoutItem). */
async function applyItem(deps: PartnerDeps, settlement: SettlementRecord, attempt: PayPalPayoutRecord, evidence: PayPalPayoutEvidence): Promise<Step> {
  const now = deps.clock.now();
  const repos = deps.uow.repositories;
  const status = (evidence.itemStatus ?? "").toUpperCase();
  if (evidence.itemId && !attempt.payoutItemId) {
    await repos.paypalPayouts.updateAttempt(attempt.id, ["pending", "processing", "unknown"], { payoutItemId: evidence.itemId, now });
  }
  if (!status || ITEM_WAITING.has(status)) {
    await repos.paypalPayouts.updateAttempt(attempt.id, ["pending", "processing", "unknown"], { status: "pending", providerStatus: status || evidence.batchStatus, now });
    // UNCLAIMED: the address has no PayPal account yet; PayPal returns it after 30 days if never claimed.
    return { next: new Date(now.getTime() + (status === "UNCLAIMED" ? 24 * HOUR : 30 * MINUTE)), error: status === "UNCLAIMED" ? "paypal_unclaimed" : undefined };
  }
  if (ITEM_SETTLED.has(status)) {
    const matches =
      evidence.amount === attempt.amount &&
      (evidence.currency ?? "").toLowerCase() === attempt.currency &&
      (!evidence.receiver || evidence.receiver.toLowerCase() === attempt.receiver);
    if (!matches) {
      await review(deps, settlement, "a PayPal payout that does not match its settlement", { item: evidence.itemId ?? "", amount: String(evidence.amount ?? ""), receiver: evidence.receiver ?? "" });
      return { next: new Date(now.getTime() + 24 * HOUR), error: "paypal_payout_mismatch" };
    }
    await confirmPayPal(deps, settlement, attempt, { transactionId: evidence.transactionId, fee: evidence.fee, providerStatus: status, actor: "system" });
    return { next: now };
  }
  if (ITEM_NOT_PAID.has(status)) {
    await repos.paypalPayouts.updateAttempt(attempt.id, ["pending", "processing", "unknown"], { status: "failed", providerStatus: status, error: evidence.error, completedAt: now, now });
    await review(deps, settlement, `PayPal did not deliver a partner payout (${status}); nothing reached the partner`, { item: evidence.itemId ?? "", status, error: evidence.error ?? "" });
    return { next: new Date(now.getTime() + 24 * HOUR), error: `paypal_${status.toLowerCase()}` };
  }
  if (ITEM_TAKEN_BACK.has(status)) return takeBack(deps, settlement, attempt, status);
  await review(deps, settlement, `PayPal reported an unexpected payout status (${status})`, { item: evidence.itemId ?? "", status });
  return { next: new Date(now.getTime() + 24 * HOUR), error: "paypal_status_unknown" };
}

/** The liability settled ONCE: the ledger, the attempt, the commissions, the settlement. */
async function confirmPayPal(
  deps: PartnerDeps,
  settlement: SettlementRecord,
  attempt: PayPalPayoutRecord,
  input: { transactionId: string | null; fee: bigint | null; providerStatus: string; actor: string },
) {
  const now = deps.clock.now();
  await deps.uow.transaction(async (tx) => {
    // Lock order: commissions before the settlement, as everywhere else.
    const items = await tx.settlements.items(settlement.id, true);
    const locked = [];
    for (const item of [...items].sort((a, b) => (a.commissionId < b.commissionId ? -1 : 1))) locked.push(await tx.commissions.lockCommission(item.commissionId));
    const moved = await tx.paypalPayouts.updateAttempt(attempt.id, ["processing", "unknown", "pending"], {
      status: "succeeded",
      providerStatus: input.providerStatus,
      transactionId: input.transactionId ?? attempt.transactionId,
      fee: input.fee,
      completedAt: now,
      error: null,
      now,
    });
    if (!moved) return; // Confirmed already by a concurrent run.
    await tx.commissions.appendLedger({
      environment: settlement.environment,
      partnerId: settlement.partnerId,
      currency: settlement.currency,
      kind: "transfer_confirmed",
      amount: -settlement.transferAmount,
      operationKey: `paypal-payout:${attempt.id}`,
      settlementId: settlement.id,
      reason: `Paid ${Money.of(settlement.transferAmount, settlement.currency).toDecimalString()} ${settlement.currency.toUpperCase()} to the partner's PayPal account (${attempt.mode}${input.transactionId ? `, ${input.transactionId}` : ""})`,
      actor: input.actor,
    });
    await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown", "reserved", "needs_review"], "transferred", { transferredAt: now, lastError: null });
    // No bank stage: the money is in the partner's PayPal account.
    await tx.settlements.setState(settlement.id, ["transferred"], "paid", { paidAt: now });
    for (const commission of locked) {
      if (commission && commission.status === "reserved") await tx.commissions.updateCommission(commission.id, { status: "paid", paidSettlementId: settlement.id });
    }
  });
  await notifyPartner(deps, settlement, "paid");
}

/** Paid, then taken back by PayPal (REFUNDED, REVERSED): the liability returns once, and a person looks at it. */
async function takeBack(deps: PartnerDeps, settlement: SettlementRecord, attempt: PayPalPayoutRecord, status: string): Promise<Step> {
  const now = deps.clock.now();
  if (attempt.status !== "succeeded") {
    // Never settled here: it simply did not pay.
    await deps.uow.repositories.paypalPayouts.updateAttempt(attempt.id, ["pending", "processing", "unknown"], { status: "failed", providerStatus: status, completedAt: now, now });
    await review(deps, settlement, `PayPal reported a partner payout ${status.toLowerCase()} before it was settled`, { senderBatchId: attempt.senderBatchId, status });
    return { next: new Date(now.getTime() + 24 * HOUR), error: `paypal_${status.toLowerCase()}` };
  }
  await deps.uow.transaction(async (tx) => {
    const moved = await tx.paypalPayouts.updateAttempt(attempt.id, ["succeeded"], { status: "reversed", providerStatus: status, now });
    if (!moved) return;
    await tx.commissions.appendLedger({
      environment: settlement.environment,
      partnerId: settlement.partnerId,
      currency: settlement.currency,
      kind: "transfer_reversal",
      amount: settlement.transferAmount,
      operationKey: `paypal-payout-reversal:${attempt.id}`,
      settlementId: settlement.id,
      reason: `PayPal ${status.toLowerCase()} the payout to the partner (${attempt.payoutItemId ?? attempt.senderBatchId})`,
      actor: "system",
    });
  });
  await review(deps, settlement, `a PayPal payout already settled was ${status.toLowerCase()}: what RepGet owes the partner went back up`, { item: attempt.payoutItemId ?? "", status });
  return { next: new Date(now.getTime() + 24 * HOUR), error: `paypal_${status.toLowerCase()}` };
}

/** PayPal's webhook for a payout item (PAYMENT.PAYOUTS-ITEM.*): the item is read again and applied. */
export async function syncPayPalPayoutItem(deps: PartnerDeps, payoutItemId: string): Promise<{ outcome: string; partnerIds: string[] }> {
  const gateway = deps.paypalPayouts;
  if (!gateway) return { outcome: "not_relevant", partnerIds: [] };
  const repos = deps.uow.repositories;
  const attempt = await repos.paypalPayouts.findAttemptByItem(payoutItemId);
  if (!attempt) {
    // Perhaps ours before its item id was stored: the item names its batch.
    const evidence = await gateway.getItem(payoutItemId);
    const byBatch = evidence.senderBatchId?.startsWith("repget-partner-") ? evidence.senderBatchId : null;
    if (!byBatch) return { outcome: "not_relevant", partnerIds: [] };
    const settlementId = byBatch.slice("repget-partner-".length).replace(/-\d+$/, "");
    const settlement = await repos.settlements.findById(settlementId);
    const own = settlement ? (await repos.paypalPayouts.attempts(settlement.id)).find((a) => a.senderBatchId === byBatch) : undefined;
    if (!settlement || !own) return { outcome: "not_relevant", partnerIds: [] };
    await applyItem(deps, settlement, own, evidence);
    return { outcome: "applied", partnerIds: [settlement.partnerId] };
  }
  const settlement = await repos.settlements.findById(attempt.settlementId);
  if (!settlement) return { outcome: "not_relevant", partnerIds: [] };
  await applyItem(deps, settlement, attempt, await gateway.getItem(payoutItemId));
  return { outcome: "applied", partnerIds: [settlement.partnerId] };
}

/* ----------------------------------------------------------------- manual */

/**
 * MANUAL mode, step 1: a person has sent this settlement's amount to the
 * partner's verified PayPal address in PayPal, and records PayPal's
 * transaction id. The commissions stay reserved; nothing is settled yet.
 */
export async function recordManualPayPalPayout(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { settlementId: string; transactionId: string; note: string },
): Promise<Result<{ attemptId: string }>> {
  const repos = deps.uow.repositories;
  const settlement = await repos.settlements.findById(input.settlementId);
  if (!settlement || settlement.payoutMethod !== "paypal") return fail("not_found");
  if ((deps.settings.paypalPayoutMode?.() ?? "off") !== "manual") return fail("ineligible", "not_manual_mode");
  if (settlement.state !== "reserved") return fail("invalid", `state_${settlement.state}`);
  const transactionId = input.transactionId.trim().toUpperCase();
  // PayPal transaction ids are 17 characters, letters and digits.
  if (!/^[A-Z0-9]{17}$/.test(transactionId)) return fail("invalid", "transaction_id");
  const partner = await repos.partners.findById(settlement.partnerId);
  const blocked = await payPalPreflight(deps, settlement, partner);
  if (blocked) return fail("ineligible", blocked);
  const account = (await repos.paypalPayouts.findAccountById(settlement.paypalAccountId!))!;
  const attempts = await repos.paypalPayouts.attempts(settlement.id);
  const recorded = await recordAttempt(deps, settlement, {
    mode: "manual",
    number: attempts.length + 1,
    receiver: account.receiver,
    status: "pending",
    transactionId,
    recordedBy: admin.email,
    note: input.note.trim().slice(0, 500),
  });
  if (recorded === "changed") return fail("invalid", "allocations_changed");
  if (!recorded) return fail("invalid", "attempt_exists");
  await repos.audit.record({
    actorEmail: admin.email,
    action: "partner.paypal_payout_recorded",
    targetType: "partner_settlement",
    targetId: settlement.id,
    summary: `Recorded a MANUAL PayPal payment of ${Money.of(settlement.transferAmount, settlement.currency).toDecimalString()} ${settlement.currency.toUpperCase()} to ${account.receiver} (${transactionId})`,
    detail: { transactionId, note: input.note.trim().slice(0, 500), receiver: account.receiver },
  });
  return ok({ attemptId: recorded.id });
}

/**
 * MANUAL mode, step 2: the payment recorded in step 1 is confirmed in PayPal
 * (completed, to that address, for that amount). Only then is the liability
 * settled. A different person from the one who recorded it, so one mistake
 * cannot both send and settle.
 */
export async function confirmManualPayPalPayout(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { settlementId: string; confirmation: string },
): Promise<Result<null>> {
  const repos = deps.uow.repositories;
  const settlement = await repos.settlements.findById(input.settlementId);
  if (!settlement || settlement.payoutMethod !== "paypal") return fail("not_found");
  const attempt = (await repos.paypalPayouts.attempts(settlement.id)).find((a) => a.mode === "manual" && a.status === "pending");
  if (!attempt) return fail("invalid", "nothing_recorded");
  if (attempt.recordedBy && attempt.recordedBy.toLowerCase() === admin.email.toLowerCase()) return fail("forbidden", "same_person");
  if (input.confirmation.trim().toUpperCase() !== attempt.transactionId) return fail("invalid", "transaction_id_mismatch");
  await confirmPayPal(deps, settlement, attempt, { transactionId: attempt.transactionId, fee: null, providerStatus: "MANUAL_CONFIRMED", actor: admin.email });
  await repos.audit.record({
    actorEmail: admin.email,
    action: "partner.paypal_payout_confirmed",
    targetType: "partner_settlement",
    targetId: settlement.id,
    summary: `Confirmed the MANUAL PayPal payment ${attempt.transactionId} in PayPal; the payout is settled`,
    detail: { transactionId: attempt.transactionId, recordedBy: attempt.recordedBy },
  });
  return ok(null);
}

/** A recorded manual payment that turned out not to have gone through: released, so it can be sent again. */
export async function voidManualPayPalPayout(deps: PartnerDeps, admin: AdminContext, input: { settlementId: string; reason: string }): Promise<Result<null>> {
  if (input.reason.trim().length < 3) return fail("invalid", "reason");
  const repos = deps.uow.repositories;
  const settlement = await repos.settlements.findById(input.settlementId);
  if (!settlement) return fail("not_found");
  const attempt = (await repos.paypalPayouts.attempts(settlement.id)).find((a) => a.mode === "manual" && a.status === "pending");
  if (!attempt) return fail("invalid", "nothing_recorded");
  const now = deps.clock.now();
  await deps.uow.transaction(async (tx) => {
    await tx.paypalPayouts.updateAttempt(attempt.id, ["pending"], { status: "failed", error: `voided: ${input.reason.trim()}`.slice(0, 300), completedAt: now, now });
    await tx.settlements.setState(settlement.id, ["transfer_processing"], "reserved", { lastError: "manual_payout_voided" });
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.paypal_payout_voided",
      targetType: "partner_settlement",
      targetId: settlement.id,
      summary: `Voided the recorded MANUAL PayPal payment ${attempt.transactionId}: ${input.reason.trim()}`,
      detail: { transactionId: attempt.transactionId, reason: input.reason.trim() },
    });
  });
  return ok(null);
}

/* ------------------------------------------------------------------ misc */

async function review(deps: PartnerDeps, settlement: SettlementRecord, what: string, evidence: Record<string, string>) {
  await deps.uow.transaction(async (tx) => {
    await tx.settlements.setState(settlement.id, ["reserved", "transfer_processing", "transfer_unknown", "transferred", "paid"], "needs_review", { reviewReason: what });
    await tx.reviews.open({
      kind: "payout_discrepancy",
      dedupeKey: `paypal_payout:${settlement.id}:${what}`,
      environment: settlement.environment,
      partnerId: settlement.partnerId,
      attributionId: null,
      commissionId: null,
      settlementId: settlement.id,
      paymentFactId: null,
      organizationId: null,
      summary: `A partner PayPal payout needs a person: ${what}`,
      evidence,
    });
  });
}

async function notifyPartner(deps: PartnerDeps, settlement: SettlementRecord, stage: "paid") {
  try {
    const partner = await deps.uow.repositories.partners.findById(settlement.partnerId);
    if (!partner) return;
    const amount = `${Money.of(settlement.transferAmount, settlement.currency).toDecimalString()} ${settlement.currency.toUpperCase()}`;
    await deps.mailer.sendPartnerNotice({
      to: partner.contactEmail,
      name: partner.displayName,
      subject: "Your RepGet partner payout",
      lines: stage === "paid" ? [`We sent ${amount} to your PayPal account.`] : [],
      portalUrl: `${deps.settings.appUrl()}/partner/payouts`,
    });
  } catch (error) {
    console.error("[partners] PayPal payout notice not sent", error);
  }
}

export type { Environment };
