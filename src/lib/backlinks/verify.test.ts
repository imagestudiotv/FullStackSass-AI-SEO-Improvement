import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One fetch of a published page answers for every network link on it (an
 * article can carry up to 15), and each link gets its own verdict.
 */

const fetchMock = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock("@/lib/net/safe-fetch", () => fetchMock);

import { checkLink, checkLinks } from "@/lib/backlinks/verify";

const PAGE = "https://host.example.org/post";

function page(html: string, status = 200) {
  return new Response(html, { status, headers: { "content-type": "text/html" } });
}

beforeEach(() => {
  fetchMock.safeFetch.mockReset();
});

describe("checkLinks", () => {
  it("fetches the page once and judges each target on it", async () => {
    fetchMock.safeFetch.mockResolvedValueOnce(
      page(
        '<p><a href="https://www.one.example.org/page/" rel="nofollow">one</a>' +
          ' <a href="http://two.example.org/films?utm_source=x&amp;b=2">two</a></p>',
      ),
    );
    const results = await checkLinks(PAGE, [
      "https://one.example.org/page",
      "https://two.example.org/films",
      "https://three.example.org/",
    ]);
    expect(fetchMock.safeFetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { alive: true, rel: "nofollow", httpStatus: 200, error: null },
      { alive: true, rel: "", httpStatus: 200, error: null },
      { alive: false, rel: null, httpStatus: 200, error: null },
    ]);
  });

  it("gives every target the same answer when the page cannot be read", async () => {
    fetchMock.safeFetch.mockResolvedValueOnce(page("gone", 404));
    expect(await checkLinks(PAGE, ["https://one.example.org/", "https://two.example.org/"])).toEqual([
      { alive: false, httpStatus: 404, error: null },
      { alive: false, httpStatus: 404, error: null },
    ]);

    fetchMock.safeFetch.mockRejectedValueOnce(new Error("connection reset"));
    expect(await checkLinks(PAGE, ["https://one.example.org/", "https://two.example.org/"])).toEqual([
      { alive: false, httpStatus: null, error: "connection reset" },
      { alive: false, httpStatus: null, error: "connection reset" },
    ]);
  });

  it("never fetches a private address", async () => {
    expect(await checkLinks("http://127.0.0.1/post", ["https://one.example.org/"])).toEqual([
      { alive: false, httpStatus: null, error: "not a public URL" },
    ]);
    expect(fetchMock.safeFetch).not.toHaveBeenCalled();
  });

  it("checkLink is the one-target case", async () => {
    fetchMock.safeFetch.mockResolvedValueOnce(page('<a href="/local/">in-site</a>'));
    expect(await checkLink(PAGE, "https://host.example.org/local")).toEqual({
      alive: true,
      rel: "",
      httpStatus: 200,
      error: null,
    });
  });
});
