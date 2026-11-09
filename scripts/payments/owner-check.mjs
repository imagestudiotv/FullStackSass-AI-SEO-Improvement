// Owner-run payment checks (review Step 6). Same guard as the earlier
// run-verify.cjs: reads ONLY the lines it needs from the env file you name,
// refuses live keys unless you add --live-read-only (and then only read-only
// checks run), never prints a key, and passes the values to the check by
// environment variable.
//
//   node scripts/payments/owner-check.mjs <env file> config
//       Expected vs. subscribed webhook events (Stripe and PayPal), and the
//       Stripe Customer Portal's prices. Read-only.
//   node scripts/payments/owner-check.mjs <env file> local
//       After the sandbox / test-mode run (docs/payment-provider-checks.md):
//       reads the LOCAL verification database and prints what each flow
//       recorded. Refuses any database not on this machine.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [file, command, ...rest] = process.argv.slice(2);
const liveReadOnly = rest.includes("--live-read-only");
if (!file || !["config", "local"].includes(command ?? "")) {
  console.error("Usage: node scripts/payments/owner-check.mjs <env file> config|local [--live-read-only]");
  process.exit(2);
}
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const read = (name) => {
  const line = lines.find((l) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=`).test(l));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
};

const env = { ...process.env };
// Never inherit provider secrets from the shell: only what this file gives.
for (const name of ["STRIPE_SECRET_KEY", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "DIRECT_URL", "DATABASE_URL"]) delete env[name];

if (command === "config") {
  const stripe = read("STRIPE_SECRET_KEY");
  if (stripe) {
    if (/^(sk|rk)_live_/.test(stripe) && !liveReadOnly) {
      console.error("REFUSED: that is a LIVE Stripe key. Add --live-read-only to read live configuration (GET only). Stripe was not contacted.");
      process.exit(2);
    }
    if (!/^(sk|rk)_(test|live)_/.test(stripe)) {
      console.error("REFUSED: STRIPE_SECRET_KEY is not a Stripe key.");
      process.exit(2);
    }
    env.STRIPE_CHECK_KEY = stripe;
  }
  const paypalEnv = read("PAYPAL_ENV") || "sandbox";
  if (paypalEnv === "live" && !liveReadOnly) {
    console.error("REFUSED: PAYPAL_ENV is live. Add --live-read-only to read live configuration (GET only). PayPal was not contacted.");
    process.exit(2);
  }
  env.PAYPAL_CHECK_ENV = paypalEnv === "live" ? "live" : "sandbox";
  env.PAYPAL_CHECK_CLIENT_ID = read("PAYPAL_CLIENT_ID");
  env.PAYPAL_CHECK_SECRET = read("PAYPAL_CLIENT_SECRET");
  const result = spawnSync(process.execPath, [path.join(__dirname, "..", "check-payment-config.mjs")], { env, stdio: "inherit" });
  process.exit(result.status ?? 1);
}

// local: the verification database only, never a remote one.
const url = read("DIRECT_URL") || read("DATABASE_URL");
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  host = "";
}
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`REFUSED: the database in that file is not on this machine (${host || "unreadable"}). Nothing was read.`);
  process.exit(2);
}
env.VERIFY_DATABASE_URL = url;
const result = spawnSync(process.execPath, [path.join(__dirname, "verify-local.mjs")], { env, stdio: "inherit" });
process.exit(result.status ?? 1);
