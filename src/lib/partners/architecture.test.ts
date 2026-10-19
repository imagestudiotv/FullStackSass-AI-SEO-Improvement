import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The partner program's dependency rules, checked on the source:
 *
 *   Presentation -> Application -> Domain
 *   Infrastructure -> Application interfaces and Domain types
 *
 *  - domain imports nothing but other domain files: no Next.js, Drizzle,
 *    Stripe, HTTP or email;
 *  - application imports only domain and application: it never constructs a
 *    database or Stripe client, and never reaches into infrastructure;
 *  - client components never import server-only partner modules, and no UI
 *    imports the commission policy (React never calculates money);
 *  - financial arithmetic outside domain goes through the domain policies:
 *    no parseFloat / toFixed / Math.round on money in application or
 *    infrastructure.
 */

const root = path.resolve(__dirname);
const src = path.resolve(__dirname, "../..");

function files(dir: string, filter: (file: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

const source = (file: string) => /\.(ts|tsx)$/.test(file) && !/\.test\.ts$/.test(file);

function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g)) specifiers.push(match[1]);
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) specifiers.push(match[1]);
  for (const match of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(match[1]);
  return specifiers;
}

/** The repository-relative path an import resolves to, for relative and "@/" specifiers. */
function resolved(from: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return path.join(src, specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(from), specifier);
  return null;
}

const within = (target: string | null, dir: string) => target !== null && (target === dir || target.startsWith(dir + path.sep));

describe("partner program architecture", () => {
  const domain = path.join(root, "domain");
  const application = path.join(root, "application");

  it("has a domain layer that imports only itself", () => {
    const offenders: string[] = [];
    for (const file of files(domain, source)) {
      for (const specifier of imports(file)) {
        if (!within(resolved(file, specifier), domain)) offenders.push(`${path.relative(src, file)} -> ${specifier}`);
      }
    }
    expect(files(domain, source).length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });

  it("has an application layer that imports only domain and application", () => {
    const offenders: string[] = [];
    for (const file of files(application, source)) {
      for (const specifier of imports(file)) {
        const target = resolved(file, specifier);
        if (!within(target, domain) && !within(target, application)) offenders.push(`${path.relative(src, file)} -> ${specifier}`);
      }
    }
    expect(files(application, source).length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });

  it("keeps server-only partner modules out of client components and money out of the UI", () => {
    const uiRoots = [path.join(src, "components", "partners"), path.join(src, "app")];
    const offenders: string[] = [];
    for (const dir of uiRoots) {
      for (const file of files(dir, (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f))) {
        const text = readFileSync(file, "utf8");
        const isClient = /^\s*["']use client["']/.test(text);
        for (const specifier of imports(file)) {
          const target = resolved(file, specifier);
          if (!within(target, root)) continue;
          const rel = path.relative(root, target!).replace(/\\/g, "/");
          if (rel.startsWith("domain/policies/commission") || rel.startsWith("domain/policies/maturity")) {
            offenders.push(`${path.relative(src, file)} calculates money via ${specifier}`);
          }
          // Client components may call server actions and read pure copy and formatting - nothing else.
          if (isClient && !/^presentation\/(serializers|validation|format|copy|actions|admin-actions)(\.ts)?$/.test(rel)) {
            offenders.push(`${path.relative(src, file)} (client) -> ${specifier}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("marks the composition root and infrastructure entry points server-only", () => {
    for (const rel of ["server.ts", "presentation/guards.ts", "infrastructure/persistence/unit-of-work.ts"]) {
      expect(readFileSync(path.join(root, rel), "utf8")).toMatch(/^import "server-only";/);
    }
  });

  it("does no floating-point money arithmetic outside the domain", () => {
    const offenders: string[] = [];
    for (const dir of [application, path.join(root, "infrastructure")]) {
      for (const file of files(dir, source)) {
        const text = readFileSync(file, "utf8");
        if (/parseFloat\(|\.toFixed\(|Math\.round\(/.test(text)) offenders.push(path.relative(src, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
