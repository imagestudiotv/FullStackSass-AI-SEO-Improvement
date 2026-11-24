import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What PayPal's and Stripe's answers mean for a partner's money (cash audit,
 * 2026-11-24). No network: PayPal's HTTP call and Stripe's SDK are fakes.
 */

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/paypal/client", async (original) => ({ ...(await original<object>()), payPalRequest: request }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async (input: unknown) => ({ ok: true, input })) }));

import { sendEmail } from "@/lib/email/send";
import { PayPalError } from "@/lib/paypal/client";

import { partnerMailer, WELCOME_PAYOUT } from "./notifications";
import { payPalPayoutGateway } from "./paypal/payout-gateway";
import { stripePayoutGateway } from "./stripe/payout-gateway";

const payout = { senderBatchId: "repget-partner-x-1", receiver: "p@example.test", amount: BigInt(4950), currency: "eur", note: "note" };

beforeEach(() => request.mockReset());

describe("PayPal's answer to a payout request", () => {
  const create = async (error: Error) => {
    request.mockRejectedValueOnce(error);
    return payPalPayoutGateway("test").createPayout(payout);
  };

  it.each([
    ["the batch id was used already", new PayPalError("User business error.", "rejected", 400, "Batch with given sender_batch_id already exists")],
    ["the request id was used already", new PayPalError("The value of PayPal-Request-Id header has already been used", "rejected", 422, "DUPLICATE_REQUEST_ID")],
    ["another request with the key is running", new PayPalError("Conflict", "rejected", 409)],
    ["no answer", new PayPalError("PayPal took too long to respond", "unknown")],
    ["a server error", new PayPalError("PayPal returned 503 with no usable answer", "unknown", 503)],
  ])("%s: unknown, because the payout may exist", async (_name, error) => {
    expect(await create(error)).toMatchObject({ kind: "unknown" });
  });

  it.each([
    [new PayPalError("Authorization error occurred", "rejected", 403, "AUTHORIZATION_ERROR"), "AUTHORIZATION_ERROR"],
    [new PayPalError("Sender has insufficient funds", "rejected", 422, "INSUFFICIENT_FUNDS"), "INSUFFICIENT_FUNDS"],
    [new PayPalError("Too many requests", "rejected", 429), "RATE_LIMIT_REACHED"],
    [new PayPalError("PayPal rejected the credentials", "auth", 401), "auth"],
  ])("%s is a refusal of that request, with its code", async (error, code) => {
    expect(await create(error)).toMatchObject({ kind: "refused", code });
  });
});

describe("Stripe's answers", () => {
  it("say what a transfer became on the connected account", async () => {
    const retrieve = vi.fn(async () => ({ balance_transaction: { currency: "ron", net: 24600 } }));
    const stripe = { transfers: { retrieve: async () => ({ destination_payment: "py_1" }) }, charges: { retrieve } } as unknown as Stripe;
    expect(await stripePayoutGateway(stripe, "test").transferArrival("tr_1", "acct_1")).toEqual({ currency: "ron", amount: BigInt(24600) });
    expect(retrieve).toHaveBeenCalledWith("py_1", { expand: ["balance_transaction"] }, { stripeAccount: "acct_1" });
  });

  it.each([
    [{ statusCode: 403, code: "account_invalid" }, "deauthorized"],
    [{ statusCode: 404, code: "resource_missing" }, "deauthorized"],
  ])("%o means the account is gone", async (error, status) => {
    const stripe = { accounts: { retrieve: async () => Promise.reject(error) } } as unknown as Stripe;
    expect(await stripePayoutGateway(stripe, "test").retrieveAccount("acct_1")).toMatchObject({ status, accountId: "acct_1" });
  });

  it.each([{ statusCode: 500 }, { statusCode: 429, code: "rate_limit" }, { statusCode: 401 }, { statusCode: 403, code: "more_permissions_required" }])(
    "%o says nothing about the account, so it is tried again",
    async (error) => {
      const stripe = { accounts: { retrieve: async () => Promise.reject(error) } } as unknown as Stripe;
      await expect(stripePayoutGateway(stripe, "test").retrieveAccount("acct_1")).rejects.toBe(error);
    },
  );
});

describe("the welcome email", () => {
  it.each(Object.keys(WELCOME_PAYOUT) as (keyof typeof WELCOME_PAYOUT)[])("asks only for the setup this partner needs (%s)", async (method) => {
    await partnerMailer.sendPartnerWelcome({ to: "p@example.test", name: "Ann", referralUrl: "https://repget.test/?ref=ann", portalUrl: "https://repget.test/partner", payout: method });
    const sent = vi.mocked(sendEmail).mock.calls.at(-1)![0] as { text: string; html: string };
    expect(sent.text).toContain(WELCOME_PAYOUT[method]);
    if (method === "credits" || method === "paypal" || method === "unavailable") expect(sent.text + sent.html).not.toContain("Stripe");
  });
});
