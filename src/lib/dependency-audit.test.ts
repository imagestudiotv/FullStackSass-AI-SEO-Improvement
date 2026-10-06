import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  ALLOWLIST_FILE,
  FULL_AUDIT_ARGS,
  PRODUCTION_AUDIT_ARGS,
  evaluateAudit,
  formatAnnotations,
  formatDecision,
  formatStepSummary,
  parseAllowlist,
  parseAuditReport,
  runAuditCheck,
  workflowCommand,
  type NpmRun,
} from "../../scripts/audit-gate.mjs";

/**
 * CI's "Audit all dependencies" gate (scripts/audit-check.mjs, logic in
 * scripts/audit-gate.mjs). It lives outside src/, so its tests live here,
 * where vitest looks. Fixtures follow the real `npm audit --json` shape
 * (npm 10, auditReportVersion 2), including the braces graph exactly as npm
 * reported it on 2026-10-06.
 */

type Via = string | Record<string, unknown>;
type Vulnerability = { severity: string; via: Via[]; isDirect?: boolean };

const TODAY = "2026-10-06";

function advisory(ghsa: string, pkg: string, severity: string, title = `${pkg} advisory`) {
  return { source: 1, name: pkg, dependency: pkg, title, url: `https://github.com/advisories/${ghsa}`, severity, range: "*" };
}

const BRACES = { ...advisory("GHSA-vfj7-8cjw-p6xm", "braces", "high", "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns"), source: 1240992 };

/** The nine high "vulnerabilities" npm lists for the one braces advisory. */
function bracesGraph(severity = "high"): Record<string, Vulnerability> {
  return {
    "@next/eslint-plugin-next": { severity, via: ["fast-glob"] },
    "@shadcn/registry": { severity, via: ["fast-glob", "ts-morph"] },
    "@ts-morph/common": { severity, via: ["fast-glob"] },
    braces: { severity, via: [{ ...BRACES, severity }] },
    "eslint-config-next": { severity, via: ["@next/eslint-plugin-next"], isDirect: true },
    "fast-glob": { severity, via: ["micromatch"] },
    micromatch: { severity, via: ["braces"] },
    shadcn: { severity, via: ["@shadcn/registry", "fast-glob", "ts-morph"], isDirect: true },
    "ts-morph": { severity, via: ["@ts-morph/common"] },
  };
}

/** A report as npm prints it, summary counts included. */
function report(vulnerabilities: Record<string, Vulnerability> = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  const entries: Record<string, unknown> = {};
  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    counts[vulnerability.severity as keyof typeof counts]++;
    counts.total++;
    entries[name] = { name, isDirect: false, effects: [], range: "*", nodes: [`node_modules/${name}`], fixAvailable: false, ...vulnerability };
  }
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities: entries, metadata: { vulnerabilities: counts, dependencies: { prod: 761, dev: 540, total: 1404 } } });
}

function allowlist(...entries: Record<string, unknown>[]) {
  return JSON.stringify({ advisories: entries });
}

const BRACES_ENTRY = {
  id: "GHSA-vfj7-8cjw-p6xm",
  package: "braces",
  severity: "high",
  reason: "Development tooling only; no patched release.",
  acceptedBy: "owner",
  acceptedOn: "2026-10-06",
  expires: "2026-11-06",
};

function evaluate({ full = report(bracesGraph()), production = report(), list = allowlist(BRACES_ENTRY), today = TODAY } = {}) {
  return evaluateAudit({ fullAudit: full, productionAudit: production, allowlist: list, today });
}

describe("dependency audit gate", () => {
  it("waives the allowlisted dev-only advisory once, not once per package in its chain", () => {
    const decision = evaluate();
    expect(decision.failures).toEqual([]);
    expect(decision.ok).toBe(true);
    expect(decision.waived).toHaveLength(1);
    expect(decision.waived[0].advisory).toMatchObject({ id: "GHSA-vfj7-8cjw-p6xm", pkg: "braces", severity: "high" });
    expect(decision.waived[0].advisory.reachedVia).toEqual(Object.keys(bracesGraph()).sort());
    expect(decision.waived[0].entry.daysLeft).toBe(31);
  });

  it("fails on a high advisory that is not allowlisted", () => {
    const decision = evaluate({
      full: report({ ...bracesGraph(), "dev-tool": { severity: "high", via: [advisory("GHSA-aaaa-bbbb-cccc", "dev-tool", "high")] } }),
    });
    expect(decision.ok).toBe(false);
    expect(decision.failures).toHaveLength(1);
    expect(decision.failures[0]).toContain("GHSA-aaaa-bbbb-cccc in dev-tool (high)");
    expect(decision.failures[0]).toContain("Not on the allowlist");
    // The accepted one is still reported as waived alongside.
    expect(decision.waived).toHaveLength(1);
  });

  it("fails on a critical advisory, in dev or production dependencies", () => {
    const critical = { severity: "critical", via: [advisory("GHSA-cccc-dddd-eeee", "proxy-addr", "critical")] };
    for (const decision of [
      evaluate({ full: report({ ...bracesGraph(), "proxy-addr": critical }) }),
      evaluate({ full: report({ ...bracesGraph(), "proxy-addr": critical }), production: report({ "proxy-addr": critical }) }),
    ]) {
      expect(decision.ok).toBe(false);
      expect(decision.failures.join("\n")).toContain("GHSA-cccc-dddd-eeee in proxy-addr (critical)");
    }
  });

  it("fails when the allowlisted advisory reaches production dependencies", () => {
    const decision = evaluate({
      production: report({ braces: { severity: "high", via: [BRACES] }, micromatch: { severity: "high", via: ["braces"] } }),
    });
    expect(decision.ok).toBe(false);
    expect(decision.waived).toEqual([]);
    expect(decision.failures).toHaveLength(1);
    expect(decision.failures[0]).toContain("now reaches production dependencies");
  });

  it("fails when the allowlisted advisory is re-rated above the accepted severity", () => {
    const decision = evaluate({ full: report(bracesGraph("critical")) });
    expect(decision.ok).toBe(false);
    expect(decision.waived).toEqual([]);
    expect(decision.failures).toHaveLength(1);
    expect(decision.failures[0]).toContain("GHSA-vfj7-8cjw-p6xm in braces (critical)");
    expect(decision.failures[0]).toContain("Accepted as high, but it is now rated critical");
  });

  it("covers a high rating when the owner accepted critical", () => {
    const decision = evaluate({ list: allowlist({ ...BRACES_ENTRY, severity: "critical" }) });
    expect(decision.ok).toBe(true);
    expect(decision.waived[0].entry.severity).toBe("critical");
  });

  it("is valid through the review date and fails the day after", () => {
    expect(evaluate({ today: "2026-11-06" }).ok).toBe(true);
    const expired = evaluate({ today: "2026-11-07" });
    expect(expired.ok).toBe(false);
    expect(expired.failures[0]).toContain("passed its review date (2026-11-06)");
    expect(expired.waived).toEqual([]);
  });

  it("fails on an expired entry even once its advisory is gone, so stale exceptions get removed", () => {
    expect(evaluate({ full: report(), today: "2026-10-20" })).toMatchObject({
      ok: true,
      notices: [{ title: "Audit exception matches nothing", text: expect.stringContaining("no high or critical finding matches it") }],
    });
    const expired = evaluate({ full: report(), today: "2026-11-07" });
    expect(expired.ok).toBe(false);
    expect(expired.failures[0]).toContain("matches no current finding");
  });

  it("warns, without failing, in the week before the review date", () => {
    const decision = evaluate({ today: "2026-11-01" });
    expect(decision.ok).toBe(true);
    expect(decision.notices).toEqual([{ title: "Audit exception due for review", text: expect.stringContaining("due for review on 2026-11-06 (5 day(s) left)") }]);
    expect(evaluate({ today: "2026-10-29" }).notices).toEqual([]);
  });

  it("passes moderate and low advisories through as report-only", () => {
    const moderate = { severity: "moderate", via: [advisory("GHSA-mmmm-nnnn-pppp", "postcss-selector-parser", "moderate")] };
    const low = { severity: "low", via: [advisory("GHSA-llll-mmmm-nnnn", "tiny", "low")] };
    const decision = evaluate({ full: report({ "postcss-selector-parser": moderate, tiny: low, shadcn: { severity: "moderate", via: ["postcss-selector-parser"] } }), production: report({ tiny: low }), list: allowlist() });
    expect(decision.ok).toBe(true);
    expect(decision.reportOnly.map((item) => item.id).sort()).toEqual(["GHSA-llll-mmmm-nnnn", "GHSA-mmmm-nnnn-pppp"]);
  });

  it("follows chain entries to their root advisory instead of failing on them", () => {
    // Only "braces" carries the advisory object; the other eight are names.
    const { advisories, errors } = parseAuditReport(report(bracesGraph()), "full");
    expect(errors).toEqual([]);
    expect([...advisories.keys()]).toEqual(["GHSA-vfj7-8cjw-p6xm braces"]);
    // A chain through a non-allowlisted root fails on that root, once.
    const decision = evaluate({
      full: report({ ...bracesGraph(), glob: { severity: "high", via: [advisory("GHSA-gggg-hhhh-jjjj", "glob", "high")] }, rimraf: { severity: "high", via: ["glob", "braces"] } }),
    });
    expect(decision.failures).toHaveLength(1);
    expect(decision.failures[0]).toContain("GHSA-gggg-hhhh-jjjj in glob");
    expect(decision.failures[0]).toContain("Reached through: rimraf");
  });

  it("fails on a high package whose chain leads to no high advisory", () => {
    const decision = evaluate({ full: report({ ...bracesGraph(), orphan: { severity: "high", via: ["not-in-the-report"] } }) });
    expect(decision.ok).toBe(false);
    expect(decision.failures[0]).toContain("orphan is high, but no high or critical advisory explains it");
  });

  it("survives a looping chain", () => {
    const decision = evaluate({ full: report({ ...bracesGraph(), a: { severity: "high", via: ["b"] }, b: { severity: "high", via: ["a", "braces"] } }) });
    expect(decision.ok).toBe(true);
    expect(decision.waived[0].advisory.reachedVia).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("does not waive the same GHSA id in a different package", () => {
    const decision = evaluate({ full: report({ "braces-fork": { severity: "high", via: [{ ...BRACES, name: "braces-fork", dependency: "braces-fork" }] } }) });
    expect(decision.ok).toBe(false);
    expect(decision.failures[0]).toContain("GHSA-vfj7-8cjw-p6xm in braces-fork");
  });

  it.each([
    ["an npm error (audit service unreachable)", JSON.stringify({ message: "request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: ECONNRESET", error: { summary: "", detail: "" } }), "could not complete"],
    ["an npm error without a lockfile", JSON.stringify({ error: { code: "ENOLOCK", summary: "This command requires an existing lockfile.", detail: "" } }), "ENOLOCK"],
    ["empty output", "", "not JSON (empty output)"],
    ["text instead of JSON", "npm ERR! something broke", "not JSON"],
    ["JSON that is not a report", "[]", "not a report object"],
    ["an unknown report version", JSON.stringify({ auditReportVersion: 3, vulnerabilities: {}, metadata: { vulnerabilities: { high: 0, critical: 0 } } }), "unsupported report format"],
    ["a report without summary counts", JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }), "missing its vulnerabilities or summary counts"],
    ["vulnerabilities in an unexpected shape", JSON.stringify({ auditReportVersion: 2, vulnerabilities: [], metadata: { vulnerabilities: { high: 9, critical: 0 } } }), "missing its vulnerabilities"],
    ["counts that disagree with the listing", report().replace('"high":0', '"high":9'), "summary says 9 high / 0 critical, but 0 / 0 are listed"],
    ["an unreadable package entry", JSON.stringify({ auditReportVersion: 2, vulnerabilities: { x: { severity: "high" } }, metadata: { vulnerabilities: { high: 1, critical: 0 } } }), "the entry for x is unreadable"],
    ["an advisory with an unknown severity", report({ x: { severity: "high", via: [advisory("GHSA-xxxx-yyyy-zzzz", "x", "severe")] } }), "an advisory listed for x is unreadable"],
  ])("fails, never passes silently, on %s", (_name, output, message) => {
    for (const decision of [evaluate({ full: output }), evaluate({ production: output })]) {
      expect(decision.ok).toBe(false);
      expect(decision.failures.join("\n")).toContain(message);
      expect(decision.waived).toEqual([]);
    }
  });

  it("passes an empty but well-formed report, and flags the entry it leaves unused", () => {
    // What an audit service answering "nothing found" looks like. Documented
    // as a limit, not a failure: the unused-entry warning is the signal.
    const decision = evaluate({ full: report(), production: report() });
    expect(decision.ok).toBe(true);
    expect(decision.notices.map((notice) => notice.title)).toEqual(["Audit exception matches nothing"]);
    expect(formatAnnotations(decision)).toEqual([expect.stringMatching(/^::warning title=Audit exception matches nothing::GHSA-vfj7-8cjw-p6xm braces is allowlisted/)]);
  });

  it.each([
    ["not JSON", "{", "not valid JSON"],
    ["no advisories array", "{}", '"advisories" array'],
    ["a missing reason", allowlist({ ...BRACES_ENTRY, reason: " " }), '"reason" is required'],
    ["a missing owner", allowlist({ ...BRACES_ENTRY, acceptedBy: undefined }), '"acceptedBy" is required'],
    ["a malformed id", allowlist({ ...BRACES_ENTRY, id: "CVE-2024-4068" }), '"id" must be a GHSA id'],
    ["no severity", allowlist({ ...BRACES_ENTRY, severity: undefined }), '"severity" must be "high" or "critical"'],
    ["a severity that never blocks", allowlist({ ...BRACES_ENTRY, severity: "moderate" }), '"severity" must be "high" or "critical"'],
    ["a severity in the wrong case", allowlist({ ...BRACES_ENTRY, severity: "High" }), '"severity" must be "high" or "critical"'],
    ["an impossible date", allowlist({ ...BRACES_ENTRY, expires: "2026-11-31" }), '"expires" must be a YYYY-MM-DD date'],
    ["no review date", allowlist({ ...BRACES_ENTRY, expires: undefined }), '"expires" must be a YYYY-MM-DD date'],
    ["a review date before acceptance", allowlist({ ...BRACES_ENTRY, expires: "2026-10-01" }), '"expires" must be after "acceptedOn"'],
    ["a window longer than 90 days", allowlist({ ...BRACES_ENTRY, expires: "2027-10-06" }), "at most 90 days"],
    ["an acceptance dated in the future", allowlist({ ...BRACES_ENTRY, acceptedOn: "2026-10-20", expires: "2026-11-20" }), '"acceptedOn" is in the future'],
    ["a duplicate entry", allowlist(BRACES_ENTRY, BRACES_ENTRY), "listed twice"],
  ])("fails on an allowlist with %s", (_name, list, message) => {
    const decision = evaluate({ list });
    expect(decision.ok).toBe(false);
    expect(decision.failures.join("\n")).toContain(message);
  });

  it("allows one day of slack on acceptedOn for an owner ahead of UTC", () => {
    expect(parseAllowlist(allowlist({ ...BRACES_ENTRY, acceptedOn: "2026-10-07" }), TODAY).errors).toEqual([]);
    expect(parseAllowlist(allowlist({ ...BRACES_ENTRY, acceptedOn: "2026-10-08" }), TODAY).errors.join()).toContain('"acceptedOn" is in the future');
  });

  it("reads an allowlist saved with a UTF-8 byte-order mark", () => {
    const list = `﻿${JSON.stringify({ advisories: [BRACES_ENTRY] }, null, 2)}`;
    expect(parseAllowlist(list, TODAY).errors).toEqual([]);
    expect(evaluate({ list }).ok).toBe(true);
  });

  it("keeps the committed allowlist well-formed", () => {
    // The real date, not TODAY: a renewal accepted after 2026-10-07 must not fail here.
    const text = readFileSync(path.resolve(__dirname, "../..", ALLOWLIST_FILE), "utf8");
    const { entries, errors } = parseAllowlist(text, new Date().toISOString().slice(0, 10));
    expect(errors).toEqual([]);
    for (const entry of entries.values()) expect(entry.reason.length).toBeGreaterThan(20);
  });
});

describe("dependency audit gate on GitHub Actions", () => {
  it("annotates each waiver as a notice, so a green run still shows it", () => {
    const lines = formatAnnotations(evaluate());
    expect(lines).toEqual([
      "::notice title=Audit exception in use%3A GHSA-vfj7-8cjw-p6xm in braces::GHSA-vfj7-8cjw-p6xm in braces (high) is waived for development dependencies only: " +
        "accepted as high by owner on 2026-10-06, review by 2026-11-06 (31 day(s) left).",
    ]);
  });

  it("raises the final week before the review date as a warning", () => {
    const lines = formatAnnotations(evaluate({ today: "2026-11-01" }));
    expect(lines.filter((line) => line.startsWith("::warning "))).toEqual([expect.stringMatching(/^::warning title=Audit exception due for review::.*2026-11-06 \(5 day\(s\) left\)/)]);
    expect(lines.filter((line) => line.startsWith("::notice "))).toHaveLength(1);
  });

  it("raises each failure as an error, multi-line text kept on one command line", () => {
    const lines = formatAnnotations(evaluate({ today: "2026-11-07" }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^::error title=Dependency audit failed::GHSA-vfj7-8cjw-p6xm in braces \(high\)/);
    expect(lines[0]).toContain("%0A    Its exception passed its review date (2026-11-06)");
    expect(lines[0]).not.toMatch(/[\r\n]/);
  });

  it("escapes workflow-command data and properties as GitHub requires", () => {
    expect(workflowCommand("warning", "a: b, 100%", "50% done\r\nnext: line, here")).toBe("::warning title=a%3A b%2C 100%25::50%25 done%0D%0Anext: line, here");
  });

  it("keeps an npm-supplied title from starting a workflow command in the log", () => {
    const sneaky = report({ x: { severity: "high", via: [advisory("GHSA-qqqq-rrrr-ssss", "x", "high", "fine\n::stop-commands::token")] } });
    const log = formatDecision(evaluate({ full: sneaky }));
    expect(log.split("\n").some((line) => line.startsWith("::"))).toBe(false);
  });

  it("summarises the run for the job page", () => {
    const summary = formatStepSummary(evaluate({ today: "2026-11-01" }));
    expect(summary).toContain("### Dependency audit: passed");
    expect(summary).toContain("**Audit exception due for review**");
    expect(summary).toContain("GHSA-vfj7-8cjw-p6xm in braces (high) is waived");
    expect(summary).toContain("review by 2026-11-06 (5 day(s) left)");
    expect(formatStepSummary(evaluate({ today: "2026-11-07" }))).toMatch(/### Dependency audit: FAILED[\s\S]*```text\nGHSA-vfj7-8cjw-p6xm in braces/);
  });
});

describe("dependency audit command (npm and the allowlist file)", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  /** A repository root holding only the allowlist, unless `list` is null. */
  function repo(list: string | null = allowlist(BRACES_ENTRY)) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "audit-gate-"));
    dirs.push(dir);
    if (list !== null) {
      mkdirSync(path.join(dir, ".github"));
      writeFileSync(path.join(dir, ALLOWLIST_FILE), list);
    }
    return dir;
  }

  /** npm as CI sees it today: braces in the full tree, nothing in production. */
  const npm = (args: readonly string[]): NpmRun => ({ status: args.includes("--omit=dev") ? 0 : 1, stdout: args.includes("--omit=dev") ? report() : report(bracesGraph()), stderr: "" });

  it("audits the whole tree with dev, optional and peer forced in, and production as CI's own step does", () => {
    expect(FULL_AUDIT_ARGS).toEqual(["audit", "--json", "--include=dev", "--include=optional", "--include=peer"]);
    expect(PRODUCTION_AUDIT_ARGS).toEqual(["audit", "--json", "--omit=dev"]);
    const exec = vi.fn(npm);
    const decision = runAuditCheck({ root: repo(), today: TODAY, exec });
    expect(exec.mock.calls).toEqual([[FULL_AUDIT_ARGS], [PRODUCTION_AUDIT_ARGS]]);
    expect(decision).toMatchObject({ ok: true, failures: [] });
    expect(decision.waived).toHaveLength(1);
  });

  it("still sees dev advisories under NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      // npm's own rule: NODE_ENV=production means --omit=dev unless --include=dev overrides it.
      const npmWithEnv = (args: readonly string[]): NpmRun => {
        const omitDev = args.includes("--omit=dev") || (process.env.NODE_ENV === "production" && !args.includes("--include=dev"));
        return { status: omitDev ? 0 : 1, stdout: omitDev ? report() : report(bracesGraph()) };
      };
      // The control: without the flag, the same npm would hide braces.
      expect(npmWithEnv(["audit", "--json"]).stdout).toBe(report());
      const decision = runAuditCheck({ root: repo(), today: TODAY, exec: npmWithEnv });
      expect(decision.ok).toBe(true);
      expect(decision.waived.map(({ advisory }) => advisory.key)).toEqual(["GHSA-vfj7-8cjw-p6xm braces"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    ["an exit code other than 0 or 1", { status: 2, stdout: "", stderr: "npm ERR! code E500\nnpm ERR! 500 Internal Server Error" }, "exited with 2"],
    ["a kill signal", { status: null, signal: "SIGKILL", stdout: "" }, "exited with SIGKILL"],
    ["a timeout", { status: null, signal: "SIGTERM", stdout: "", error: Object.assign(new Error("spawnSync /bin/sh ETIMEDOUT"), { code: "ETIMEDOUT" }) }, "timed out after 5 minutes"],
    ["a spawn error", { status: null, stdout: "", error: Object.assign(new Error("spawnSync /bin/sh ENOENT"), { code: "ENOENT" }) }, "could not run (spawnSync /bin/sh ENOENT)"],
  ] satisfies [string, NpmRun, string][])("fails when npm ends with %s", (_name, run, message) => {
    for (const failing of [FULL_AUDIT_ARGS, PRODUCTION_AUDIT_ARGS]) {
      const decision = runAuditCheck({ root: repo(), today: TODAY, exec: (args) => (args === failing ? run : npm(args)) });
      expect(decision.ok).toBe(false);
      expect(decision.failures.join("\n")).toContain(`npm ${failing.join(" ")}: ${message}`);
      expect(decision.waived).toEqual([]);
    }
  });

  it("fails when starting npm throws", () => {
    const decision = runAuditCheck({
      root: repo(),
      today: TODAY,
      exec: () => {
        throw new Error("spawn EPERM");
      },
    });
    expect(decision.ok).toBe(false);
    expect(decision.failures).toHaveLength(2);
    expect(decision.failures[0]).toContain("could not run (spawn EPERM)");
  });

  it("fails when the allowlist file is missing", () => {
    const decision = runAuditCheck({ root: repo(null), today: TODAY, exec: npm });
    expect(decision.ok).toBe(false);
    expect(decision.failures).toEqual([expect.stringContaining(`${ALLOWLIST_FILE}: cannot be read`)]);
  });

  it("reads the allowlist file from the repository root, byte-order mark and all", () => {
    expect(runAuditCheck({ root: repo(`﻿${allowlist(BRACES_ENTRY)}`), today: TODAY, exec: npm }).ok).toBe(true);
    expect(runAuditCheck({ root: repo(allowlist()), today: TODAY, exec: npm }).failures).toEqual([expect.stringContaining("Not on the allowlist")]);
  });
});
