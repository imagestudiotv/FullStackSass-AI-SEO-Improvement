import http from "node:http";
import https from "node:https";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credentials only travel over https (src/lib/publishing/https.ts).
 *
 * Before: WordPress, Ghost and webhook connections accepted http:// site
 * addresses, so an application password, an admin token or a signed
 * unpublished article could be sent in clear text. Now:
 *  - the connect form refuses an explicit http:// address;
 *  - a connection STORED with http:// (before this rule) is refused at
 *    request time - before any DNS lookup or connection - with a message
 *    that says to reconnect, and as a definite failure (426), not an
 *    "uncertain" one that would be retried.
 */

const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", async (original) => {
  const actual = (await original()) as Record<string, unknown> & { default?: Record<string, unknown> };
  return { ...actual, lookup: dnsLookup, default: { ...(actual.default ?? actual), lookup: dnsLookup } };
});

const editor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/websites/require-editor", () => ({ requireEditor: editor }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => { throw new Error("the database must not be reached"); } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));

import { ProviderError } from "./provider";
import { httpsRequiredError } from "./https";
import { connectProvider } from "./actions";
import { ghostProvider } from "./providers/ghost-provider";
import { webhookProvider } from "./providers/webhook-provider";
import { wordpressProvider } from "./providers/wordpress-provider";

let httpRequest: ReturnType<typeof vi.spyOn>;
let httpsRequest: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  dnsLookup.mockReset();
  httpRequest = vi.spyOn(http, "request");
  httpsRequest = vi.spyOn(https, "request");
  editor.mockResolvedValue({ ok: true, context: { site: { id: "11111111-1111-4111-8111-111111111111" } } });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function nothingSent() {
  expect(dnsLookup).not.toHaveBeenCalled();
  expect(httpRequest).not.toHaveBeenCalled();
  expect(httpsRequest).not.toHaveBeenCalled();
}

async function refusal(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

describe("https for credentials", () => {
  it("the rule", () => {
    expect(httpsRequiredError("Site URL", "https://example.com")).toBeNull();
    expect(httpsRequiredError("Site URL", "http://example.com")).toMatch(/^Site URL must start with https:\/\//);
    expect(httpsRequiredError("Site URL", "not a url")).toMatch(/not a valid address/);
  });

  it("refuses a stored http:// WordPress connection before sending anything, and says to reconnect", async () => {
    const error = await refusal(
      wordpressProvider.testConnection({ siteUrl: "http://blog.example", username: "editor", applicationPassword: "abcd efgh ijkl mnop" }),
    );
    expect(error.kind).toBe("auth");
    expect(error.status).toBe(426); // a definite refusal: never recorded as "uncertain"
    expect(error.message).toMatch(/http:\/\/ address[\s\S]*application password[\s\S]*nothing was sent[\s\S]*Reconnect/);
    nothingSent();
  });

  it("refuses a stored http:// Ghost connection before sending anything", async () => {
    const error = await refusal(
      ghostProvider.testConnection({ siteUrl: "http://ghost.example", adminApiKey: `${"a".repeat(24)}:${"b".repeat(64)}` }),
    );
    expect(error.kind).toBe("auth");
    expect(error.status).toBe(426);
    expect(error.message).toMatch(/Admin API key[\s\S]*Reconnect/);
    nothingSent();
  });

  it("refuses a stored http:// webhook before sending the signed article", async () => {
    const error = await refusal(
      webhookProvider.testConnection({ endpointUrl: "http://hooks.example/repget", signingSecret: "s".repeat(32) }),
    );
    expect(error.kind).toBe("auth");
    expect(error.status).toBe(426);
    nothingSent();
  });

  it("the connect form refuses an explicit http:// address and stores nothing", async () => {
    const result = await connectProvider("11111111-1111-4111-8111-111111111111", "wordpress", {
      siteUrl: "http://blog.example",
      username: "editor",
      applicationPassword: "abcd efgh ijkl mnop",
    });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/^Website address must start with https:\/\//) });
    nothingSent();
  });

  it("the connect form still turns a bare domain into https (and then tests it)", async () => {
    dnsLookup.mockRejectedValue(Object.assign(new Error("ENOTFOUND blog.example"), { code: "ENOTFOUND" }));
    const result = await connectProvider("11111111-1111-4111-8111-111111111111", "wordpress", {
      siteUrl: "blog.example",
      username: "editor",
      applicationPassword: "abcd efgh ijkl mnop",
    });
    // Reached the (failing) network test: the https address was accepted.
    expect(result.ok).toBe(false);
    expect(dnsLookup).toHaveBeenCalled();
    expect(String((result as { error: string }).error)).not.toMatch(/must start with https/);
  });
});
