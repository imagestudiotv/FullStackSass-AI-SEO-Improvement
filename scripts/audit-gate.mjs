// @ts-check
/**
 * Everything scripts/audit-check.mjs runs; its header describes the gate. Kept
 * in a module of its own so that the command needs no "am I the entry point?"
 * check, which fails open when it misfires (a symlinked path, another runner):
 * the tests import this file, and executing audit-check.mjs always audits.
 *
 * Node built-ins only: it audits the dependencies, so it must not need them.
 * The decision is evaluateAudit(), a pure function tested with fixture reports
 * in src/lib/dependency-audit.test.ts. runAuditCheck() adds the two npm runs
 * and the allowlist file, with npm injectable so that its failures (an exit
 * code, a timeout, a missing file) are tested too.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * @typedef {"info" | "low" | "moderate" | "high" | "critical"} Severity
 *
 * @typedef {object} Advisory
 * @property {string} key       `${id} ${pkg}` - what an allowlist entry must match.
 * @property {string} id        GHSA id, or `npm-<source>` when the report has none (never allowlistable).
 * @property {string} pkg       The vulnerable package itself (braces), not the tool that pulls it in.
 * @property {Severity} severity
 * @property {string} title
 * @property {string} url
 * @property {string[]} reachedVia Every package in the report whose chain leads to this advisory.
 *
 * @typedef {object} AllowlistEntry
 * @property {string} key
 * @property {string} id
 * @property {string} pkg
 * @property {"high" | "critical"} severity The highest rating the owner accepted.
 * @property {string} reason
 * @property {string} acceptedBy
 * @property {string} acceptedOn
 * @property {string} expires
 * @property {number} daysLeft  Whole days until `expires` (0 on the day itself, negative once passed).
 *
 * @typedef {object} Notice
 * @property {string} title Short, for a CI annotation's heading.
 * @property {string} text
 *
 * @typedef {object} AuditDecision
 * @property {boolean} ok
 * @property {string[]} failures    Each one is a reason the gate fails.
 * @property {{ advisory: Advisory, entry: AllowlistEntry }[]} waived
 * @property {Advisory[]} reportOnly Below high: shown, never blocking.
 * @property {Notice[]} notices     Worth acting on, not failing (unused or soon-due entries); warnings on CI.
 *
 * @typedef {object} NpmRun What spawnSync returns, as far as the check reads it.
 * @property {number | null} status
 * @property {string | null} [signal]
 * @property {string | null} [stdout]
 * @property {string | null} [stderr]
 * @property {Error} [error]
 *
 * @typedef {(args: readonly string[]) => NpmRun} NpmExec
 */

const SEVERITIES = /** @type {const} */ (["info", "low", "moderate", "high", "critical"]);
const BLOCKING = new Set(["high", "critical"]);
const GHSA_IN_TEXT = /GHSA(?:-[0-9a-z]{4}){3}/i;
const GHSA_ID = /^GHSA(?:-[0-9a-z]{4}){3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const NPM_TIMEOUT_MS = 5 * 60_000;

/**
 * The longest an exception may run between acceptance and review. Renewing is
 * a fresh owner decision with a new date, never one long-lived entry.
 */
export const MAX_WAIVER_DAYS = 90;
/** Start warning (a CI annotation) this many days before an entry's review date. */
export const EXPIRY_WARNING_DAYS = 7;
export const ALLOWLIST_FILE = ".github/audit-allowlist.json";

/**
 * The full tree, pinned: NODE_ENV=production or an npmrc "omit" would
 * otherwise drop dev dependencies from `npm audit` without a word.
 */
export const FULL_AUDIT_ARGS = Object.freeze(["audit", "--json", "--include=dev", "--include=optional", "--include=peer"]);
/** Exactly the flags of CI's "Audit production dependencies" step. */
export const PRODUCTION_AUDIT_ARGS = Object.freeze(["audit", "--json", "--omit=dev"]);

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is Severity} */
function isSeverity(value) {
  return typeof value === "string" && /** @type {readonly string[]} */ (SEVERITIES).includes(value);
}

/** Normalises GHSA-VFJ7-... and ghsa-vfj7-... to GitHub's own spelling. */
function normaliseGhsa(/** @type {string} */ id) {
  return `GHSA${id.slice(4).toLowerCase()}`;
}

/** Milliseconds at UTC midnight, or null unless `value` is a real calendar date (no 2026-02-30). */
function parseIsoDate(/** @type {unknown} */ value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value ? null : ms;
}

/** First line of output that is not what we expected, short enough for a CI log. */
function preview(/** @type {string} */ text) {
  const line = text.trim().split(/\r?\n/, 1)[0] ?? "";
  return line ? `"${line.length > 120 ? `${line.slice(0, 120)}...` : line}"` : "empty output";
}

/**
 * Reads one `npm audit --json` report into its ADVISORIES.
 *
 * npm lists every vulnerable PACKAGE. A package's "via" holds either advisory
 * objects (the package itself is vulnerable) or plain package names (it is
 * only vulnerable because it depends on one that is). Today's braces finding
 * is one advisory listed as nine high packages; counting packages would ask
 * for nine waivers of the same decision, so the chain links are followed back
 * to the advisories they inherit from instead.
 *
 * Any doubt is an error, never an empty result: an npm error object, another
 * report version, or a high/critical package that no high/critical advisory
 * explains (a format change could otherwise read as "nothing found"). A
 * well-formed report that lists nothing is clean, though: neither npm nor this
 * can tell it apart from an audit service that answered with nothing.
 *
 * @param {string} text  Raw stdout.
 * @param {string} label Which audit, for messages.
 * @returns {{ advisories: Map<string, Advisory>, errors: string[] }}
 */
export function parseAuditReport(text, label) {
  /** @type {Map<string, Advisory>} */
  const advisories = new Map();
  /** @type {string[]} */
  const errors = [];
  const fail = (/** @type {string} */ message) => ({ advisories, errors: [`${label}: ${message}`] });

  /** @type {unknown} */
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(`npm audit output is not JSON (${preview(String(text))}).`);
  }
  if (!isRecord(json)) return fail("npm audit output is not a report object.");
  if ("error" in json) {
    // What npm prints when the registry's audit endpoint fails or there is no lockfile.
    const error = isRecord(json.error) ? json.error : {};
    const detail = [json.message, error.code, error.summary, error.detail].filter((part) => typeof part === "string" && part.trim()).join(" - ");
    return fail(`npm audit could not complete${detail ? `: ${detail}` : ""}. Nothing was checked; rerun once the audit service answers.`);
  }
  if (json.auditReportVersion !== 2) {
    return fail(`unsupported report format (auditReportVersion ${JSON.stringify(json.auditReportVersion)}, expected 2). Update this script before trusting it.`);
  }
  const vulnerabilities = json.vulnerabilities;
  const counts = isRecord(json.metadata) ? json.metadata.vulnerabilities : undefined;
  if (!isRecord(vulnerabilities) || !isRecord(counts) || !Number.isInteger(counts.high) || !Number.isInteger(counts.critical)) {
    return fail("report is missing its vulnerabilities or summary counts.");
  }

  // Pass 1: every package entry, and the advisory objects listed directly on it.
  /** @type {Map<string, { severity: Severity, links: string[], own: string[] }>} */
  const packages = new Map();
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!isRecord(entry) || !isSeverity(entry.severity) || !Array.isArray(entry.via)) {
      errors.push(`${label}: the entry for ${name} is unreadable.`);
      continue;
    }
    /** @type {string[]} */
    const links = [];
    /** @type {string[]} */
    const own = [];
    for (const via of entry.via) {
      if (typeof via === "string") {
        links.push(via); // inherits whatever advisory that package carries
        continue;
      }
      if (!isRecord(via) || !isSeverity(via.severity)) {
        errors.push(`${label}: an advisory listed for ${name} is unreadable.`);
        continue;
      }
      const url = typeof via.url === "string" ? via.url : "";
      const ghsa = url.match(GHSA_IN_TEXT)?.[0];
      const id = ghsa ? normaliseGhsa(ghsa) : `npm-${via.source ?? "unknown"}`;
      const pkg = typeof via.name === "string" && via.name ? via.name : name;
      const key = `${id} ${pkg}`;
      own.push(key);
      if (!advisories.has(key)) {
        // One line: a title is printed to the CI log, where a line starting
        // with "::" is a workflow command (one could stop the annotations).
        const title = typeof via.title === "string" ? via.title.replace(/\s+/g, " ").trim() : "";
        advisories.set(key, { key, id, pkg, severity: via.severity, title, url, reachedVia: [] });
      }
    }
    packages.set(name, { severity: entry.severity, links, own });
  }

  // npm's summary counts packages by severity. If ours disagree, the shape of
  // the report is not what this script understands.
  const listed = { high: 0, critical: 0 };
  for (const { severity } of packages.values()) if (severity === "high" || severity === "critical") listed[severity]++;
  if (listed.high !== counts.high || listed.critical !== counts.critical) {
    errors.push(
      `${label}: summary says ${counts.high} high / ${counts.critical} critical, but ${listed.high} / ${listed.critical} are listed. npm's report format may have changed.`,
    );
  }

  // Pass 2: follow each package's chain to the advisories it inherits.
  for (const [name, { severity }] of packages) {
    /** @type {Set<string>} */
    const roots = new Set();
    /** @type {Set<string>} */
    const seen = new Set();
    const walk = (/** @type {string} */ current) => {
      if (seen.has(current)) return; // npm's graph can loop
      seen.add(current);
      const node = packages.get(current);
      if (!node) return;
      node.own.forEach((key) => roots.add(key));
      node.links.forEach(walk);
    };
    walk(name);
    for (const key of roots) advisories.get(key)?.reachedVia.push(name);
    const explained = [...roots].some((key) => BLOCKING.has(advisories.get(key)?.severity ?? ""));
    if (BLOCKING.has(severity) && !explained) {
      errors.push(`${label}: ${name} is ${severity}, but no high or critical advisory explains it. Read the full npm audit output.`);
    }
  }
  for (const advisory of advisories.values()) advisory.reachedVia.sort();
  return { advisories, errors };
}

/**
 * Reads the allowlist. Every field is required, because each one is part of
 * the owner's decision: what (id + package), how bad (severity), why, who,
 * when, and until when.
 *
 * @param {string} text
 * @param {string} today UTC date, YYYY-MM-DD.
 * @returns {{ entries: Map<string, AllowlistEntry>, errors: string[] }}
 */
export function parseAllowlist(text, today) {
  /** @type {Map<string, AllowlistEntry>} */
  const entries = new Map();
  /** @type {string[]} */
  const errors = [];
  const todayMs = parseIsoDate(today);
  if (todayMs === null) throw new Error(`today must be a YYYY-MM-DD date, got ${JSON.stringify(today)}`);

  /** @type {unknown} */
  let json;
  try {
    // Some Windows editors save UTF-8 with a byte-order mark, which JSON.parse rejects.
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { entries, errors: [`${ALLOWLIST_FILE}: not valid JSON.`] };
  }
  if (!isRecord(json) || !Array.isArray(json.advisories)) {
    return { entries, errors: [`${ALLOWLIST_FILE}: expected an object with an "advisories" array.`] };
  }

  json.advisories.forEach((/** @type {unknown} */ raw, /** @type {number} */ index) => {
    const where = `${ALLOWLIST_FILE} entry ${index + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    /** @type {string[]} */
    const problems = [];
    if (typeof raw.id !== "string" || !GHSA_ID.test(raw.id)) problems.push('"id" must be a GHSA id such as GHSA-vfj7-8cjw-p6xm');
    if (typeof raw.package !== "string" || !raw.package.trim()) problems.push('"package" must name the vulnerable package');
    // Moderate and low never block, so only these two can be accepted.
    if (raw.severity !== "high" && raw.severity !== "critical") problems.push('"severity" must be "high" or "critical": the rating the owner accepted');
    for (const field of ["reason", "acceptedBy"]) {
      if (typeof raw[field] !== "string" || !raw[field].trim()) problems.push(`"${field}" is required`);
    }
    const acceptedMs = parseIsoDate(raw.acceptedOn);
    const expiresMs = parseIsoDate(raw.expires);
    if (acceptedMs === null) problems.push('"acceptedOn" must be a YYYY-MM-DD date');
    if (expiresMs === null) problems.push('"expires" must be a YYYY-MM-DD date');
    if (acceptedMs !== null && expiresMs !== null) {
      if (expiresMs <= acceptedMs) problems.push('"expires" must be after "acceptedOn"');
      if (expiresMs - acceptedMs > MAX_WAIVER_DAYS * DAY_MS) problems.push(`an exception may run at most ${MAX_WAIVER_DAYS} days from "acceptedOn"; renew it with a new decision instead`);
    }
    // One day of slack for an owner a timezone ahead of UTC; a later date would
    // let "acceptedOn" push the window past MAX_WAIVER_DAYS from today.
    if (acceptedMs !== null && acceptedMs > todayMs + DAY_MS) problems.push('"acceptedOn" is in the future');
    if (problems.length) {
      errors.push(`${where}: ${problems.join("; ")}.`);
      return;
    }
    const id = /** @type {string} */ (raw.id);
    const pkg = /** @type {string} */ (raw.package).trim();
    const key = `${id} ${pkg}`;
    if (entries.has(key)) {
      errors.push(`${where}: ${key} is listed twice.`);
      return;
    }
    entries.set(key, {
      key,
      id,
      pkg,
      severity: raw.severity,
      reason: raw.reason,
      acceptedBy: raw.acceptedBy,
      acceptedOn: raw.acceptedOn,
      expires: raw.expires,
      daysLeft: Math.round((/** @type {number} */ (expiresMs) - todayMs) / DAY_MS),
    });
  });
  return { entries, errors };
}

/**
 * The gate. Pure: the reports, the allowlist text and today's date in; the
 * decision out.
 *
 * @param {{ fullAudit: string, productionAudit: string, allowlist: string, today: string }} input
 *   Raw stdout of the full and the production audit (FULL_AUDIT_ARGS,
 *   PRODUCTION_AUDIT_ARGS), the allowlist file's text, and today's UTC date
 *   (YYYY-MM-DD).
 * @returns {AuditDecision}
 */
export function evaluateAudit({ fullAudit, productionAudit, allowlist, today }) {
  const full = parseAuditReport(fullAudit, "Full audit");
  const production = parseAuditReport(productionAudit, "Production audit (--omit=dev)");
  const { entries, errors: allowlistErrors } = parseAllowlist(allowlist, today);
  /** @type {AuditDecision} */
  const decision = { ok: false, failures: [...full.errors, ...production.errors, ...allowlistErrors], waived: [], reportOnly: [], notices: [] };
  // A report we could not read cannot be judged: say so, and nothing else.
  if (full.errors.length || production.errors.length) return decision;

  // Production findings are judged too, should the full tree ever miss one.
  const advisories = new Map(full.advisories);
  for (const [key, advisory] of production.advisories) if (!advisories.has(key)) advisories.set(key, advisory);

  /** @type {Set<string>} */
  const used = new Set();
  for (const advisory of advisories.values()) {
    if (!BLOCKING.has(advisory.severity)) {
      decision.reportOnly.push(advisory);
      continue;
    }
    const entry = entries.get(advisory.key);
    if (!entry) {
      decision.failures.push(`${describe(advisory)}\n    Not on the allowlist. Update the dependency, or record an owner decision in ${ALLOWLIST_FILE}.`);
      continue;
    }
    used.add(entry.key);
    /** @type {string[]} */
    const reasons = [];
    if (production.advisories.has(advisory.key)) {
      reasons.push("Allowlisted for development tooling only, but it now reaches production dependencies (npm audit --omit=dev). The exception does not cover that.");
    }
    if (SEVERITIES.indexOf(advisory.severity) > SEVERITIES.indexOf(entry.severity)) {
      reasons.push(`Accepted as ${entry.severity}, but it is now rated ${advisory.severity}. The exception does not cover that. ${renewal()}`);
    }
    if (entry.daysLeft < 0) reasons.push(`Its exception passed its review date (${entry.expires}). ${renewal()}`);
    if (reasons.length) decision.failures.push(`${describe(advisory)}\n    ${reasons.join("\n    ")}`);
    else decision.waived.push({ advisory, entry });
  }

  for (const entry of entries.values()) {
    if (entry.daysLeft < 0 && !used.has(entry.key)) {
      decision.failures.push(`${ALLOWLIST_FILE}: ${entry.key} passed its review date (${entry.expires}) and matches no current finding. ${renewal()}`);
    } else if (!used.has(entry.key)) {
      decision.notices.push({
        title: "Audit exception matches nothing",
        text:
          `${entry.key} is allowlisted but no high or critical finding matches it. Either a fix landed or the audit came back empty or odd: ` +
          `confirm the fix (npm ls ${entry.pkg}) before removing the entry.`,
      });
    } else if (entry.daysLeft >= 0 && entry.daysLeft <= EXPIRY_WARNING_DAYS) {
      decision.notices.push({
        title: "Audit exception due for review",
        text: `${entry.key}: the exception is due for review on ${entry.expires} (${entry.daysLeft} day(s) left). ${renewal()}`,
      });
    }
  }

  decision.ok = decision.failures.length === 0;
  return decision;
}

function renewal() {
  return `Re-review it: renew with a new owner decision and date, or remove it (see docs/security-day-1.md).`;
}

/** @param {Advisory} advisory */
function describe(advisory) {
  const via = advisory.reachedVia.filter((name) => name !== advisory.pkg);
  return [
    `${advisory.id} in ${advisory.pkg} (${advisory.severity}): ${advisory.title || "untitled"}`,
    advisory.url && `    ${advisory.url}`,
    via.length && `    Reached through: ${via.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** @param {{ advisory: Advisory, entry: AllowlistEntry }} waiver */
function describeWaiver({ advisory, entry }) {
  return (
    `${advisory.id} in ${advisory.pkg} (${advisory.severity}) is waived for development dependencies only: ` +
    `accepted as ${entry.severity} by ${entry.acceptedBy} on ${entry.acceptedOn}, review by ${entry.expires} (${entry.daysLeft} day(s) left).`
  );
}

/** The CI log. @param {AuditDecision} decision */
export function formatDecision(decision) {
  const lines = [];
  if (decision.waived.length) {
    lines.push("Waived (owner-accepted, development dependencies only):");
    for (const { advisory, entry } of decision.waived) {
      lines.push(`  ${describe(advisory).replaceAll("\n", "\n  ")}`);
      lines.push(
        `      Accepted as ${entry.severity} by ${entry.acceptedBy} on ${entry.acceptedOn}; review by ${entry.expires} (${entry.daysLeft} day(s) left). ${entry.reason}`,
      );
    }
  }
  if (decision.reportOnly.length) {
    lines.push("Below high (shown, not blocking):");
    for (const advisory of decision.reportOnly) lines.push(`  ${describe(advisory).replaceAll("\n", "\n  ")}`);
  }
  if (decision.notices.length) {
    lines.push("Warnings (not blocking):");
    for (const notice of decision.notices) lines.push(`  ${notice.title}: ${notice.text}`);
  }
  if (decision.failures.length) {
    lines.push("Blocking:");
    for (const failure of decision.failures) lines.push(`  ${failure.replaceAll("\n", "\n  ")}`);
  }
  lines.push(
    decision.ok
      ? `PASS: no high or critical advisory outside the allowlist${decision.waived.length ? ` (${decision.waived.length} waived)` : ""}.`
      : `FAIL: ${decision.failures.length} blocking problem(s).`,
  );
  return lines.join("\n");
}

/**
 * One GitHub Actions workflow command, escaped as the runner expects: "%",
 * CR and LF in the message; also ":" and "," in a property.
 *
 * @param {"error" | "warning" | "notice"} kind
 * @param {string} title
 * @param {string} message
 */
export function workflowCommand(kind, title, message) {
  const data = (/** @type {string} */ value) => value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  const property = (/** @type {string} */ value) => data(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
  return `::${kind} title=${property(title)}::${data(message)}`;
}

/**
 * Annotations for GitHub Actions. Unlike log lines, these show on the run's
 * summary page whatever the result, so a green run still says that something
 * is waived, due for review, or allowlisted for nothing.
 *
 * @param {AuditDecision} decision
 * @returns {string[]}
 */
export function formatAnnotations(decision) {
  return [
    ...decision.failures.map((failure) => workflowCommand("error", "Dependency audit failed", failure)),
    ...decision.notices.map((notice) => workflowCommand("warning", notice.title, notice.text)),
    ...decision.waived.map((waiver) => workflowCommand("notice", `Audit exception in use: ${waiver.advisory.id} in ${waiver.advisory.pkg}`, describeWaiver(waiver))),
  ];
}

/**
 * Markdown for the job summary ($GITHUB_STEP_SUMMARY).
 *
 * @param {AuditDecision} decision
 */
export function formatStepSummary(decision) {
  const md = (/** @type {string} */ value) => value.replace(/[\\`*_[\]<>|#]/g, "\\$&");
  const lines = [`### Dependency audit: ${decision.ok ? "passed" : "FAILED"}`, ""];
  if (decision.failures.length) {
    lines.push(`**Blocking (${decision.failures.length}):**`, "", "```text", ...decision.failures, "```", "");
  }
  if (decision.notices.length) {
    lines.push("**Warnings:**", "");
    for (const notice of decision.notices) lines.push(`- **${md(notice.title)}**: ${md(notice.text)}`);
    lines.push("");
  }
  if (decision.waived.length) {
    lines.push("**Waived** (owner-accepted, development dependencies only):", "");
    for (const waiver of decision.waived) lines.push(`- ${md(describeWaiver(waiver))}`);
    lines.push("");
  }
  if (decision.reportOnly.length) lines.push(`${decision.reportOnly.length} advisory(ies) below high: listed in the log, not blocking.`, "");
  lines.push(`Exceptions: \`${ALLOWLIST_FILE}\`. Policy and renewal: \`docs/security-day-1.md\`.`, "");
  return lines.join("\n");
}

/**
 * Runs `npm <args>`. A constant command line through the shell, because on
 * Windows `npm` is a .cmd shim that Node only starts through one; the
 * arguments are the constants above, never input.
 *
 * @param {readonly string[]} args
 * @param {string} cwd
 * @returns {NpmRun}
 */
export function runNpm(args, cwd) {
  return spawnSync(`npm ${args.join(" ")}`, { cwd, shell: true, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: NPM_TIMEOUT_MS });
}

/**
 * One audit's stdout, or why there is none.
 *
 * @param {NpmExec} exec
 * @param {readonly string[]} args
 * @returns {{ stdout: string } | { failure: string }}
 */
function audit(exec, args) {
  const command = `npm ${args.join(" ")}`;
  /** @type {NpmRun} */
  let run;
  try {
    run = exec(args);
  } catch (error) {
    return { failure: `${command}: could not run (${error instanceof Error ? error.message : error}). Nothing was checked.` };
  }
  const stderr = (run.stderr ?? "").trim().split(/\r?\n/).slice(-5).join("\n    ");
  const detail = stderr ? `\n    ${stderr}` : "";
  if (run.error) {
    const timedOut = /** @type {NodeJS.ErrnoException} */ (run.error).code === "ETIMEDOUT";
    const why = timedOut ? `timed out after ${NPM_TIMEOUT_MS / 60_000} minutes` : `could not run (${run.error.message})`;
    return { failure: `${command}: ${why}. Nothing was checked.${detail}` };
  }
  // npm audit exits 1 when it finds anything, which is normal here.
  if (run.status !== 0 && run.status !== 1) {
    return { failure: `${command}: exited with ${run.status ?? run.signal ?? "no exit status"}.${detail}` };
  }
  return { stdout: run.stdout ?? "" };
}

/**
 * The whole check: both audits, the allowlist file, the decision. Anything
 * that stops it reading one of the three fails the gate.
 *
 * @param {{ root: string, today: string, exec?: NpmExec }} options
 *   The repository root, today's UTC date (YYYY-MM-DD), and how to run npm:
 *   runNpm in `root` unless a test passes its own.
 * @returns {AuditDecision}
 */
export function runAuditCheck({ root, today, exec = (args) => runNpm(args, root) }) {
  const full = audit(exec, FULL_AUDIT_ARGS);
  const production = audit(exec, PRODUCTION_AUDIT_ARGS);
  /** @type {string[]} */
  const failures = [full, production].flatMap((run) => ("failure" in run ? [run.failure] : []));
  /** @type {string | undefined} */
  let allowlist;
  try {
    allowlist = readFileSync(path.join(root, ALLOWLIST_FILE), "utf8");
  } catch (error) {
    failures.push(`${ALLOWLIST_FILE}: cannot be read (${error instanceof Error ? error.message : error}).`);
  }
  if (failures.length || !("stdout" in full) || !("stdout" in production) || allowlist === undefined) {
    return { ok: false, failures, waived: [], reportOnly: [], notices: [] };
  }
  return evaluateAudit({ fullAudit: full.stdout, productionAudit: production.stdout, allowlist, today });
}
