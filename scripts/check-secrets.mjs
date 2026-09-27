#!/usr/bin/env node
/**
 * Scans tracked (and staged) files for credentials that must never be
 * committed.
 *
 *   npm run check:secrets            # tracked + staged files
 *   npm run check:secrets -- --all   # also untracked, not-ignored files
 *
 * It prints the FILE, LINE and KIND of each finding and never the matched
 * text: a scanner that echoes secrets into CI logs creates the leak it is
 * looking for. Exits 1 when anything is found, so it can gate CI or a
 * pre-commit hook (see docs/credentials.md).
 *
 * Deliberately small and dependency-free. A dedicated scanner (gitleaks,
 * trufflehog) is broader; this catches the high-signal patterns this project
 * actually uses and runs anywhere Node and git do.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  ["Stripe secret key", /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}/],
  ["Stripe webhook secret", /\bwhsec_[0-9A-Za-z]{16,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ["Database URL with a password", /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]{3,}@(?!(?:127\.0\.0\.1|localhost|\[::1\])[:/])/],
  ["Anthropic API key", /\bsk-ant-[0-9A-Za-z_-]{20,}/],
  ["OpenAI API key", /\bsk-(?:proj-)?[0-9A-Za-z_-]{32,}/],
  ["Google OAuth client secret", /\bGOCSPX-[0-9A-Za-z_-]{20,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Inngest signing key", /\bsignkey-(?:prod|test|branch)-[0-9a-f]{16,}/],
  ["Sentry auth token", /\bsntry[su]_[0-9A-Za-z_=-]{20,}/],
  ["Resend API key", /\bre_[0-9A-Za-z]{8,}_[0-9A-Za-z]{16,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghs|ghu)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{40,}/],
  ["Slack token", /\bxox[abprs]-[0-9A-Za-z-]{10,}/],
  ["JSON Web Token", /\beyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}/],
  [
    "Assigned secret in an env-style file",
    /^\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*["']?[^\s"'#]{8,}/,
    (file) => /(^|\/)\.env|\.(?:env|txt|cfg|ini|conf)$/.test(file),
  ],
];

/** Files whose job is to hold placeholders or fake values. */
const ALLOW = [/^\.env\.example$/, /^scripts\/check-secrets\.mjs$/];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

const files = new Set([
  ...git(["ls-files"]),
  ...git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]),
  ...(process.argv.includes("--all") ? git(["ls-files", "--others", "--exclude-standard"]) : []),
]);

const findings = [];
for (const file of files) {
  if (ALLOW.some((re) => re.test(file))) continue;
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree, or unreadable
  }
  if (text.includes("\u0000")) continue; // binary
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [kind, re, applies] of PATTERNS) {
      if (applies && !applies(file)) continue;
      if (re.test(line)) findings.push(`${file}:${index + 1}  ${kind}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`Possible credentials in ${findings.length} place(s) (values not shown):`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error("\nMove them to .env.local or the host's environment settings. See docs/credentials.md.");
  process.exit(1);
}
console.log(`No credentials found in ${files.size} file(s).`);
