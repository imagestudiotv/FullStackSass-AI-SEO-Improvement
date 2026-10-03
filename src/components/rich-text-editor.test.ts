import { describe, expect, it } from "vitest";

import { linkHref } from "@/components/rich-text-editor";

/**
 * The link dialog of the editor's workspace variant: an address that the
 * sanitiser would drop on save is refused there, with a reason, instead of
 * vanishing later.
 */
describe("linkHref", () => {
  it("keeps web, mail and phone addresses and relative ones", () => {
    expect(linkHref(" https://example.com/page ")).toBe("https://example.com/page");
    expect(linkHref("http://example.com")).toBe("http://example.com");
    expect(linkHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(linkHref("tel:+3912345")).toBe("tel:+3912345");
    expect(linkHref("/pricing")).toBe("/pricing");
    expect(linkHref("#section-two")).toBe("#section-two");
  });

  it("completes a bare domain with https://", () => {
    expect(linkHref("example.com/page")).toBe("https://example.com/page");
    expect(linkHref("www.example.co.uk")).toBe("https://www.example.co.uk");
  });

  it("an empty address means remove the link", () => {
    expect(linkHref("   ")).toBe("");
  });

  it("refuses what would not survive the sanitiser or is not an address", () => {
    expect(linkHref("javascript:alert(1)")).toBeNull();
    expect(linkHref("data:text/html,hi")).toBeNull();
    expect(linkHref("https://")).toBeNull();
    expect(linkHref("not a link")).toBeNull();
    expect(linkHref("words")).toBeNull();
  });
});
