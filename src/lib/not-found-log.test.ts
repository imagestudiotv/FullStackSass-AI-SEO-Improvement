import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/not-found/route";

import { describeMiss, missLogLine } from "./not-found-log";

/** 404 logging (client's launch review, 2026-10-03): useful, and safe to write down. */

const SITE = "https://www.repget.com";

describe("describeMiss", () => {
  it("names the missed path and the page that linked to it", () => {
    expect(describeMiss({ path: "/old-pricing", referrer: "https://news.example/post/123?utm=x" }, SITE)).toEqual({
      path: "/old-pricing",
      from: "https://news.example/post/123",
      internal: false,
    });
  });

  it("marks a broken link on our own pages as internal - the ones to fix here", () => {
    expect(describeMiss({ path: "/blog/gone", referrer: `${SITE}/blog?page=2` }, SITE)).toEqual({
      path: "/blog/gone",
      from: `${SITE}/blog`,
      internal: true,
    });
  });

  it("never keeps a query string or fragment", () => {
    expect(describeMiss({ path: "/x?email=a@b.c&token=secret#frag", referrer: "" }, SITE)).toEqual({
      path: "/x",
      from: null,
      internal: false,
    });
  });

  it("masks anything in the path that looks like a token", () => {
    const token = "aB3dE6gH9jK2mN5pQ8sT1vW4yZ7";
    expect(describeMiss({ path: `/x/${token}`, referrer: `https://mail.example/read/${token}` }, SITE)).toEqual({
      path: "/x/:token",
      from: "https://mail.example/read/:token",
      internal: false,
    });
    expect(describeMiss({ path: "/a/c0010000-0000-4000-8000-000000000001/b" }, SITE)?.path).toBe("/a/:token/b");
    expect(describeMiss({ path: `/k/${"9f".repeat(16)}` }, SITE)?.path).toBe("/k/:token");
  });

  it("masks an invitation link's token whatever it looks like", () => {
    expect(describeMiss({ path: "/invite/short-lowercase" }, SITE)?.path).toBe("/invite/:token");
  });

  /** The point of the log: a broken blog link must still name the post, and the page that links to it. */
  it("keeps ordinary slugs, however long, numbers included", () => {
    expect(describeMiss({ path: "/blog/why-we-left-wordpress-for-webflow", referrer: `${SITE}/blog/top-10-seo-tips-for-2026-small-business` }, SITE)).toEqual({
      path: "/blog/why-we-left-wordpress-for-webflow",
      from: `${SITE}/blog/top-10-seo-tips-for-2026-small-business`,
      internal: true,
    });
    expect(describeMiss({ path: "/tools/meta-description-generator" }, SITE)?.path).toBe("/tools/meta-description-generator");
  });

  it("ignores what is not a path on this site", () => {
    for (const input of [null, "x", {}, { path: 42 }, { path: "relative" }, { path: "//evil.example/x" }, { path: "https://evil.example/" }]) {
      expect(describeMiss(input, SITE)).toBeNull();
    }
  });

  it("drops a referrer that is not a web address", () => {
    expect(describeMiss({ path: "/x", referrer: "javascript:alert(1)" }, SITE)?.from).toBeNull();
    expect(describeMiss({ path: "/x", referrer: "not a url" }, SITE)?.from).toBeNull();
  });

  it("caps the length", () => {
    const path = describeMiss({ path: `/${"word-".repeat(200)}` }, SITE)!.path;
    expect(path.startsWith("/word-word-")).toBe(true);
    expect(path.length).toBe(300);
  });
});

describe("missLogLine", () => {
  /** A crafted address must not be able to start a second, fake log line. */
  it("is one line of JSON, whatever the address holds", () => {
    const report = describeMiss({ path: "/x%0a[404] forged\r\nline", referrer: `${SITE}/a\nb` }, SITE)!;
    const line = missLogLine(report);
    expect(line.startsWith("[404] {")).toBe(true);
    expect(line).not.toMatch(/[\r\n]/);
    expect(JSON.parse(line.slice("[404] ".length))).toEqual(report);
  });
});

describe("POST /api/not-found", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  const send = (body: string, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) =>
    POST(new Request(`${SITE}/api/not-found`, { method: "POST", body, headers }));

  /** Behind `next start` or a proxy request.url can name localhost; the visitor's Host is what their referrer carries. */
  it("judges internal links by the address the visitor used, not the server's own", async () => {
    const response = await POST(
      new Request("http://localhost:3230/api/not-found", {
        method: "POST",
        body: JSON.stringify({ path: "/gone", referrer: "http://127.0.0.1:3230/blog" }),
        headers: { "sec-fetch-site": "same-origin", host: "127.0.0.1:3230" },
      }),
    );
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith('[404] {"path":"/gone","from":"http://127.0.0.1:3230/blog","internal":true}');
  });

  it("logs a report from one of this site's own pages, and answers 204", async () => {
    const response = await send(JSON.stringify({ path: "/nope", referrer: `${SITE}/pricing` }));
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith('[404] {"path":"/nope","from":"https://www.repget.com/pricing","internal":true}');
  });

  /** Another site's page cannot use its visitors' browsers to write into our logs. */
  it("ignores a report sent from anywhere else, or by something that is not a browser page", async () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      expect((await send(JSON.stringify({ path: "/nope" }), { "sec-fetch-site": site })).status).toBe(204);
    }
    expect((await send(JSON.stringify({ path: "/nope" }), {})).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores a body that is too big or not JSON", async () => {
    await send(JSON.stringify({ path: `/${"x".repeat(5000)}` }));
    await send("not json");
    expect(warn).not.toHaveBeenCalled();
  });
});
