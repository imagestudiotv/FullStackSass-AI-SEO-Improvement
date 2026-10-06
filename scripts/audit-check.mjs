#!/usr/bin/env node
// @ts-check
/**
 * CI's "Audit all dependencies" gate: `npm audit --audit-level=high` plus ONE
 * kind of exception - an advisory the owner has explicitly accepted, at a
 * stated severity and for a limited time, in .github/audit-allowlist.json.
 *
 *   node scripts/audit-check.mjs
 *
 * npm audit has no ignore list, and dropping dev dependencies from the audit
 * would hide every future build-tool advisory along with the accepted one. So
 * this runs the full-tree audit and the production audit (--omit=dev, exactly
 * as CI's production step does) and passes only when every HIGH or CRITICAL
 * advisory in them is:
 *   - on the allowlist, matched by GHSA id AND package name;
 *   - rated no higher than the severity the owner accepted (critical > high);
 *   - within its review date ("expires" is the last valid day, in UTC);
 *   - absent from the production audit: an exception covers dev tooling only.
 * Everything else fails. So does an audit it cannot read: npm that cannot
 * start, times out or exits with anything but 0 or 1; an npm error object
 * (audit service unreachable, no lockfile); output that is not JSON or not a
 * version 2 report; summary counts that disagree with the packages listed.
 * What it cannot catch is an audit service answering with an empty but
 * well-formed report: that reads as a clean tree, to npm as to this. An
 * allowlist entry that matches nothing is then raised as a warning - the
 * visible sign of an empty or odd report, or of a fix upstream. Moderate and
 * low advisories are listed but never fail, as with --audit-level=high.
 *
 * On GitHub Actions it also annotates the run, so that even a green run shows
 * each waiver (notice), a review date in its final week or an entry matching
 * nothing (warning), and each failure (error), and it adds a short job
 * summary. .github/workflows/audit-weekly.yml runs it every Monday as well,
 * so an expiry or a new advisory surfaces without a push.
 *
 * This file only runs the check, unconditionally: no "am I the entry point?"
 * test, because one that misfires exits 0 without auditing. The logic lives
 * in audit-gate.mjs, which the tests import (src/lib/dependency-audit.test.ts).
 * Policy and renewal: docs/security-day-1.md.
 */
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatAnnotations, formatDecision, formatStepSummary, runAuditCheck, workflowCommand } from "./audit-gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// UTC, like the runners: a review date ends at the same moment everywhere.
const today = new Date().toISOString().slice(0, 10);
const decision = runAuditCheck({ root, today });
(decision.ok ? console.log : console.error)(formatDecision(decision));

if (process.env.GITHUB_ACTIONS === "true") {
  for (const line of formatAnnotations(decision)) console.log(line);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      appendFileSync(summaryFile, formatStepSummary(decision));
    } catch (error) {
      // The decision stands either way; only its summary is lost.
      console.log(workflowCommand("warning", "Dependency audit", `Could not write the job summary (${error instanceof Error ? error.message : error}).`));
    }
  }
}

process.exitCode = decision.ok ? 0 : 1;
