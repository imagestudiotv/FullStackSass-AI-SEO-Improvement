import { describe, expect, it } from "vitest";

import { activeNavItem, adminCrumbs, ADMIN_NAV_ITEMS } from "@/app/admin/_ui/nav";

/**
 * The admin navigation map: every route lights exactly the item it belongs
 * to, and detail pages keep their section in the breadcrumb trail.
 */

describe("activeNavItem", () => {
  const label = (path: string) => activeNavItem(path)?.label ?? null;

  it("lights each section on its own page and its detail pages", () => {
    expect(label("/admin")).toBe("Overview");
    expect(label("/admin/organizations")).toBe("Organizations");
    expect(label("/admin/websites")).toBe("Websites");
    expect(label("/admin/users")).toBe("Users");
    expect(label("/admin/articles")).toBe("Articles");
    expect(label("/admin/articles/abc")).toBe("Articles");
    expect(label("/admin/blog/new")).toBe("Blog");
    expect(label("/admin/payments")).toBe("Payments");
    expect(label("/admin/activity")).toBe("Activity");
  });

  it("tells Network Operations from Partner Network, and a review page from both", () => {
    expect(label("/admin/network")).toBe("Partner Network");
    expect(label("/admin/network/operations")).toBe("Network Operations");
    expect(label("/admin/network/8f0e-article")).toBe("Partner Network");
  });

  it("never lights Overview for another section, nor matches a look-alike path", () => {
    expect(label("/admin/networking")).toBeNull();
    expect(label("/adminx")).toBeNull();
  });

  it("lists every admin route exactly once", () => {
    const hrefs = ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/admin",
        "/admin/organizations",
        "/admin/websites",
        "/admin/users",
        "/admin/articles",
        "/admin/network",
        "/admin/blog",
        "/admin/network/operations",
        "/admin/payments",
        "/admin/activity",
      ]),
    );
  });
});

describe("adminCrumbs", () => {
  const trail = (path: string) => adminCrumbs(path).map((crumb) => `${crumb.label}${crumb.current ? "*" : ""}`);

  it("names the current page last", () => {
    expect(trail("/admin")).toEqual(["Overview*"]);
    expect(trail("/admin/payments")).toEqual(["Admin", "Payments*"]);
  });

  it("keeps the section on detail pages", () => {
    expect(trail("/admin/articles/42")).toEqual(["Admin", "Articles", "Article*"]);
    expect(trail("/admin/network/42")).toEqual(["Admin", "Partner Network", "Review*"]);
    expect(trail("/admin/network/operations")).toEqual(["Admin", "Network Operations*"]);
    expect(trail("/admin/blog/new")).toEqual(["Admin", "Blog", "New post*"]);
    expect(trail("/admin/blog/9")).toEqual(["Admin", "Blog", "Edit post*"]);
  });
});
