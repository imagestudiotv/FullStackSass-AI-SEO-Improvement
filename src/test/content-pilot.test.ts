import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customerPilotSchema, loadCustomerPilot } from "../../e2e/content/pilot-input";

const files = vi.hoisted(() => ({ realpath: vi.fn(), stat: vi.fn(), read: vi.fn() }));
vi.mock("node:fs", () => ({
  realpathSync: files.realpath, statSync: files.stat, readFileSync: files.read,
}));
const snapshot = {
  version: 1, caseId: "customer-test",
  websiteId: "11111111-1111-4111-8111-111111111111",
  calendarItemId: "22222222-2222-4222-8222-222222222222",
  capturedAt: "2026-10-20T12:00:00.000Z",
  brief: {
    title: "Example", targetKeyword: "example", intent: null, relatedKeywords: [],
    brandName: "Example", industry: null, country: "Italy", language: "English",
    description: null, targetAudience: null, services: [], customInstructions: null,
    articleInstructions: null, tone: null, avoid: null, vocabulary: null, usps: [],
    facts: [], socialLinks: [], backlink: null, articleStyle: "expert",
    targetWordCount: null, internalLinkTarget: 3, tableOfContents: true,
    authorPerspective: true, mentionSimilarProducts: false, comparisonTable: true,
    tableCount: 2, faqSection: true, imageStyle: null, imageBrief: null, imageInstructions: null,
  },
};
beforeEach(() => {
  files.realpath.mockReset().mockImplementation(value => value);
  files.stat.mockReset().mockReturnValue({ size: 1000 });
  files.read.mockReset().mockReturnValue(JSON.stringify(snapshot));
});
describe("private customer pilot inputs", () => {
  const filename = "test-results/content-pilot/customer-inputs/customer-test.json";
  it("loads only the explicit brief shape, preserving real writing preferences", () => {
    expect(loadCustomerPilot(filename)).toEqual(snapshot);
    expect(customerPilotSchema.safeParse({ ...snapshot, credentials: "not-a-real-secret" }).success).toBe(false);
    expect(customerPilotSchema.safeParse({ ...snapshot, brief: { ...snapshot.brief, research: {} } }).success).toBe(false);
  });
  it("rejects report-name traversal and links to real partner placements", () => {
    expect(customerPilotSchema.safeParse({ ...snapshot, caseId: "../report" }).success).toBe(false);
    expect(customerPilotSchema.safeParse({ ...snapshot, brief: {
      ...snapshot.brief, backlink: { url: "https://example.org", anchor: "Example" },
    } }).success).toBe(false);
  });
  it("rejects outside paths before reading any contents", () => {
    expect(() => loadCustomerPilot(".env.local")).toThrow(/inside/);
    expect(files.read).not.toHaveBeenCalled();
  });
  it("rejects a junction resolving outside the private input directory", () => {
    files.realpath.mockImplementation(value => value === path.resolve(filename) ? path.resolve("outside.json") : value);
    expect(() => loadCustomerPilot(filename)).toThrow(/inside/);
    expect(files.read).not.toHaveBeenCalled();
  });
  it("bounds input size before parsing", () => {
    files.stat.mockReturnValue({ size: 256001 });
    expect(() => loadCustomerPilot(filename)).toThrow(/too large/);
    expect(files.read).not.toHaveBeenCalled();
  });
});
