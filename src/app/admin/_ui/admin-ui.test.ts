import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The admin shell and list building blocks, by behaviour: which link the
 * shell marks as current, where pagination and filter chips point, what the
 * page finder matches, and that long values and statuses stay accessible.
 * Rendered to static markup (no DOM), so open menus and dialogs are not
 * covered here - the browser check covers those.
 */

const state = vi.hoisted(() => ({ pathname: "/admin", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { filterDestinations } from "@/app/admin/_ui/command-palette";
import { ExpandableText } from "@/app/admin/_ui/expandable-text";
import { ADMIN_NAV_ITEMS } from "@/app/admin/_ui/nav";
import { AdminShell } from "@/app/admin/_ui/shell";
import { AdminStatus } from "@/app/admin/_ui/status";
import { AdminToolbar, nextListQuery } from "@/app/admin/_ui/toolbar";
import { pageHref, Pagination } from "@/app/admin/pagination";

const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);

describe("list URLs", () => {
  it("a new search or filter always returns to page 1, keeping the other parameters", () => {
    expect(nextListQuery("q=acme&status=draft&page=4", { q: "globex" })).toBe("q=globex&status=draft");
    expect(nextListQuery("q=acme&page=2", { status: "failed" })).toBe("q=acme&status=failed");
    expect(nextListQuery("q=acme&status=draft&page=3", { status: null })).toBe("q=acme");
    expect(nextListQuery("q=acme", { q: "" })).toBe("");
  });

  it("pagination carries the filters and keeps page 1 out of the URL", () => {
    expect(pageHref("/admin/payments", { q: "acme", status: "failed", org: undefined }, 2)).toBe(
      "/admin/payments?q=acme&status=failed&page=2",
    );
    expect(pageHref("/admin/payments", { q: "acme", page: "5" }, 1)).toBe("/admin/payments?q=acme");
  });

  it("pagination says what range of the real total is shown, and offers only the pages that exist", () => {
    const first = html(createElement(Pagination, { page: 1, pageSize: 25, total: 60, params: { q: "a" }, basePath: "/admin/users" }));
    expect(first).toContain("Showing 1–25 of 60");
    expect(first).toContain('href="/admin/users?q=a&amp;page=2"');
    expect(first).not.toContain("page=0");
    const last = html(createElement(Pagination, { page: 3, pageSize: 25, total: 60, params: {}, basePath: "/admin/users" }));
    expect(last).toContain("Showing 51–60 of 60");
    expect(last).not.toContain("page=4");
  });
});

describe("AdminToolbar", () => {
  it("shows the active search and filters as removable chips that each drop only themselves and the page", () => {
    state.pathname = "/admin/articles";
    state.search = "q=acme&status=failed&org=o1&page=3";
    const out = html(
      createElement(AdminToolbar, {
        searchPlaceholder: "Search articles",
        filters: [
          {
            param: "status",
            label: "Status",
            allValue: "all",
            options: [
              { value: "all", label: "Any status" },
              { value: "failed", label: "Failed" },
            ],
          },
        ],
        keep: ["org"],
        resultLabel: "3 matching",
      }),
    );
    expect(out).toContain("3 matching");
    expect(out).toContain('href="/admin/articles?status=failed&amp;org=o1"'); // remove search
    expect(out).toContain('href="/admin/articles?q=acme&amp;org=o1"'); // remove status
    expect(out).toContain('aria-label="Remove filter Status: Failed"');
    // "Clear all" keeps the workspace scope, which is not a filter here.
    expect(out).toContain('href="/admin/articles?org=o1"');
    // The search box shows what the URL says, so back/forward stays in sync.
    expect(out).toContain('value="acme"');
  });
});

describe("AdminShell", () => {
  const render = (pathname: string, collapsed = false) => {
    state.pathname = pathname;
    state.search = "";
    return html(
      createElement(
        AdminShell,
        // children arrive as the third argument; the cast covers the props object without them.
        { identity: { name: "Ada Admin", email: "ada@example.test" }, initialCollapsed: collapsed } as ComponentProps<typeof AdminShell>,
        createElement("p", null, "page body"),
      ),
    );
  };

  it("marks the current page, and the parent section on a detail page", () => {
    const list = render("/admin/payments");
    expect(list).toMatch(/<a[^>]*href="\/admin\/payments"[^>]*aria-current="page"/);
    const detail = render("/admin/network/abc");
    expect(detail).toMatch(/<a[^>]*href="\/admin\/network"[^>]*aria-current="location"/);
    expect(detail).not.toMatch(/href="\/admin\/network\/operations"[^>]*aria-current/);
  });

  it("offers every admin destination, the page finder, Back to app, and the signed-in identity", () => {
    const out = render("/admin");
    for (const item of ADMIN_NAV_ITEMS) expect(out).toContain(`href="${item.href}"`);
    expect(out).toContain("Go to page");
    expect(out).toContain('href="/dashboard"');
    expect(out).toContain("ada@example.test");
    expect(out).toContain("page body");
    // Keyboard users can jump past the navigation.
    expect(out).toMatch(/<a href="#admin-main"[^>]*>Skip to content<\/a>/);
    expect(out).toContain('id="admin-main"');
  });

  it("keeps a name for every link when the sidebar is collapsed", () => {
    const out = render("/admin/users", true);
    expect(out).toContain('aria-label="Organizations"');
    expect(out).toContain('aria-label="Expand sidebar"');
  });
});

describe("page finder", () => {
  it("matches pages by label, keyword or description - every word must match", () => {
    const labels = (query: string) => filterDestinations(ADMIN_NAV_ITEMS, query).map((item) => item.label);
    expect(labels("pay")).toEqual(["Payments"]);
    expect(labels("refund")).toEqual(["Payments"]);
    expect(labels("freeze")).toEqual(["Network Operations"]);
    expect(labels("missing links")).toEqual(["Partner Network"]);
    expect(labels("")).toHaveLength(ADMIN_NAV_ITEMS.length);
    expect(labels("zzz")).toEqual([]);
  });
});

describe("accessibility of small parts", () => {
  it("a long value is a button that can be expanded, with its full text available", () => {
    const long = "https://a-very-long-subdomain-for-testing.example.test/some/really/long/path";
    const out = html(createElement(ExpandableText, { text: long }));
    expect(out).toContain("<button");
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain(long);
    expect(html(createElement(ExpandableText, { text: "short.test" }))).not.toContain("<button");
  });

  it("a status carries a word, not just a colour", () => {
    const out = html(createElement(AdminStatus, { tone: "danger", label: "Failed" }));
    expect(out).toContain("Failed");
    expect(out).toContain('aria-hidden="true"'); // the icon is decorative; the word is the meaning
  });
});
