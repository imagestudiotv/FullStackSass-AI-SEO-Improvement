import { EventEmitter } from "node:events";
import type http from "node:http";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { RequestFn, ResolvedAddress } from "@/lib/net/safe-fetch";

import { siteScope } from "./link-guard";
import { verifyUrl } from "./link-verify";

/**
 * Link checks go through the REAL network layer (fetchPage -> safeFetch),
 * with DNS and sockets simulated. A customer's own domain that resolves to
 * an internal address must be refused before any connection is made.
 */

function sockets() {
  const connected: string[] = [];
  const request: RequestFn = (url, options) => {
    const req = new EventEmitter() as http.ClientRequest & EventEmitter;
    Object.assign(req, {
      setTimeout: () => req,
      destroy: (error?: Error) => {
        if (error) req.emit("error", error);
        return req;
      },
      end: () => {
        options.lookup(url.hostname, { all: true }, ((error: Error | null, addresses: ResolvedAddress[]) => {
          if (error) {
            req.emit("error", error);
            return;
          }
          connected.push(addresses[0].address);
          req.emit("error", new Error("ECONNREFUSED"));
        }) as never);
        return req;
      },
    });
    return req;
  };
  return { request, connected };
}

describe("link checks and SSRF", () => {
  const scope = siteScope({ url: "https://imagestudio.com", domain: "imagestudio.com" });

  it.each(["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1"])(
    "refuses a site host that resolves to %s, without connecting",
    async (address) => {
      const net = sockets();
      const verdict = await verifyUrl("https://imagestudio.com/services/", scope, {
        net: {
          resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
          request: net.request,
        },
      });
      expect(verdict).toMatchObject({ status: "rejected", reason: "not a public address" });
      expect(net.connected).toEqual([]);
    },
  );

  it("treats a public address that refuses the connection as unavailable, not missing", async () => {
    const net = sockets();
    const verdict = await verifyUrl("https://imagestudio.com/services/", scope, {
      net: { resolve: async () => [{ address: "93.184.216.34", family: 4 }], request: net.request },
    });
    expect(verdict.status).toBe("unavailable");
    expect(net.connected).toEqual(["93.184.216.34"]);
  });

  it.each([
    [200, "identity"],
    [200, "gzip"],
    [404, "identity"],
    [404, "gzip"],
  ])(
    "handles a large %s page (%s) without reading all of it, and never throws out of the stream",
    async (status, encoding) => {
      // 1.5 MB of HTML: far past the 256 KB the check reads. The live site
      // sends it compressed, which puts a decompressor in front of the limit.
      const html =
        "<html><head><title>Wedding Photography</title></head><body>" +
        Array.from({ length: 1500 }, (_, i) => `<p>${i} ${"lorem ipsum ".repeat(80)}</p>`).join("") +
        "</body></html>";
      const bytes = encoding === "gzip" ? gzipSync(html) : Buffer.from(html);
      const request: RequestFn = (url, options, onResponse) => {
        const req = new EventEmitter() as http.ClientRequest & EventEmitter;
        Object.assign(req, {
          setTimeout: () => req,
          destroy: () => req,
          end: () => {
            options.lookup(url.hostname, { all: true }, ((error: Error | null) => {
              if (error) return req.emit("error", error);
              const res = Object.assign(new PassThrough(), {
                statusCode: status,
                headers: { "content-type": "text/html", ...(encoding === "gzip" ? { "content-encoding": "gzip" } : {}) },
                complete: false,
              });
              onResponse(res as unknown as http.IncomingMessage);
              let offset = 0;
              const pump = () => {
                if (res.destroyed) return;
                if (offset >= bytes.length) return res.end();
                res.write(bytes.subarray(offset, offset + 4096));
                offset += 4096;
                setImmediate(pump);
              };
              pump();
            }) as never);
            return req;
          },
        });
        return req;
      };
      const verdict = await verifyUrl("https://imagestudio.com/wedding-photography/", scope, {
        net: { resolve: async () => [{ address: "93.184.216.34", family: 4 }], request },
      });
      expect(verdict.status).toBe(status === 200 ? "ok" : "missing");
      // Give any late stream callback the chance to throw; vitest fails the run on an unhandled error.
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  );
});
