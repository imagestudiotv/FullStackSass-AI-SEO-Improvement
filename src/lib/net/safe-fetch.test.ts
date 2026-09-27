import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import type https from "node:https";
import { isIP, type AddressInfo } from "node:net";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, it } from "vitest";

import { isPublicIp, normalizeHostname } from "./ip";
import {
  safeFetch,
  UnsafeUrlError,
  type RequestFn,
  type ResolvedAddress,
  type Resolver,
} from "./safe-fetch";
import { fetchPage } from "../websites/fetch-page";
import { isPublicWebsiteUrl, normalizeWebsiteUrl } from "../websites/url";

/* -------------------------------------------------------------------------- */
/* Simulated network                                                           */
/* -------------------------------------------------------------------------- */

const PUBLIC_A = "93.184.216.34";
const PUBLIC_B = "151.101.1.69";

/**
 * DNS with a per-name script. An array of answers is consumed one per lookup,
 * which is how a rebinding server behaves: a public answer first, a private
 * one the next time it is asked.
 */
function fakeDns(records: Record<string, string[] | string[][]>) {
  const calls: string[] = [];
  const served = new Map<string, number>();
  const resolve: Resolver = async (hostname) => {
    calls.push(hostname);
    const entry = records[hostname];
    if (!entry) throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    let answer: string[];
    if (Array.isArray(entry[0])) {
      const n = served.get(hostname) ?? 0;
      served.set(hostname, n + 1);
      answer = (entry as string[][])[Math.min(n, entry.length - 1)];
    } else {
      answer = entry as string[];
    }
    return answer.map<ResolvedAddress>((address) => ({ address, family: isIP(address) }));
  };
  return { resolve, calls };
}

type Route = (request: { url: URL; method: string; headers: Record<string, string>; body: string }) => {
  status: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Writes the body itself - slowly, partly, or never - instead of `body`. */
  stream?: (res: PassThrough) => void;
};

type FakeResponse = PassThrough & { statusCode: number; headers: Record<string, string>; complete: boolean };

/**
 * Sockets, simulated the way Node's net layer behaves: an IP literal connects
 * directly; a name is resolved through the `lookup` function the request was
 * given, and the connection goes to the address that lookup returned. Nothing
 * here touches the real network.
 */
function fakeSockets(routes: Record<string, Route>) {
  const connections: { host: string; address: string }[] = [];
  const requests: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];
  /** Every response and request object, to check that sockets were released. */
  const responses: FakeResponse[] = [];
  const clientRequests: { destroyed: boolean }[] = [];

  const request: RequestFn = (url, options, onResponse) => {
    const req = new EventEmitter() as http.ClientRequest & EventEmitter;
    const tracked = { destroyed: false };
    clientRequests.push(tracked);
    Object.assign(req, {
      setTimeout: () => req,
      destroy: (error?: Error) => {
        tracked.destroyed = true;
        if (error) req.emit("error", error);
        return req;
      },
      end: (body?: Buffer) => {
        const host = url.hostname.replace(/^\[|\]$/g, "");
        const connect = (address: string) => {
          connections.push({ host, address });
          const headers = (options.headers ?? {}) as Record<string, string>;
          const entry = { url: url.toString(), method: String(options.method), headers, body: body?.toString() ?? "" };
          requests.push(entry);
          const route = routes[url.toString()];
          if (!route) {
            req.emit("error", new Error(`ECONNREFUSED ${url}`));
            return;
          }
          const answer = route({ ...entry, url });
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
        if (isIP(host)) {
          connect(host);
          return req;
        }
        options.lookup(url.hostname, { all: true }, ((error: Error | null, addresses: ResolvedAddress[]) => {
          if (error) req.emit("error", error);
          else connect(addresses[0].address);
        }) as never);
        return req;
      },
    });
    return req;
  };

  return { request, connections, requests, responses, clientRequests };
}

async function rejectsUnsafe(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => error instanceof UnsafeUrlError);
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("private addresses", () => {
  const net = fakeSockets({});
  const dns = fakeDns({});

  for (const url of [
    "http://127.0.0.1/",
    "http://10.0.0.8/admin",
    "http://172.16.5.4/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://2130706433/", // 127.0.0.1 in decimal
    "http://0x7f.1/", // 127.0.0.1 in hex shorthand
  ]) {
    it(`refuses ${url} without connecting`, async () => {
      await rejectsUnsafe(safeFetch(url, {}, { resolve: dns.resolve, request: net.request }));
    });
  }

  it("never opened a connection or asked DNS", () => {
    assert.equal(net.connections.length, 0);
    assert.equal(dns.calls.length, 0);
  });

  it("refuses non-http schemes and embedded credentials", async () => {
    await rejectsUnsafe(safeFetch("file:///etc/passwd"));
    await rejectsUnsafe(safeFetch("gopher://example.com/"));
    await rejectsUnsafe(safeFetch("https://user:pass@example.com/"));
  });
});

describe("trailing-dot and internal names", () => {
  for (const url of [
    "http://localhost./",
    "http://LOCALHOST../",
    "http://app.localhost./",
    "http://metadata.google.internal./computeMetadata/v1/",
    "http://printer.local/",
    "http://intranet/",
  ]) {
    it(`refuses ${url}`, async () => {
      const dns = fakeDns({});
      const net = fakeSockets({});
      await rejectsUnsafe(safeFetch(url, {}, { resolve: dns.resolve, request: net.request }));
      assert.equal(net.connections.length, 0);
    });
  }

  it("the website URL guard refuses them too", () => {
    for (const input of ["localhost.", "http://localhost./", "LOCALHOST.:3000", "[::ffff:127.0.0.1]", "metadata.google.internal."]) {
      assert.throws(() => normalizeWebsiteUrl(input), `${input} should be rejected`);
    }
    assert.equal(isPublicWebsiteUrl("http://localhost./"), false);
    assert.equal(isPublicWebsiteUrl("http://[::ffff:7f00:1]/"), false);
    assert.equal(isPublicWebsiteUrl("http://user:pw@example.com/"), false);
    assert.equal(isPublicWebsiteUrl("https://example.com./"), true);
  });

  it("normalises a trailing dot away in stored website URLs", () => {
    assert.equal(normalizeWebsiteUrl("https://Example.COM./blog").url, "https://example.com/blog");
  });
});

describe("private DNS results", () => {
  it("refuses a public-looking name that resolves to a private address", async () => {
    const dns = fakeDns({ "evil.example": ["10.0.0.5"] });
    const net = fakeSockets({ "http://evil.example/": () => ({ status: 200, body: "internal" }) });
    await rejectsUnsafe(safeFetch("http://evil.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.equal(net.connections.length, 0, "no socket was opened");
  });

  it("refuses when ANY record is private, not just the first", async () => {
    const dns = fakeDns({ "mixed.example": [PUBLIC_A, "127.0.0.1"] });
    const net = fakeSockets({ "http://mixed.example/": () => ({ status: 200 }) });
    await rejectsUnsafe(safeFetch("http://mixed.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.equal(net.connections.length, 0);
  });

  it("refuses IPv6 metadata-style and IPv4-mapped answers", async () => {
    for (const address of ["::1", "fd00:ec2::254", "::ffff:169.254.169.254", "fe80::1"]) {
      const dns = fakeDns({ "v6.example": [address] });
      const net = fakeSockets({ "http://v6.example/": () => ({ status: 200 }) });
      await rejectsUnsafe(safeFetch("http://v6.example/", {}, { resolve: dns.resolve, request: net.request }));
    }
  });

  it("refuses names that do not resolve at all", async () => {
    const dns = fakeDns({});
    const net = fakeSockets({});
    await assert.rejects(safeFetch("http://nowhere.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.equal(net.connections.length, 0);
  });
});

describe("DNS rebinding", () => {
  it("connects to exactly the address it validated, resolving once", async () => {
    // Public on the first answer, private on every answer after that.
    const dns = fakeDns({ "rebind.example": [[PUBLIC_A], ["127.0.0.1"]] });
    const net = fakeSockets({ "http://rebind.example/": () => ({ status: 200, body: "public page" }) });

    const response = await safeFetch("http://rebind.example/", {}, { resolve: dns.resolve, request: net.request });

    assert.equal(await response.text(), "public page");
    assert.equal(dns.calls.length, 1, "one resolution for one connection - nothing to rebind");
    assert.deepEqual(net.connections, [{ host: "rebind.example", address: PUBLIC_A }]);
  });

  it("re-validates on the next connection, which the rebound answer fails", async () => {
    const dns = fakeDns({ "rebind.example": [[PUBLIC_A], ["127.0.0.1"]] });
    const net = fakeSockets({ "http://rebind.example/": () => ({ status: 200 }) });
    await safeFetch("http://rebind.example/", {}, { resolve: dns.resolve, request: net.request });
    await rejectsUnsafe(safeFetch("http://rebind.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.equal(net.connections.length, 1, "the second connection was never opened");
  });

  it("uses the real socket layer's lookup: a name resolving to loopback never reaches it", async () => {
    // A real server on 127.0.0.1. If the guard were bypassed, it would be hit.
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.end("internal secret");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const dns = fakeDns({ "rebind.example": ["127.0.0.1"] });
      // No `request` override: node:http, with the guarded lookup, for real.
      await rejectsUnsafe(safeFetch(`http://rebind.example:${port}/`, {}, { resolve: dns.resolve }));
      assert.equal(hits, 0);
    } finally {
      server.close();
    }
  });
});

describe("redirects", () => {
  it("refuses a redirect to a private IP literal and never requests it", async () => {
    const dns = fakeDns({ "site.example": [PUBLIC_A] });
    const net = fakeSockets({
      "http://site.example/": () => ({ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }),
      "http://169.254.169.254/latest/meta-data/": () => ({ status: 200, body: "credentials" }),
    });
    await rejectsUnsafe(safeFetch("http://site.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.deepEqual(net.requests.map((r) => r.url), ["http://site.example/"]);
  });

  it("refuses a redirect to a name that resolves privately", async () => {
    const dns = fakeDns({ "site.example": [PUBLIC_A], "inside.example": ["192.168.0.10"] });
    const net = fakeSockets({
      "http://site.example/": () => ({ status: 301, headers: { location: "http://inside.example/admin" } }),
      "http://inside.example/admin": () => ({ status: 200 }),
    });
    await rejectsUnsafe(safeFetch("http://site.example/", {}, { resolve: dns.resolve, request: net.request }));
    assert.equal(net.connections.length, 1);
  });

  it("refuses a redirect to trailing-dot localhost", async () => {
    const dns = fakeDns({ "site.example": [PUBLIC_A] });
    const net = fakeSockets({
      "http://site.example/": () => ({ status: 307, headers: { location: "http://localhost./" } }),
    });
    await rejectsUnsafe(safeFetch("http://site.example/", {}, { resolve: dns.resolve, request: net.request }));
  });

  it("follows public redirects, reports the final URL, and drops credentials across origins", async () => {
    const dns = fakeDns({ "a.example": [PUBLIC_A], "b.example": [PUBLIC_B] });
    const net = fakeSockets({
      "https://a.example/start": () => ({ status: 302, headers: { location: "/next" } }),
      "https://a.example/next": () => ({ status: 301, headers: { location: "https://b.example/final" } }),
      "https://b.example/final": () => ({ status: 200, body: "done" }),
    });
    const response = await safeFetch(
      "https://a.example/start",
      { headers: { authorization: "Bearer secret", cookie: "s=1", accept: "text/html" } },
      { resolve: dns.resolve, request: net.request },
    );
    assert.equal(await response.text(), "done");
    assert.equal(response.url, "https://b.example/final");
    const [first, sameOrigin, crossOrigin] = net.requests;
    assert.equal(first.headers.authorization, "Bearer secret");
    assert.equal(sameOrigin.headers.authorization, "Bearer secret", "same origin keeps it");
    assert.equal(crossOrigin.headers.authorization, undefined, "cross origin drops it");
    assert.equal(crossOrigin.headers.cookie, undefined);
    assert.equal(crossOrigin.headers.accept, "text/html");
  });

  it("turns a 303 after POST into a GET without the body", async () => {
    const dns = fakeDns({ "hook.example": [PUBLIC_A] });
    const net = fakeSockets({
      "https://hook.example/in": () => ({ status: 303, headers: { location: "/done" } }),
      "https://hook.example/done": () => ({ status: 200 }),
    });
    await safeFetch(
      "https://hook.example/in",
      { method: "POST", body: JSON.stringify({ a: 1 }), headers: { "content-type": "application/json" } },
      { resolve: dns.resolve, request: net.request },
    );
    assert.equal(net.requests[1].method, "GET");
    assert.equal(net.requests[1].body, "");
  });

  it("returns the 3xx untouched with redirect: manual, and refuses with redirect: error", async () => {
    const dns = fakeDns({ "site.example": [PUBLIC_A] });
    const routes = { "http://site.example/": () => ({ status: 302, headers: { location: "http://127.0.0.1/" } }) };
    const manual = fakeSockets(routes);
    const response = await safeFetch("http://site.example/", { redirect: "manual" }, { resolve: dns.resolve, request: manual.request });
    assert.equal(response.status, 302);
    assert.equal(manual.connections.length, 1);
    const strict = fakeSockets(routes);
    await assert.rejects(safeFetch("http://site.example/", { redirect: "error" }, { resolve: dns.resolve, request: strict.request }));
  });

  it("stops after too many redirects", async () => {
    const dns = fakeDns({ "loop.example": [PUBLIC_A] });
    const net = fakeSockets({ "http://loop.example/": () => ({ status: 302, headers: { location: "/" } }) });
    await assert.rejects(safeFetch("http://loop.example/", {}, { resolve: dns.resolve, request: net.request, maxRedirects: 3 }), /Too many redirects/);
    assert.equal(net.requests.length, 4);
  });
});

describe("valid public websites", () => {
  it("fetches a public site, keeping the hostname as the request target (SNI and certificate check)", async () => {
    const dns = fakeDns({ "www.example.com": [PUBLIC_A, "2606:2800:220:1:248:1893:25c8:1946"] });
    let seen: { hostname: string; servername?: unknown; rejectUnauthorized?: unknown } | null = null;
    const net = fakeSockets({ "https://www.example.com/": () => ({ status: 200, body: "<html>ok</html>" }) });
    const request: RequestFn = (url, options, onResponse) => {
      const tls = options as https.RequestOptions;
      seen = { hostname: url.hostname, servername: tls.servername, rejectUnauthorized: tls.rejectUnauthorized };
      return net.request(url, options, onResponse);
    };
    const response = await safeFetch("https://www.example.com/", {}, { resolve: dns.resolve, request });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<html>ok</html>");
    assert.deepEqual(seen, { hostname: "www.example.com", servername: undefined, rejectUnauthorized: undefined });
    assert.equal(net.connections[0].address, PUBLIC_A);
  });

  it("decodes a gzip body", async () => {
    const dns = fakeDns({ "gz.example": [PUBLIC_A] });
    const net = fakeSockets({
      "https://gz.example/": () => ({ status: 200, headers: { "content-encoding": "gzip" }, body: gzipSync("compressed page") }),
    });
    const response = await safeFetch("https://gz.example/", {}, { resolve: dns.resolve, request: net.request });
    assert.equal(await response.text(), "compressed page");
    assert.equal(response.headers.get("content-encoding"), null);
  });

  it("sends JSON and form bodies with the right length and type", async () => {
    const dns = fakeDns({ "api.example": [PUBLIC_A] });
    const net = fakeSockets({ "https://api.example/x": () => ({ status: 201 }) });
    await safeFetch("https://api.example/x", { method: "POST", body: new URLSearchParams({ a: "1" }) }, { resolve: dns.resolve, request: net.request });
    assert.equal(net.requests[0].body, "a=1");
    assert.equal(net.requests[0].headers["content-length"], "3");
    assert.match(net.requests[0].headers["content-type"], /application\/x-www-form-urlencoded/);
  });
});

describe("fetchPage (crawler transport)", () => {
  it("refuses a page whose name resolves privately", async () => {
    const dns = fakeDns({ "crawl.example": ["172.20.0.3"] });
    const net = fakeSockets({ "https://crawl.example/": () => ({ status: 200 }) });
    await rejectsUnsafe(
      fetchPage("https://crawl.example/", { accept: "text/html" }, 5000, new AbortController().signal, { resolve: dns.resolve, request: net.request }),
    );
    assert.equal(net.connections.length, 0);
  });

  it("returns a public page and leaves redirects to the caller", async () => {
    const dns = fakeDns({ "crawl.example": [PUBLIC_A] });
    const net = fakeSockets({ "https://crawl.example/": () => ({ status: 301, headers: { location: "https://crawl.example/home" } }) });
    const response = await fetchPage("https://crawl.example/", {}, 5000, new AbortController().signal, { resolve: dns.resolve, request: net.request });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "https://crawl.example/home");
  });
});

describe("address rules", () => {
  it("classifies addresses", () => {
    assert.equal(isPublicIp(PUBLIC_A), true);
    assert.equal(isPublicIp("2606:4700:4700::1111"), true);
    for (const ip of ["127.0.0.1", "10.1.1.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.100.100.200", "::1", "::ffff:7f00:1", "fc00::1", "fe80::1", "64:ff9b::a00:1", "2002:a00:1::"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  it("normalises hostnames", () => {
    assert.equal(normalizeHostname("LocalHost."), "localhost");
    assert.equal(normalizeHostname("[::1]"), "::1");
  });
});
