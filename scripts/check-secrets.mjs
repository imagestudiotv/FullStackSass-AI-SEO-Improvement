#!/usr/bin/env node
/**
 * Scans the repository for credentials that must never be committed.
 *
 *   npm run check:secrets                # tracked files, and staged content
 *   npm run check:secrets -- --all       # also untracked, not-ignored files
 *   npm run check:secrets -- --history   # also every line ever added, in every local commit
 *
 * It prints the FILE (or COMMIT and file), LINE and KIND of each finding and
 * never the matched text: a scanner that echoes secrets into CI logs creates
 * the leak it is looking for. Exits 1 when anything is found, so it can gate
 * CI or a pre-commit hook (see docs/credentials.md).
 *
 * What it does NOT read: ignored files (.env.local, *.bak, key files - they
 * are ignored precisely because they hold credentials), anything outside the
 * repository, and remote history that has not been fetched. --history covers
 * the commits that are local (all refs and the reflog's reachable ones).
 *
 * Deliberately small and dependency-free. A dedicated scanner (gitleaks,
 * trufflehog) is broader; this catches the high-signal patterns this project
 * actually uses (scripts/secret-patterns.mjs) and runs anywhere Node and git do.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import { ALLOW, scanText } from "./secret-patterns.mjs";

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, ...options });
}
const lines = (out) => out.split("\n").filter(Boolean);

const findings = [];

// The working-tree copy of every tracked file (and, with --all, of every untracked one).
const files = new Set([
  ...lines(git(["ls-files"])),
  ...(process.argv.includes("--all") ? lines(git(["ls-files", "--others", "--exclude-standard"])) : []),
]);
for (const file of files) {
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree, or unreadable
  }
  for (const { line, kind } of scanText(file, text)) findings.push(`${file}:${line}  ${kind}`);
}

// What is STAGED - the index copy, which is what a commit would contain,
// even if the working-tree copy has been edited since.
const staged = lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));
for (const file of staged) {
  let text;
  try {
    text = git(["show", `:${file}`], { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    continue;
  }
  if (text.length > 2_000_000) continue;
  for (const { line, kind } of scanText(file, text)) {
    const finding = `${file}:${line}  ${kind}`;
    if (!findings.includes(finding)) findings.push(`${finding} (staged)`);
  }
}

// Every added line of every local commit: a secret committed and then
// removed is still in history, and is published by the next push.
let commits = 0;
if (process.argv.includes("--history")) {
  const log = git(["log", "--all", "--no-color", "--no-ext-diff", "-p", "--unified=0", "--format=commit %H"]);
  let commit = "";
  let file = "";
  let lineNo = 0;
  for (const raw of log.split("\n")) {
    if (raw.startsWith("commit ")) {
      commit = raw.slice(7, 19);
      commits += 1;
    } else if (raw.startsWith("+++ ")) {
      file = raw.startsWith("+++ b/") ? raw.slice(6) : "";
    } else if (raw.startsWith("@@")) {
      lineNo = Number(/\+(\d+)/.exec(raw)?.[1] ?? 0);
    } else if (raw.startsWith("+") && file) {
      if (!ALLOW.some((re) => re.test(file))) {
        for (const { kind } of scanText(file, raw.slice(1))) findings.push(`${commit} ${file}:${lineNo}  ${kind} (history)`);
      }
      lineNo += 1;
    }
  }
}

if (findings.length > 0) {
  console.error(`Possible credentials in ${findings.length} place(s) (values not shown):`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error("\nMove them to .env.local or the host's environment settings, and rotate anything that reached a commit. See docs/credentials.md.");
  process.exit(1);
}
console.log(
  `No credentials found in ${files.size} file(s)${staged.length ? `, ${staged.length} staged` : ""}${commits ? `, or in the history of ${commits} commit(s)` : ""}.`,
);
