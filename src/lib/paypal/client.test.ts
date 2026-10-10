import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * When PayPal counts as configured, which API it talks to, and what a
 * failed answer becomes. fetch is replaced; nothing reaches PayPal. Each
 * test loads a fresh module, so no access token is cached between them.
 */

async function freshClient() {
  vi.resetModules();
  return import("@/lib/paypal/client");
}

const READY = {
  PAYPAL_CLIENT_ID: "client-id",
  PAYPAL_CLIENT_SECRET: "client-secret",
  PAYPAL_WEBHOOK_ID: "WH-TEST",
  PAYPAL_ENV: "",
};

/** fetch answering these responses in order. */
function respond(...responses: Response[]) {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const token = () => new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });

beforeEach(() => {
  for (const [name, value] of Object.entries(READY)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("whether PayPal is offered", () => {
  it("needs both credentials, the webhook id and a valid PAYPAL_ENV", async () => {
    const client = await freshClient();
    expect(client.isPayPalConfigured()).toBe(true);

    // Without the webhook id every event is refused: a customer would pay and get nothing.
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    expect(client.isPayPalConfigured()).toBe(false);
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TEST");

    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    expect(client.isPayPalConfigured()).toBe(false);
  });

  it("reads PAYPAL_ENV strictly: unset is sandbox, a typo switches PayPal off and says so", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = await freshClient();

    expect(client.payPalMode()).toBe("sandbox");
    expect(client.apiBase()).toBe("https://api-m.sandbox.paypal.com");
    vi.stubEnv("PAYPAL_ENV", "sandbox");
    expect(client.apiBase()).toBe("https://api-m.sandbox.paypal.com");
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(client.apiBase()).toBe("https://api-m.paypal.com");

    for (const typo of ["Live", "production", "LIVE "]) {
      vi.stubEnv("PAYPAL_ENV", typo);
      expect(client.payPalMode()).toBeNull();
      expect(client.isPayPalConfigured()).toBe(false);
      // Never a silent fall back to the sandbox.
      expect(() => client.apiBase()).toThrow(client.PayPalError);
    }
    expect(error).toHaveBeenCalledWith(expect.stringContaining('PAYPAL_ENV is "production"'));
  });

  it("calls no PayPal API with an invalid PAYPAL_ENV", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("PAYPAL_ENV", "production");
    const fetch = respond(token());
    const client = await freshClient();

    await expect(client.payPalRequest("/v1/billing/subscriptions/I-1")).rejects.toMatchObject({ kind: "config" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("what a failed answer becomes", () => {
  it("a gateway's HTML 502 is unknown, never a SyntaxError", async () => {
    respond(token(), new Response("<html><body>502 Bad Gateway</body></html>", { status: 502 }));
    const client = await freshClient();

    const error = await client.payPalRequest("/v1/billing/subscriptions").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(client.PayPalError);
    expect(error).toMatchObject({ kind: "unknown", status: 502 });
  });

  it("a 5xx with a JSON body is unknown too: PayPal may have acted on it", async () => {
    respond(token(), new Response(JSON.stringify({ name: "INTERNAL_SERVER_ERROR" }), { status: 500 }));
    const client = await freshClient();

    await expect(client.payPalRequest("/v1/billing/subscriptions")).rejects.toMatchObject({ kind: "unknown", status: 500 });
  });

  it("a success whose body is not JSON is unknown", async () => {
    respond(token(), new Response("OK", { status: 200 }));
    const client = await freshClient();

    await expect(client.payPalRequest("/v1/billing/subscriptions")).rejects.toMatchObject({ kind: "unknown" });
  });

  it("a 4xx with PayPal's message is a refusal", async () => {
    respond(token(), new Response(JSON.stringify({ message: "Plan is inactive" }), { status: 422 }));
    const client = await freshClient();

    await expect(client.payPalRequest("/v1/billing/subscriptions")).rejects.toMatchObject({
      kind: "rejected",
      status: 422,
      message: "Plan is inactive",
    });
  });

  it("a token endpoint answering HTML is a PayPalError, before any request is sent", async () => {
    const fetch = respond(new Response("<html>Service Unavailable</html>", { status: 503 }));
    const client = await freshClient();

    const error = await client.payPalRequest("/v1/billing/subscriptions").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(client.PayPalError);
    expect(error).toMatchObject({ kind: "auth", status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reads a normal answer, and an empty one as null", async () => {
    respond(
      token(),
      new Response(JSON.stringify({ id: "I-1", status: "ACTIVE" }), { status: 200 }),
      new Response(null, { status: 204 }),
    );
    const client = await freshClient();

    await expect(client.payPalRequest("/v1/billing/subscriptions/I-1")).resolves.toEqual({ id: "I-1", status: "ACTIVE" });
    await expect(client.payPalRequest("/v1/billing/subscriptions/I-1/cancel", { method: "POST" })).resolves.toBeNull();
  });
});
