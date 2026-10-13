import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { scanText } from "../../scripts/secret-patterns.mjs";

/**
 * The secret scanner (scripts/check-secrets.mjs): it must find credentials
 * and must never print them. Every fake credential below is assembled at
 * runtime, so this file holds no credential-shaped text of its own.
 */

const fake = (prefix: string, length: number) => prefix + "Q7x".repeat(Math.ceil(length / 3)).slice(0, length);
const SAMPLES: [string, string, string][] = [
  ["Stripe secret key", "app.ts", `const key = "${fake("sk_" + "live_", 24)}";`],
  ["Stripe webhook secret", "app.ts", `secret: "${fake("whsec" + "_", 24)}"`],
  ["Private key", "id.txt", `-----BEGIN ${"OPENSSH"} PRIVATE KEY-----`],
  ["Database URL with a password", "notes.md", `postgres://user:${fake("pw", 10)}@db.example.com:5432/app`],
  ["Anthropic API key", "app.ts", fake("sk-" + "ant-", 30)],
  ["HTTP Basic credentials", "fetch.ts", `headers: { Authorization: "Basic ${fake("dXNl", 24)}" }`],
  ["Assigned secret in an env-style file", ".env.production", `DATAFORSEO_PASSWORD=${fake("p", 16)}`],
];

describe("scanText", () => {
  it.each(SAMPLES)("finds a %s and reports only its line and kind", (kind, file, line) => {
    const findings = scanText(file, `first line\n${line}\nlast line`);
    expect(findings).toContainEqual({ line: 2, kind });
    // Nothing of the value comes back.
    for (const finding of findings) expect(Object.keys(finding).sort()).toEqual(["kind", "line"]);
  });

  it("leaves placeholders, local databases and code that builds a header alone", () => {
    expect(scanText(".env.example", `STRIPE_SECRET_KEY=${fake("sk_" + "live_", 24)}`)).toEqual([]);
    expect(scanText("test.ts", "postgres://postgres:postgres@127.0.0.1:5432/test")).toEqual([]);
    expect(scanText("client.ts", "Authorization: `Basic ${Buffer.from(login).toString(\"base64\")}`")).toEqual([]);
    // The env-style rule is for env-style files only: code mentions PASSWORD= all the time.
    expect(scanText("form.tsx", `const PASSWORD=${fake("p", 16)}`)).toEqual([]);
  });
});

describe("check-secrets.mjs on a throwaway repository", () => {
  const script = resolve(__dirname, "../../scripts/check-secrets.mjs");
  const dir = mkdtempSync(join(tmpdir(), "secret-scan-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=test", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "pipe" });
  const scan = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" });
  const secret = fake("sk_" + "live_", 24);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("catches a staged secret even after the working copy was cleaned, and a removed one in history - never printing it", () => {
    git("init", "-q");
    writeFileSync(join(dir, "ok.ts"), "export const x = 1;\n");
    git("add", "ok.ts");
    git("commit", "-q", "-m", "clean");
    expect(scan().status).toBe(0);

    // Staged, then edited away in the working tree only: the commit would still carry it.
    writeFileSync(join(dir, "config.ts"), `export const key = "${secret}";\n`);
    git("add", "config.ts");
    writeFileSync(join(dir, "config.ts"), "export const key = process.env.KEY;\n");
    const staged = scan();
    expect(staged.status).toBe(1);
    expect(staged.stderr).toContain("config.ts:1  Stripe secret key (staged)");
    expect(staged.stdout + staged.stderr).not.toContain(secret);
    expect(staged.stdout + staged.stderr).not.toContain(secret.slice(8, 20));

    // Committed, then removed by the next commit: clean today, still in history.
    git("commit", "-q", "-m", "oops");
    git("add", "config.ts");
    git("commit", "-q", "-m", "remove it");
    expect(scan().status).toBe(0);
    const history = scan("--history");
    expect(history.status).toBe(1);
    expect(history.stderr).toMatch(/[0-9a-f]{12} config\.ts:1 {2}Stripe secret key \(history\)/);
    expect(history.stdout + history.stderr).not.toContain(secret);
  });
});
