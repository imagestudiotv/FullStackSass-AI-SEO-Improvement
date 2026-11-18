import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicAuditOutcome } from "@/lib/audit/public-audit";

/**
 * What the growth plan asks the server (growth-plan/actions.ts): the free
 * audit in the plan's shape, in the visitor's language, as the visitor the
 * trusted ingress names; a refusal comes back as a message, never a throw.
 */

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("@/lib/visitor-key", () => ({ visitorKey: () => "visitor-9" }));
const audit = vi.hoisted(() => ({ runPublicAudit: vi.fn() }));
vi.mock("@/lib/audit/public-audit", () => audit);
const preview = vi.hoisted(() => ({ publicSitePreview: vi.fn(async () => null) }));
vi.mock("@/lib/websites/public-preview", () => preview);

import { auditForPlan, suggestSite } from "./actions";

const result = (overrides: Record<string, unknown> = {}): PublicAuditOutcome =>
  ({
    ok: true,
    result: {
      domain: "acme.com",
      score: 64,
      pagesChecked: 5,
      counts: { critical: 2, warning: 3, info: 1 },
      issues: [
        { type: "missing_meta_description", severity: "critical", detail: "", urls: [], pageCount: 3 },
        { type: "missing_h1", severity: "warning", detail: "", urls: [], pageCount: 1 },
        { type: "title_too_long", severity: "warning", detail: "", urls: [], pageCount: 1 },
        { type: "images_missing_alt", severity: "warning", detail: "", urls: [], pageCount: 2 },
        { type: "thin_content", severity: "info", detail: "", urls: [], pageCount: 1 },
      ],
      notAssessed: [],
      hiddenIssues: 2,
      cached: false,
      siteName: "Acme",
      language: "it",
      platform: "WordPress",
      crawlers: [
        { agent: "GPTBot", owner: "OpenAI", allowed: false, explicit: true },
        { agent: "ChatGPT-User", owner: "OpenAI", allowed: false, explicit: true },
        { agent: "ClaudeBot", owner: "Anthropic", allowed: true, explicit: false },
      ],
      linkedHosts: [],
      previewImage: null,
      ...overrides,
    },
  }) as PublicAuditOutcome;

beforeEach(() => {
  audit.runPublicAudit.mockReset();
  preview.publicSitePreview.mockClear();
});

describe("auditForPlan", () => {
  it("runs the free audit as the visitor and keeps the four most serious findings", async () => {
    audit.runPublicAudit.mockResolvedValue(result());
    const plan = await auditForPlan("acme.com", "en");
    expect(audit.runPublicAudit).toHaveBeenCalledWith("acme.com", "visitor-9");
    expect(plan).toMatchObject({
      ok: true,
      score: 64,
      pagesChecked: 5,
      counts: { critical: 2, warning: 3, info: 1 },
      hiddenIssues: 3,
      blockedCrawlers: ["OpenAI"],
      crawlersChecked: 3,
      siteName: "Acme",
      language: "it",
      platform: "WordPress",
    });
    if (!plan.ok) throw new Error("expected a plan");
    expect(plan.issues).toHaveLength(4);
    expect(plan.issues[0]).toMatchObject({ severity: "critical", pageCount: 3 });
    expect(plan.issues.every((issue) => issue.label.trim() !== "")).toBe(true);
  });

  it("names the findings in the visitor's language", async () => {
    audit.runPublicAudit.mockResolvedValue(result());
    const english = await auditForPlan("acme.com", "en");
    const german = await auditForPlan("acme.com", "de");
    if (!english.ok || !german.ok) throw new Error("expected plans");
    expect(german.issues[0].label).not.toBe(english.issues[0].label);
  });

  it("turns a refusal into a message to show, in the visitor's language", async () => {
    audit.runPublicAudit.mockResolvedValue({ ok: false, error: { kind: "rate_limited", message: "You have run this check several times in the last hour. Please try again later." } });
    const plan = await auditForPlan("acme.com", "en");
    expect(plan).toEqual({ ok: false, message: "You have run this check several times in the last hour. Please try again later." });
  });

  it("treats an unknown language as English and refuses an absurd address before any work", async () => {
    audit.runPublicAudit.mockResolvedValue(result());
    expect((await auditForPlan("acme.com", "xx")).ok).toBe(true);
    expect((await auditForPlan("a".repeat(400), "en")).ok).toBe(false);
    expect(audit.runPublicAudit).toHaveBeenCalledTimes(1);
  });
});

describe("suggestSite", () => {
  it("asks as the visitor, and ignores an absurd input", async () => {
    await suggestSite("acme.com");
    expect(preview.publicSitePreview).toHaveBeenCalledWith("acme.com", "visitor-9");
    expect(await suggestSite("a".repeat(400))).toBeNull();
    expect(preview.publicSitePreview).toHaveBeenCalledTimes(1);
  });
});
