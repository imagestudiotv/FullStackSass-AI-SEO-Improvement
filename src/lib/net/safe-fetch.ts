import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable, Transform } from "node:stream";
import zlib from "node:zlib";

import { isInternalHostname, isPublicIp, normalizeHostname } from "./ip";

/**
 * fetch() for URLs a user chose - SSRF-safe.
 *
 * Every server-side request to a user-controlled address goes through here:
 * websites being analysed and crawled, the free public tools, robots.txt and
 * sitemaps, backlink verification, a customer's WordPress/Ghost/webhook
 * endpoint, images a CMS told us about, the WordPress plugin's check-now URL.
 *
 * WHAT IT FIXES. The old guard (isPublicWebsiteUrl) compared HOSTNAME TEXT
 * against a list, and most callers then used fetch() with automatic
 * redirects. So:
 *   - "localhost." (trailing dot) and "[::ffff:7f00:1]" passed the text check;
 *   - any public-looking name whose DNS pointed at 127.0.0.1, 10.x or
 *     169.254.169.254 (cloud metadata) passed, because nothing looked at the
 *     resolved address;
 *   - a public site answering "302 Location: http://169.254.169.254/" was
 *     followed by fetch without any check at all;
 *   - checking a name and then letting fetch resolve it again left a DNS
 *     rebinding window between the two lookups.
 *
 * HOW:
 *   1. The URL must be http(s), without credentials, and its hostname -
 *      normalised (case, brackets, trailing dots) - must not be an internal
 *      name or a non-public IP literal.
 *   2. DNS is resolved INSIDE the connection, by a lookup function handed to
 *      the socket. Every address returned is checked, and if any is non-public
 *      the connection is refused. The socket connects to exactly the addresses
 *      that were checked - there is no second lookup to rebind.
 *   3. The hostname stays the request target, so TLS still sends it as SNI and
 *      verifies the certificate against it. Only address resolution changes.
 *   4. Redirects are followed here, one hop at a time, each hop going through
 *      1-3 again; credentials are dropped when a redirect changes origin.
 *
 * node:http(s) rather than fetch, which cannot be given a lookup function
 * without a separate undici install - and which some firewalls refuse by TLS
 * fingerprint anyway (see lib/websites/fetch-page.ts).
 */

export class UnsafeUrlError extends Error {
  readonly status = 400;
  constructor(message = "That address is not a public website") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type ResolvedAddress = { address: string; family: number };

/** DNS resolution: every A and AAAA record for a name. */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const systemResolver: Resolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Checks a URL before any connection: scheme, credentials, and a hostname
 * that is not internal by name or a non-public IP literal. Resolution-based
 * checks happen at connect time, in createSafeLookup.
 */
export function assertPublicHttpUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input.toString());
  } catch {
    throw new UnsafeUrlError("That is not a valid address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https addresses can be fetched");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Addresses with a username or password are not fetched");
  }
  if (isInternalHostname(url.hostname)) {
    throw new UnsafeUrlError();
  }
  return url;
}

/**
 * A socket lookup function that only ever yields public addresses.
 *
 * Handed to http(s).request as `lookup`, so it IS the resolution the socket
 * connects with: nothing is resolved twice, and the addresses checked are the
 * addresses used. Refuses the whole name if any record is non-public, rather
 * than filtering, because a name that points at an internal host at all is
 * not a public website.
 */
export function createSafeLookup(resolve: Resolver = systemResolver): LookupFunction {
  return ((hostname: string, options: unknown, callback: unknown) => {
    const cb = (typeof options === "function" ? options : callback) as (
      error: NodeJS.ErrnoException | null,
      address?: string | ResolvedAddress[],
      family?: number,
    ) => void;
    const opts = (typeof options === "object" && options !== null ? options : {}) as {
      all?: boolean;
      family?: number | string;
    };

    const host = normalizeHostname(hostname);
    const resolved: Promise<ResolvedAddress[]> = isIP(host)
      ? Promise.resolve([{ address: host, family: isIP(host) }])
      : isInternalHostname(host)
        ? Promise.reject(new UnsafeUrlError())
        : resolve(host);

    resolved
      .then((addresses) => {
        if (addresses.length === 0) {
          throw new UnsafeUrlError(`${host} does not resolve`);
        }
        if (addresses.some((entry) => !isPublicIp(entry.address))) {
          throw new UnsafeUrlError(
            `${host} resolves to an address that is not on the public internet`,
          );
        }
        const family = Number(opts.family) || 0;
        const usable = family
          ? addresses.filter((entry) => entry.family === family)
          : addresses;
        if (usable.length === 0) {
          throw new UnsafeUrlError(`${host} has no IPv${family} address`);
        }
        if (opts.all) cb(null, usable);
        else cb(null, usable[0].address, usable[0].family);
      })
      .catch((error: NodeJS.ErrnoException) => cb(error));
  }) as LookupFunction;
}

/** The subset of fetch's options callers here use, plus limits. */
export type SafeFetchInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  /** "follow" (default) re-validates every hop; "manual" returns the 3xx. */
  redirect?: "follow" | "manual" | "error";
  /**
   * The most bytes of body this will deliver, counted AFTER decompression and
   * enforced while the body streams - a response is never downloaded in full
   * and cut afterwards, and a small gzip bomb cannot expand past it.
   * Default DEFAULT_MAX_BYTES.
   */
  maxBytes?: number;
  /**
   * What happens past maxBytes: "error" (default) fails the body read with
   * ResponseTooLargeError; "truncate" ends the body cleanly at the limit, for
   * callers that only need the beginning of a page.
   */
  overflow?: "error" | "truncate";
  /**
   * One deadline for the whole exchange - connecting, every redirect, and
   * reading the body - after which the request and its socket are destroyed
   * and any pending body read fails. Default DEFAULT_TIMEOUT_MS. Callers' own
   * timers used to be cleared as soon as headers arrived, which left the body
   * download with no deadline at all.
   */
  timeoutMs?: number;
};

/** Default body limit: generous for a page or an image, finite for anything. */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** Default deadline for a whole exchange, body included. */
export const DEFAULT_TIMEOUT_MS = 60_000;

export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`The response was larger than ${limit} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

/** One HTTP exchange; injectable so tests can simulate the network. */
export type RequestFn = (
  url: URL,
  options: http.RequestOptions & { lookup: LookupFunction },
  onResponse: (response: http.IncomingMessage) => void,
) => http.ClientRequest;

export type SafeFetchDeps = {
  resolve?: Resolver;
  request?: RequestFn;
  /** Idle-socket timeout, on top of the whole-exchange deadline. */
  idleTimeoutMs?: number;
  maxRedirects?: number;
};

const defaultRequest: RequestFn = (url, options, onResponse) =>
  (url.protocol === "http:" ? http : https).request(url, options, onResponse);

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * Statuses a Response must be built WITHOUT a body. Constructing one with a
 * body throws - and 205 was missing from this list, so a server answering
 * 205 threw inside Node's response callback, where nothing caught it.
 */
const NULL_BODY = new Set([204, 205, 304]);

/** Headers that must not follow a redirect to a different origin. */
const CREDENTIAL_HEADERS = ["authorization", "cookie", "proxy-authorization"];

/** Serialises any fetch body (string, bytes, URLSearchParams, FormData...). */
async function serializeBody(
  body: BodyInit,
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const request = new Request("http://body.invalid/", { method: "POST", body });
  return {
    bytes: Buffer.from(await request.arrayBuffer()),
    contentType: request.headers.get("content-type"),
  };
}

/** A decompressor for the response's content-encoding, or null for none. */
function decoderFor(encoding: string): Transform | null {
  const value = encoding.toLowerCase().trim();
  if (value === "gzip" || value === "x-gzip") return zlib.createGunzip();
  if (value === "deflate") return zlib.createInflate();
  if (value === "br") return zlib.createBrotliDecompress();
  return null;
}

type LimitStream = Transform & { truncated: () => boolean };

/**
 * Passes at most `limit` bytes. "error" fails the stream when more arrive;
 * "truncate" ends it at exactly the limit. Either way `onLimit` runs, so the
 * connection is dropped instead of downloading the rest.
 */
function byteLimit(
  limit: number,
  overflow: "error" | "truncate",
  onLimit: () => void,
): LimitStream {
  let total = 0;
  let cut = false;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (cut) return callback();
      total += chunk.length;
      if (total <= limit) return callback(null, chunk);
      if (overflow === "error") {
        callback(new ResponseTooLargeError(limit));
        onLimit();
        return;
      }
      cut = true;
      const keep = chunk.subarray(0, chunk.length - (total - limit));
      if (keep.length) this.push(keep);
      this.push(null);
      callback();
      /*
        End the WRITABLE side too. Its source is about to be destroyed, not
        ended, and Readable.toWeb waits for both sides of a transform to
        finish - without this the truncated body never closed and the reader
        waited forever.
      */
      this.end();
      onLimit();
    },
  }) as LimitStream;
  stream.truncated = () => cut;
  return stream;
}

type Limits = { maxBytes: number; overflow: "error" | "truncate" };

/** Performs exactly one request against an already-checked URL. */
function requestOnce(
  url: URL,
  method: string,
  headers: Headers,
  body: Buffer | null,
  signal: AbortSignal,
  lookup: LookupFunction,
  limits: Limits,
  deps: SafeFetchDeps,
): Promise<Response> {
  const send = deps.request ?? defaultRequest;
  const idle = deps.idleTimeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const outgoing: Record<string, string> = {};
    headers.forEach((value, key) => {
      outgoing[key] = value;
    });
    if (body) outgoing["content-length"] = String(body.length);

    let req: http.ClientRequest | null = null;
    /** Drops the connection: the response if there is one, and the request. */
    const teardown = (res?: http.IncomingMessage) => {
      res?.destroy();
      req?.destroy();
    };

    const onResponse = (res: http.IncomingMessage) => {
      /*
        EVERYTHING that adapts the response is inside this try. An exception
        here used to escape into Node's 'response' event - an uncaught error
        that could take the worker down, left this promise pending forever and
        the socket open. Now it rejects the request and closes the connection.
      */
      try {
        const status = res.statusCode ?? 0;
        if (status < 200 || status > 599) {
          throw new TypeError(`Unsupported HTTP status ${status}`);
        }

        const out = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) for (const v of value) out.append(key, v);
          else out.set(key, value);
        }

        if (NULL_BODY.has(status) || method === "HEAD" || REDIRECTS.has(status)) {
          res.resume();
          resolve(new Response(null, { status, headers: out }));
          return;
        }

        const decoder = decoderFor(out.get("content-encoding") ?? "");
        // A declared length over the limit is refused before reading a byte -
        // when it describes the delivered bytes, i.e. is not compressed.
        const declared = Number(out.get("content-length") ?? NaN);
        if (
          !decoder &&
          limits.overflow === "error" &&
          Number.isFinite(declared) &&
          declared > limits.maxBytes
        ) {
          throw new ResponseTooLargeError(limits.maxBytes);
        }
        if (decoder) {
          out.delete("content-encoding");
          out.delete("content-length");
        }

        const limiter = byteLimit(limits.maxBytes, limits.overflow, () =>
          teardown(res),
        );
        const source: Readable = decoder ? res.pipe(decoder) : res;
        source.pipe(limiter);

        /*
          Every way the body can fail lands on the stream the caller reads, as
          an error - never a read that waits forever. A truncated body has
          already ended cleanly, so the teardown that follows it is ignored.
        */
        const fail = (error: Error) => {
          if (limiter.truncated() || limiter.readableEnded || limiter.destroyed) return;
          limiter.destroy(error);
        };
        res.on("error", fail);
        res.on("aborted", () =>
          fail(new Error("The connection closed before the body finished")),
        );
        decoder?.on("error", fail);

        // The whole-exchange deadline keeps running while the body is read.
        const onAbort = () => {
          const reason: unknown = signal.reason;
          fail(reason instanceof Error ? reason : new Error("The request was aborted"));
          teardown(res);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });

        // Finished, failed, or cancelled by the reader: release the socket.
        limiter.on("close", () => {
          signal.removeEventListener("abort", onAbort);
          if (!res.complete) teardown(res);
        });

        resolve(
          new Response(Readable.toWeb(limiter) as ReadableStream, {
            status,
            headers: out,
          }),
        );
      } catch (error) {
        teardown(res);
        reject(error);
      }
    };

    try {
      req = send(
        url,
        {
          method,
          headers: outgoing,
          signal,
          lookup,
          // A fresh socket per request: a pooled one could have been opened
          // for a different, earlier resolution.
          agent: false,
        },
        onResponse,
      );
    } catch (error) {
      reject(error);
      return;
    }

    req.setTimeout(idle, () => req?.destroy(new Error(`Timed out after ${idle}ms`)));
    req.on("error", reject);
    req.end(body ?? undefined);
  });
}

/**
 * fetch(), restricted to the public internet, following redirects safely.
 *
 * Returns a standard Response with `.url` set to the final address. Throws
 * UnsafeUrlError when any hop is not a public destination.
 */
export async function safeFetch(
  input: string | URL,
  init: SafeFetchInit = {},
  deps: SafeFetchDeps = {},
): Promise<Response> {
  const lookup = createSafeLookup(deps.resolve);
  const maxRedirects = deps.maxRedirects ?? 5;
  const limits: Limits = {
    maxBytes: init.maxBytes ?? DEFAULT_MAX_BYTES,
    overflow: init.overflow ?? "error",
  };

  /*
    One deadline across the whole exchange, joined with the caller's signal.
    AbortSignal.timeout's timer does not hold the process open, and firing
    after the body is done is a no-op.
  */
  const deadline = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;

  let method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  let body: Buffer | null = null;
  if (init.body != null) {
    const serialized = await serializeBody(init.body);
    body = serialized.bytes;
    if (serialized.contentType && !headers.has("content-type")) {
      headers.set("content-type", serialized.contentType);
    }
  }

  let url = assertPublicHttpUrl(input);
  for (let hop = 0; ; hop++) {
    const response = await requestOnce(url, method, headers, body, signal, lookup, limits, deps);
    const location = response.headers.get("location");

    if (!REDIRECTS.has(response.status) || !location || init.redirect === "manual") {
      Object.defineProperty(response, "url", { value: url.toString() });
      return response;
    }
    if (init.redirect === "error") {
      throw new TypeError(`Redirected to ${location}, and redirects are not allowed here`);
    }
    if (hop >= maxRedirects) {
      throw new TypeError("Too many redirects");
    }

    const next = assertPublicHttpUrl(new URL(location, url));

    // fetch's rules: 303 becomes GET, and so does a 301/302 answering a POST.
    if (
      (response.status === 303 && method !== "GET" && method !== "HEAD") ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      method = "GET";
      body = null;
      headers.delete("content-type");
      headers.delete("content-length");
    }
    // Credentials never follow a redirect to someone else's origin.
    if (next.origin !== url.origin) {
      for (const name of CREDENTIAL_HEADERS) headers.delete(name);
    }
    url = next;
  }
}
