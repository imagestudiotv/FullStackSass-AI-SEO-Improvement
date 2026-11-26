import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_KIT, brandKitFileName } from "@/lib/earn/brand-kit";
import { LOCALES } from "@/lib/i18n/config";
import { EARN_BRAND_KIT_COPY } from "@/lib/i18n/earn-brand-kit";

const publicFile = (url: string) => path.join(process.cwd(), "public", ...url.split("/").filter(Boolean));

describe("the Earn Credits brand kit", () => {
  it("ships every file and picture it offers", () => {
    for (const item of BRAND_KIT) {
      expect(existsSync(publicFile(item.file)), item.file).toBe(true);
      expect(existsSync(publicFile(item.preview)), item.preview).toBe(true);
    }
  });

  it("has its words in every language", () => {
    for (const locale of LOCALES) {
      for (const item of BRAND_KIT) {
        expect(EARN_BRAND_KIT_COPY[locale].items[item.id]?.title, `${locale} ${item.id}`).toBeTruthy();
        expect(EARN_BRAND_KIT_COPY[locale].kinds[item.kind]).toBeTruthy();
      }
      expect(EARN_BRAND_KIT_COPY[locale].claim).toContain("{credits}");
    }
  });

  it("downloads under the file's own name", () => {
    expect(brandKitFileName({ file: "/brand-kit/repget-logo.png" })).toBe("repget-logo.png");
    expect(new Set(BRAND_KIT.map(brandKitFileName)).size).toBe(BRAND_KIT.length);
  });
});
