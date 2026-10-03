import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ACTION_META, ACTION_OPTIONS, actionMeta, targetLabel, targetLink } from "./action-meta";

/**
 * The activity log's labels: every code the platform can write is filterable
 * under a human label, and target links only point at pages that exist.
 */

/** The codes in the AdminAction union, read from its source so a new code without a label fails here too. */
function auditCodes(): string[] {
  const source = readFileSync(join(process.cwd(), "src/lib/admin/audit.ts"), "utf8");
  const union = source.slice(source.indexOf("export type AdminAction"), source.indexOf("export type AuditEntry"));
  return [...union.matchAll(/\|\s*"([a-z_.]+)"/g)].map((match) => match[1]);
}

describe("activity action labels", () => {
  it("labels every AdminAction code, and offers each one in the filter", () => {
    const codes = auditCodes();
    expect(codes.length).toBeGreaterThanOrEqual(28);
    expect(Object.keys(ACTION_META).sort()).toEqual([...codes].sort());
    expect(ACTION_OPTIONS.map((option) => option.value).sort()).toEqual([...codes].sort());
    for (const option of ACTION_OPTIONS) expect(option.label).not.toMatch(/[._]/);
  });

  it("shows an unknown code as written, and does not treat prototype keys as codes", () => {
    expect(actionMeta("payment.refunded").label).toBe("Payment refunded");
    expect(actionMeta("legacy.thing").label).toBe("legacy.thing");
    expect(actionMeta("constructor").label).toBe("constructor");
    expect(targetLabel("constructor")).toBe("Constructor");
    expect(targetLabel("publication_dispatch")).toBe("Delivery");
    expect(targetLabel("some_new_type")).toBe("Some new type");
  });
});

describe("activity target links", () => {
  const base = { action: "x", targetId: null, organizationId: null };

  it("links articles and live blog posts to their pages", () => {
    expect(targetLink({ ...base, targetType: "article", targetId: "a b" })?.href).toBe("/admin/articles/a%20b");
    expect(targetLink({ ...base, action: "blog.post_saved", targetType: "blog_post", targetId: "p1" })?.href).toBe("/admin/blog/p1");
    expect(targetLink({ ...base, action: "blog.post_deleted", targetType: "blog_post", targetId: "p1" })).toBeNull();
  });

  it("scopes a payment to its workspace's payments, and links nothing that has no page", () => {
    expect(targetLink({ ...base, targetType: "payment", targetId: "pay", organizationId: "org/1" })?.href).toBe(
      "/admin/payments?org=org%2F1",
    );
    expect(targetLink({ ...base, targetType: "payment", targetId: "pay" })).toBeNull();
    for (const type of ["organization", "user", "website", "unknown"]) {
      expect(targetLink({ ...base, targetType: type, targetId: "id", organizationId: "org" })).toBeNull();
    }
    expect(targetLink({ ...base, targetType: "publication_dispatch", targetId: "d" })?.href).toBe("/admin/network/operations");
  });
});
