import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { EMAIL_LOGO } from "@/lib/email/layout";

/**
 * The logo every email loads on open (eval 2026-11-28: the 190 KB, 2757 x 690
 * original was loaded each time). A small copy, twice the shown size.
 */
describe("EMAIL_LOGO", () => {
  const file = path.resolve(__dirname, "../../../public", new URL(EMAIL_LOGO.src).pathname.slice(1));

  it("is a small file in public/, on the production domain", () => {
    expect(EMAIL_LOGO.src).toBe("https://www.repget.com/images/repget-logo-email.png");
    expect(statSync(file).size).toBeLessThan(15_000);
  });

  it("is twice the size it is shown at (140 x 35), so it stays sharp", async () => {
    const meta = await sharp(readFileSync(file)).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({ width: EMAIL_LOGO.width * 2, height: EMAIL_LOGO.height * 2 });
    expect({ width: EMAIL_LOGO.width, height: EMAIL_LOGO.height }).toEqual({ width: 140, height: 35 });
  });
});
