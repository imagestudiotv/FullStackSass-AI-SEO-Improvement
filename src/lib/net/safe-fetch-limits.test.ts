import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type http from "node:http";
import { isIP } from "node:net";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, it } from "vitest";

import {
  ResponseTooLargeError,
  safeFetch,
  type RequestFn,
  type ResolvedAddress,
  type Resolver,
} from "./safe-fetch";

/*
  Response adaptation, size limits and deadlines. The SSRF, rebinding,
  redirect and TLS-target cases live in safe-fetch.test.ts; this file shares
  its approach - simulated DNS and sockets, no real network - with a harness
  that can also stream a body slowly, stall it, or drop it, and records
  whether each response and request was destroyed (the socket released).
*/

const PUBLIC_A = "93.184.216.34";

const dns: Resolver = async (hostname) => {
  if (!hostname.endsWith(".example")) throw new Error(`ENOTFOUND ${hostname}`);
  return [{ address: PUBLIC_A, family: 4 }] satisfies ResolvedAddress[];
};

type Answer = {
  status: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Writes the body itself - slowly, partly, or never - instead of `body`. */
  stream?: (res: PassThrough) => void;
};

type FakeResponse = PassThrough & {
  statusCode: number;
  headers: Record<string, string>;
  complete: boolean;
};

function fakeSockets(answer: Answer) {
  const responses: FakeResponse[] = [];
  const requests: { destroyed: boolean }[] = [];

  const request: RequestFn = (url, options, onResponse) => {
    const req = new EventEmitter() as http.ClientRequest & EventEmitter;
    const tracked = { destroyed: false };
    requests.push(tracked);
    Object.assign(req, {
      setTimeout: () => req,
      destroy: (error?: Error) => {
        tracked.destroyed = true;
        if (error) req.emit("error", error);
        return req;
      },
      end: () => {
        const respond = () => {
          const res = new PassThrough() as FakeResponse;
          res.statusCode = answer.status;
          res.headers = answer.headers ?? {};
          res.complete = false;
          responses.push(res);
          onResponse(res as unknown as http.IncomingMessage);
          if (answer.stream) {
            answer.stream(res);
          } else {
            res.complete = true;
            res.end(answer.body ?? "");
          }
        };
        const host = url.hostname;
        if (isIP(host)) respond();
        else
          options.lookup(host, { all: true }, ((error: Error | null) => {
            if (error) req.emit("error", error);
            else respond();
          }) as never);
        return req;
      },
    });
    return req;
  };

  return { request, responses, requests };
}

/** Writes `total` bytes in `chunk`-sized pieces, one per tick, counting them. */
function slowBody(total: number, chunk: number, sent: { bytes: number }) {
  return (res: PassThrough) => {
    const write = () => {
      if (res.destroyed) return;
      if (sent.bytes >= total) {
        res.end();
        return;
      }
      const size = Math.min(chunk, total - sent.bytes);
      sent.bytes += size;
      res.write(Buffer.alloc(size, 97));
      setImmediate(write);
    };
    write();
  };
}

const isTooLarge = (error: unknown) => error instanceof ResponseTooLargeError;

describe("response adaptation", () => {
  it("returns a 205 as a bodyless response instead of throwing", async () => {
    const net = fakeSockets({ status: 205, body: "ignored" });
    const response = await safeFetch("https://api.example/reset", {}, { resolve: dns, request: net.request });
    assert.equal(response.status, 205);
    assert.equal(response.body, null);
  });

  for (const status of [101, 199, 600, 999]) {
    it(`rejects status ${status} and releases the connection`, async () => {
      const net = fakeSockets({ status, body: "x" });
      await assert.rejects(
        safeFetch("https://api.example/", {}, { resolve: dns, request: net.request }),
        /Unsupported HTTP status/,
      );
      assert.equal(net.responses[0].destroyed, true);
      assert.equal(net.requests[0].destroyed, true);
    });
  }

  it("rejects a header value fetch cannot represent, instead of throwing in the callback", async () => {
    const net = fakeSockets({ status: 200, headers: { "x-bad": "cafĀ" }, body: "x" });
    await assert.rejects(safeFetch("https://api.example/", {}, { resolve: dns, request: net.request }));
    assert.equal(net.responses[0].destroyed, true);
    assert.equal(net.requests[0].destroyed, true);
  });
});

describe("size limits, enforced while streaming", () => {
  it("refuses a declared length over the limit before reading the body", async () => {
    const sent = { bytes: 0 };
    const net = fakeSockets({
      status: 200,
      headers: { "content-length": "50000000" },
      stream: slowBody(50_000_000, 65_536, sent),
    });
    await assert.rejects(
      safeFetch("https://big.example/", { maxBytes: 1_000_000 }, { resolve: dns, request: net.request }),
      isTooLarge,
    );
    assert.equal(net.responses[0].destroyed, true);
    assert.ok(sent.bytes <= 65_536, `stopped at once, sent ${sent.bytes}`);
  });

  it("fails the read as soon as an undeclared stream passes the limit, and stops downloading", async () => {
    const sent = { bytes: 0 };
    const net = fakeSockets({ status: 200, stream: slowBody(20_000_000, 16_384, sent) });
    const response = await safeFetch("https://big.example/", { maxBytes: 100_000 }, { resolve: dns, request: net.request });
    await assert.rejects(response.text(), isTooLarge);
    assert.equal(net.responses[0].destroyed, true);
    assert.ok(sent.bytes < 1_000_000, `download stopped near the limit, sent ${sent.bytes}`);
  });

  it("truncates at exactly the limit when asked to, without downloading the rest", async () => {
    const sent = { bytes: 0 };
    const net = fakeSockets({ status: 200, stream: slowBody(5_000_000, 16_384, sent) });
    const response = await safeFetch(
      "https://page.example/",
      { maxBytes: 50_000, overflow: "truncate" },
      { resolve: dns, request: net.request },
    );
    assert.equal((await response.text()).length, 50_000);
    assert.equal(net.responses[0].destroyed, true);
    assert.ok(sent.bytes < 500_000, `sent ${sent.bytes}`);
  });

  it("counts DECOMPRESSED bytes, so a small gzip bomb cannot expand past the limit", async () => {
    const bomb = gzipSync(Buffer.alloc(20_000_000, 0));
    assert.ok(bomb.length < 100_000, "the bomb itself is small");
    const net = fakeSockets({
      status: 200,
      headers: { "content-encoding": "gzip", "content-length": String(bomb.length) },
      body: bomb,
    });
    const response = await safeFetch("https://bomb.example/", { maxBytes: 1_000_000 }, { resolve: dns, request: net.request });
    await assert.rejects(response.arrayBuffer(), isTooLarge);
  });

  it("applies a default limit when a caller sets none", async () => {
    const sent = { bytes: 0 };
    const net = fakeSockets({ status: 200, stream: slowBody(12 * 1024 * 1024, 262_144, sent) });
    const response = await safeFetch("https://big.example/", {}, { resolve: dns, request: net.request });
    await assert.rejects(response.arrayBuffer(), isTooLarge);
  });

  it("delivers a body under the limit intact", async () => {
    const net = fakeSockets({ status: 200, body: "a".repeat(40_000) });
    const response = await safeFetch("https://page.example/", { maxBytes: 50_000 }, { resolve: dns, request: net.request });
    assert.equal((await response.text()).length, 40_000);
  });
});

describe("deadlines through body consumption", () => {
  it("a body that stalls after the headers fails at the deadline, and the socket is closed", async () => {
    const net = fakeSockets({ status: 200, stream: (res) => res.write("first chunk") });
    const started = Date.now();
    const response = await safeFetch("https://slow.example/", { timeoutMs: 150 }, { resolve: dns, request: net.request });
    assert.equal(response.status, 200, "headers arrived inside the deadline");
    await assert.rejects(
      response.text(),
      (error: unknown) => error instanceof Error && error.name === "TimeoutError",
    );
    assert.ok(Date.now() - started < 2_000);
    assert.equal(net.responses[0].destroyed, true);
    assert.equal(net.requests[0].destroyed, true);
  });

  it("the caller's own signal also cancels a body mid-read", async () => {
    const net = fakeSockets({ status: 200, stream: (res) => res.write("partial") });
    const controller = new AbortController();
    const response = await safeFetch("https://slow.example/", { signal: controller.signal }, { resolve: dns, request: net.request });
    const reading = response.text();
    controller.abort();
    await assert.rejects(reading);
    assert.equal(net.responses[0].destroyed, true);
  });

  it("a reader that stops early releases the socket", async () => {
    const sent = { bytes: 0 };
    const net = fakeSockets({ status: 200, stream: slowBody(10_000_000, 16_384, sent) });
    const response = await safeFetch("https://page.example/", {}, { resolve: dns, request: net.request });
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(net.responses[0].destroyed, true);
    assert.ok(sent.bytes < 10_000_000);
  });

  it("a connection that drops mid-body fails the read instead of hanging", async () => {
    const net = fakeSockets({
      status: 200,
      stream: (res) => {
        res.write("partial");
        setImmediate(() => res.destroy(new Error("socket hang up")));
      },
    });
    const response = await safeFetch("https://drop.example/", {}, { resolve: dns, request: net.request });
    await assert.rejects(response.text(), /socket hang up/);
  });
});
