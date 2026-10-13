/**
 * The credential patterns scripts/check-secrets.mjs looks for, and the one
 * function that applies them. Shared with its test
 * (src/lib/secret-scan.test.ts).
 *
 * A finding is { line, kind } - NEVER the matched text: a scanner that
 * echoes secrets into a terminal or CI log creates the leak it is looking for.
 */

export const PATTERNS = [
  ["Stripe secret key", /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}/],
  ["Stripe webhook secret", /\bwhsec_[0-9A-Za-z]{16,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ["Database URL with a password", /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s:@/]+:[^\s@/]{3,}@(?!(?:127\.0\.0\.1|localhost|\[::1\])[:/])/],
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
  // A Basic-auth header with real-looking credentials (DataForSEO's login and
  // password have no format of their own; this is how they travel).
  ["HTTP Basic credentials", /\bauthorization["']?\s*[:=]\s*["'`]?Basic\s+(?!\$\{)[A-Za-z0-9+/]{16,}={0,2}/i],
  [
    "Assigned secret in an env-style file",
    /^\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*["']?[^\s"'#]{8,}/,
    (file) => /(^|\/)\.env|\.(?:env|txt|cfg|ini|conf)$/.test(file),
  ],
];

/** Files whose job is to hold placeholders or fake values. */
export const ALLOW = [/^\.env\.example$/, /^scripts\/check-secrets\.mjs$/, /^scripts\/secret-patterns\.mjs$/, /^src\/lib\/secret-scan\.test\.ts$/];

/** Where in `text` (the contents of `file`) a credential pattern matches: line numbers and kinds only. */
export function scanText(file, text) {
  if (ALLOW.some((re) => re.test(file))) return [];
  if (text.includes("\u0000")) return []; // binary
  const findings = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [kind, re, applies] of PATTERNS) {
      if (applies && !applies(file)) continue;
      if (re.test(line)) findings.push({ line: index + 1, kind });
    }
  });
  return findings;
}
