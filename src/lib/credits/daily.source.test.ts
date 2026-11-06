import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Daily credits have one writer, reached from one action, reached from one
 * button. A new caller - a layout, a job, an email - would be an automatic grant
 * again, and no behaviour test of today's callers would notice it. So this reads
 * the source: everything under src/ except tests.
 */

const SRC = path.resolve(__dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const FILES = sources(SRC).map((file) => ({ name: path.relative(SRC, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));
const using = (pattern: RegExp) =>
  FILES.filter((file) => pattern.test(file.text))
    .map((file) => file.name)
    .sort();

describe("who can give daily credits", () => {
  it("only the claim writes a daily_grant row", () => {
    expect(using(/type:\s*"daily_grant"/)).toEqual(["lib/credits/daily.ts"]);
  });

  it("only the action calls the claim, and only the check-in button calls the action", () => {
    expect(using(/\bclaimDailyCredits\(/)).toEqual(["lib/credits/daily-actions.ts", "lib/credits/daily.ts"]);
    expect(using(/\bclaimDailyCreditsAction\(/)).toEqual(["components/daily-claim.tsx", "lib/credits/daily-actions.ts"]);
  });

  it("the automatic grant is gone", () => {
    expect(using(/\bensureDailyCredits\b/)).toEqual([]);
  });

  it("the action takes nothing from the client and reads the workspace from the session", () => {
    const action = FILES.find((file) => file.name === "lib/credits/daily-actions.ts")?.text ?? "";
    expect(action).toMatch(/export async function claimDailyCreditsAction\(\)/);
    expect(action).toMatch(/await requireOrg\(\)/);
  });
});
