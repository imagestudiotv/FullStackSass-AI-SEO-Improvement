#!/usr/bin/env node
/**
 * The application the partner-program browser tests run against, kept away
 * from every real system:
 *
 *   node e2e/partners/app.mjs db      --admin-url <postgres://...localhost.../postgres> [--name repget_e2e_partners]
 *   node e2e/partners/app.mjs prepare --dir <copy>
 *   node e2e/partners/app.mjs build   --dir <copy> --db <url> [--port 3240]
 *   node e2e/partners/app.mjs start   --dir <copy> --db <url> [--port 3240]
 *
 * WHY A COPY: Next.js loads .env.local from the project directory, and here
 * .env.local holds real credentials. The copy has no .env file (the runner
 * refuses one), and the server gets an environment built from scratch: a
 * localhost database, an invalid test-mode Stripe key (so the program runs
 * in test mode and nothing can be created at Stripe), webhook secrets
 * generated for this run, Inngest pointed at an unreachable local port,
 * x-real-ip trusted as the client address (the tests give each simulated
 * person their own), and no mail, AI, analytics or error-reporting keys. The generated values are
 * written to a state file in the OS temp directory for the tests, never to
 * the repository.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "../../src/vendor/postgres/index.js";

const PLATFORM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const STATE_FILE = process.env.E2E_STATE ?? path.join(tmpdir(), "repget-e2e-partners.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DB_NAME = /^repget_e2e_[a-z0-9_]{1,40}$/;

function args() {
  const [command, ...rest] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, "")] = rest[i + 1];
  return { command, options };
}

function localDatabase(url, { requireE2eName = true } = {}) {
  const parsed = new URL(url);
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error(`refusing ${parsed.hostname}: only a local database is used`);
  const name = parsed.pathname.replace(/^\//, "");
  if (requireE2eName && !DB_NAME.test(name)) throw new Error(`refusing database "${name}": the name must match ${DB_NAME}`);
  return parsed;
}

function refuseEnvFiles(dir) {
  const found = readdirSync(dir).filter((name) => name.startsWith(".env") && name !== ".env.example");
  if (found.length) throw new Error(`refusing ${dir}: it contains ${found.join(", ")} (the copy must have no .env file)`);
}

async function createDatabase(adminUrl, name) {
  const admin = localDatabase(adminUrl, { requireE2eName: false });
  if (!DB_NAME.test(name)) throw new Error(`database name must match ${DB_NAME}`);
  const server = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  await server.unsafe(`drop database if exists ${name} with (force)`);
  await server.unsafe(`create database ${name}`);
  await server.end();
  const target = new URL(admin.toString());
  target.pathname = `/${name}`;
  const sql = postgres(target.toString(), { max: 1, onnotice: () => {} });
  const [{ available }] = await sql`select exists (select 1 from pg_available_extensions where name = 'vector') as available`;
  if (available) await sql.unsafe("create extension if not exists vector");
  const journal = JSON.parse(readFileSync(path.join(PLATFORM, "drizzle/meta/_journal.json"), "utf8"));
  for (const { tag } of journal.entries) {
    const file = readFileSync(path.join(PLATFORM, "drizzle", `${tag}.sql`), "utf8");
    for (const statement of (available ? file : file.replace(/vector\(\d+\)/g, "text")).split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
      await sql.unsafe(statement);
    }
  }
  await sql.end();
  console.log(`created ${target} (${journal.entries.length} migrations, vector: ${available})`);
}

function prepare(dir) {
  const target = path.resolve(dir);
  if (target.startsWith(PLATFORM + path.sep) || target === PLATFORM) throw new Error("the copy must be outside the repository");
  mkdirSync(target, { recursive: true });
  for (const entry of ["src", "public", "drizzle"]) {
    rmSync(path.join(target, entry), { recursive: true, force: true });
    cpSync(path.join(PLATFORM, entry), path.join(target, entry), { recursive: true, filter: (source) => !path.basename(source).startsWith(".env") });
  }
  for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "components.json", "next-env.d.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
    if (existsSync(path.join(PLATFORM, file))) cpSync(path.join(PLATFORM, file), path.join(target, file));
  }
  refuseEnvFiles(target);
  console.log(`copied the app to ${target}. Install its dependencies there once (npm ci), then build.`);
}

function environment(options, state) {
  const db = localDatabase(options.db).toString();
  const base = `http://127.0.0.1:${options.port ?? 3240}`;
  const keep = ["PATH", "Path", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT"];
  const env = Object.fromEntries(keep.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  return {
    ...env,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_APP_URL: base,
    DATABASE_URL: db,
    DIRECT_URL: db,
    ...(state
      ? {
          NODE_ENV: "production",
          BETTER_AUTH_URL: base,
          BETTER_AUTH_SECRET: state.authSecret,
          ADMIN_EMAILS: state.adminEmail,
          GOOGLE_CLIENT_ID: "e2e-not-used",
          GOOGLE_CLIENT_SECRET: "e2e-not-used",
          // Test mode, and deliberately unusable: nothing can be created at Stripe with it.
          STRIPE_SECRET_KEY: "sk_test_e2e_invalid_key_nothing_works",
          STRIPE_WEBHOOK_SECRET: state.webhookSecret,
          STRIPE_CONNECT_WEBHOOK_SECRET: state.connectWebhookSecret,
          // Jobs go to an Inngest "dev server" on a closed local port: delivery fails locally and stays in the outbox.
          INNGEST_DEV: "http://127.0.0.1:9",
          // Each simulated person sends their own x-real-ip (documentation ranges), as a proxy would: network
          // signals and per-visitor rate limits then behave as they do behind Vercel.
          TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
        }
      : {}),
  };
}

function next(dir, nextArgs, env) {
  refuseEnvFiles(dir);
  const child = spawn(process.execPath, [path.join(dir, "node_modules/next/dist/bin/next"), ...nextArgs], { cwd: dir, env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}

const { command, options } = args();
if (command === "db") {
  await createDatabase(options["admin-url"], options.name ?? "repget_e2e_partners");
} else if (command === "prepare") {
  prepare(options.dir);
} else if (command === "build") {
  next(path.resolve(options.dir), ["build"], environment(options, null));
} else if (command === "start") {
  const port = options.port ?? "3240";
  const state = {
    baseUrl: `http://127.0.0.1:${port}`,
    databaseUrl: localDatabase(options.db).toString(),
    adminEmail: "admin@e2e.test",
    authSecret: randomBytes(32).toString("hex"),
    webhookSecret: `whsec_${randomBytes(24).toString("hex")}`,
    connectWebhookSecret: `whsec_${randomBytes(24).toString("hex")}`,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`state for the tests: ${STATE_FILE}`);
  next(path.resolve(options.dir), ["start", "-p", port, "-H", "127.0.0.1"], environment({ ...options, port }, state));
} else {
  console.error("usage: node e2e/partners/app.mjs db|prepare|build|start [options]");
  process.exit(2);
}
