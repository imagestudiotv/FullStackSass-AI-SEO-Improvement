import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The PayPal webhook's signature check: PayPal is asked about the event
 * EXACTLY as it sent it. The verification call and the event handling are
 * replaced; nothing reaches PayPal or a database.
 */

const state = vi.hoisted(() => ({ configured: true }));
const mocks = vi.hoisted(() => ({
  payPalRequest: vi.fn(),
  processPayPalEvent: vi.fn(),
  claimWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => state.configured,
  payPalRequest: mocks.payPalRequest,
}));
vi.mock("@/lib/billing/paypal-events", () => ({ processPayPalEvent: mocks.processPayPalEvent }));
vi.mock("@/lib/billing/webhook-events", () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
  completeWebhookEvent: vi.fn(async () => true),
  releaseWebhookEvent: vi.fn(),
}));

import { POST } from "@/app/api/paypal/webhook/route";

const HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-1",
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-sig": "sig==",
  "paypal-transmission-time": "2026-10-10T08:00:00Z",
};

function deliver(body: string) {
  return POST(new Request("https://www.repget.test/api/paypal/webhook", { method: "POST", body, headers: HEADERS }));
}

/*
  What PayPal really sends can differ from JSON.stringify's output: escaped
  slashes and characters, a number written "1.10", spacing. PayPal checks
  the event against what it signed, so these bytes must survive untouched.
*/
const RAW = String.raw`{"id":"WH-1","event_type":"PAYMENT.SALE.COMPLETED", "resource":{"id":"SALE-1","billing_agreement_id":"I-1","note":"caf\u00e9 \/ r\u00e9sum\u00e9","amount":{"total":"10.10","currency":"EUR"},"rate":1.10}}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TEST");
  state.configured = true;
  mocks.payPalRequest.mockResolvedValue({ verification_status: "SUCCESS" });
  mocks.claimWebhookEvent.mockResolvedValue({ claimed: true, token: "claim-1" });
});

describe("verifying a delivery with PayPal", () => {
  it("sends PayPal the raw body, unchanged, inside the verification request", async () => {
    // The test only means something if re-serialising would change it.
    expect(JSON.stringify(JSON.parse(RAW))).not.toBe(RAW);

    const response = await deliver(RAW);

    expect(response.status).toBe(200);
    const [path, init] = mocks.payPalRequest.mock.calls[0];
    expect(path).toBe("/v1/notifications/verify-webhook-signature");
    expect(init.method).toBe("POST");
    expect(typeof init.body).toBe("string");
    expect(init.body.endsWith(`,"webhook_event":${RAW}}`)).toBe(true);

    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      auth_algo: "SHA256withRSA",
      cert_url: HEADERS["paypal-cert-url"],
      transmission_id: "tx-1",
      transmission_sig: "sig==",
      transmission_time: "2026-10-10T08:00:00Z",
      webhook_id: "WH-TEST",
    });
    expect(sent.webhook_event).toEqual(JSON.parse(RAW));
    expect(mocks.processPayPalEvent).toHaveBeenCalledWith(JSON.parse(RAW));
  });

  it("refuses a body that is not JSON without asking PayPal", async () => {
    const response = await deliver("not json");
    expect(response.status).toBe(400);
    expect(mocks.payPalRequest).not.toHaveBeenCalled();
    expect(mocks.processPayPalEvent).not.toHaveBeenCalled();
  });

  it("refuses what PayPal does not confirm", async () => {
    mocks.payPalRequest.mockResolvedValueOnce({ verification_status: "FAILURE" });
    expect((await deliver(RAW)).status).toBe(400);
    expect(mocks.processPayPalEvent).not.toHaveBeenCalled();
  });

  it("answers 500 while PayPal is not configured, so PayPal retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.configured = false;
    expect((await deliver(RAW)).status).toBe(500);
    expect(mocks.payPalRequest).not.toHaveBeenCalled();
  });
});
