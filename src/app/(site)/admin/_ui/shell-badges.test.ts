import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** The sidebar's badges as rendered: the words a screen reader gets, the cap, and the dot where a number does not fit. */

const state = vi.hoisted(() => ({ badges: {} as Record<string, unknown> }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("./use-admin-badges", () => ({ useAdminBadges: () => state.badges }));

import { AdminShell } from "./shell";

const shell = (collapsed: boolean) =>
  renderToStaticMarkup(
    createElement(AdminShell, { identity: { name: "A", email: "a@b.example" }, initialCollapsed: collapsed } as ComponentProps<typeof AdminShell>, null),
  );
const linkTo = (html: string, href: string) => new RegExp(`<a href="${href}"[^>]*>.*?</a>`).exec(html)![0];

describe("sidebar badges", () => {
  it("name the section and how many wait, and cap the number", () => {
    state.badges = {
      "/admin/website-projects": { count: 2, waiting: 2, fresh: 0, text: "2 waiting", detail: "2 to quote" },
      "/admin/network": { count: 240, waiting: 240, fresh: 0, text: "240 waiting", detail: "240 articles to review" },
      "/admin/users": { count: 3, waiting: 0, fresh: 3, text: "3 new", detail: "3 new" },
    };
    const html = shell(false);
    expect(linkTo(html, "/admin/website-projects")).toContain('aria-label="Website projects, 2 waiting"');
    expect(linkTo(html, "/admin/website-projects")).toContain(">2</span>");
    expect(linkTo(html, "/admin/network")).toContain(">99+</span>");
    expect(linkTo(html, "/admin/network")).toContain('aria-label="Partner Network, 240 waiting"');
    expect(linkTo(html, "/admin/users")).toContain('aria-label="Users, 3 new"');
    expect(linkTo(html, "/admin/feedback")).not.toContain("aria-label");
    expect(html).toContain('aria-label="Open navigation, 242 waiting"');
  });

  it("become a dot when the sidebar is collapsed, keeping the name", () => {
    state.badges = { "/admin/feedback": { count: 1, waiting: 1, fresh: 0, text: "1 waiting", detail: "1 unread" } };
    const link = linkTo(shell(true), "/admin/feedback");
    expect(link).toContain('aria-label="Feedback, 1 waiting"');
    expect(link).toContain('data-slot="admin-badge-dot"');
    expect(link).not.toContain('data-slot="admin-badge"');
  });

  it("change nothing when there is nothing", () => {
    state.badges = {};
    const html = shell(false);
    expect(html).not.toContain("admin-badge");
    expect(html).toContain('aria-label="Open navigation"');
  });
});
