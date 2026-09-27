# Dependencies: security status and how to change them

Status as of 2026-09-26, from `npm audit` after the changes below. Run `npm audit` again after any dependency change; this file is not a substitute for that.

## Resolved

| Package | Advisory | Fix |
|---|---|---|
| `qs` (through `inngest` → `express`) | the `qs` advisories reported against 6.15.3 | `overrides.qs: ^6.16.0` in package.json (6.16.0 installed) |
| `vitest`, `@vitest/mocker` | GHSA-82fw-gwwq-j7x9 (path traversal through redirect mocks, < 4.1.11) | `vitest ^4.1.11` (4.1.11 installed), plus `vite ^7.3.6` as a direct devDependency |

Vitest 4 needed no test or config changes. On 2026-09-26 all 440 tests passed in a clean `npm ci` copy, with the real-Postgres suites against pgvector PostgreSQL 17 (`TEST_POSTGRES_URL`, with `REQUIRE_TEST_POSTGRES=1` and `REQUIRE_PGVECTOR=1` so they cannot skip silently).

`vite` is listed directly for a specific reason. Vitest 4 makes Vite a required peer. Unpinned, the resolver pulls in Vite 8, whose optional esbuild peer (`^0.27 || ^0.28`) conflicts with the top-level esbuild 0.25. `npm ci` on npm 10 then rejects the lockfile as out of sync. Pinning to the 7.x line already in use avoids both problems.

## Unresolved: 4 moderate

| Package | Advisory | Path |
|---|---|---|
| `esbuild` 0.18.20 | GHSA-67mh-4wv8-2f99: the esbuild **dev server** (`serve`) accepts cross-origin requests | `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` |
| `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `drizzle-kit` | inherited from the above | same |

These advisories remain open; nothing has fixed them.

`npm audit fix --force` would *downgrade* drizzle-kit to 0.18.1, which is incompatible with this project's migrations. Do not run it.

### What each audit command reports

Run separately on 2026-09-26, against the committed lockfile:

| Command | Result |
|---|---|
| `npm audit` | 4 moderate |
| `npm audit --omit=dev` | **4 moderate** |
| `npm audit --omit=optional` | 4 moderate |
| `npm audit --omit=dev --omit=optional` | 0 |

`--omit=dev` alone does not remove them. `drizzle-kit` and `vitest` are devDependencies here, but `better-auth` (a production dependency) also lists both as OPTIONAL peers. The lockfile therefore marks them `devOptional` - needed by dev OR optional - and only omitting both drops them. That 0 is a statement about a tree that excludes optional packages. It is not the tree that gets installed.

### Installed is not the same as reachable

**Installed:** yes, in production installs too. A fresh `npm ci --omit=dev` of this lockfile installs `drizzle-kit` 0.31.10, the vulnerable nested `esbuild` 0.18.20, `vitest` 4.1.11 and `vite` 7.3.6. A Vercel build installs the full tree including devDependencies. The vulnerable files are on disk in every environment.

**Reachable at runtime:** no evidence of it. This is an assessment, not a fix; each point was checked in the installed tree:

- **Nothing loads the vulnerable copy.** No `.js`, `.cjs` or `.mjs` file in `node_modules` outside `@esbuild-kit/*` itself references `@esbuild-kit/esm-loader` or `@esbuild-kit/core-utils`. drizzle-kit lists the loader as a dependency but its `bin.cjs` only does `require("esbuild")`, which resolves to the top-level, patched esbuild 0.25.12.
- **Nothing calls the vulnerable API.** The advisory concerns esbuild's `serve()`. There are zero `.serve(` or `esbuild.context(` calls in drizzle-kit's `bin.cjs` or in either `@esbuild-kit` package.
- **The app does not use drizzle-kit.** Nothing in `src/` or `next.config.ts` references it. It runs only from the `db:generate`, `db:push` and `db:studio` scripts on a developer's machine.

The risk that remains is a developer machine running `drizzle-kit`. Even there, no dev server from the vulnerable copy is started. `drizzle-kit studio` does open its own local server, which is a separate surface not covered by this advisory.

**Mitigations until it is fixed:**

- Run drizzle-kit only locally, and only against disposable or development databases.
- Do not run `db:studio` on untrusted networks.
- Keep `npm audit fix --force` out of routine use.

### Upgrade path

No stable drizzle-kit drops the `@esbuild-kit` chain. The latest, 0.31.11, still depends on it.

The drizzle-kit 1.0 prereleases (`beta`, `rc`) replace it and fall outside the advisory's range. However, 1.0 is a rewrite:

- It changes the migration folder layout.
- It removes `drizzle/meta/_journal.json`, which `src/test/db.ts` and `src/test/postgres.ts` read.
- It is meant to ship alongside drizzle-orm 1.0, which is still a prerelease.

Plan the move as its own change once both 1.0 releases are stable. That change includes running `drizzle-kit up` to convert the existing migrations, and updating the test harness to the new layout.

## Changing dependencies

- **Regenerating the lockfile needs npm 11.6 or later.** npm 10.9.x crashes while resolving Vitest 4's peer set, with `Cannot read properties of null (reading 'edgesOut')` inside `@npmcli/arborist`. Versions 10.9.3, 10.9.8 and 10.9.9 all do this; it is an npm bug, not a conflict in this project. For example:

  ```sh
  npx -y npm@11.20.0 install --package-lock-only -D <package>
  npm ci
  ```

  The lockfile committed here was produced that way.
- **Installing needs only npm 10.** `npm ci` on npm 10.9.8 installs this lockfile cleanly, so CI and Vercel need no change.
- **Differences between npm 10 and npm 11 output.** A lockfile re-written by npm 10 differs from npm 11's only in `dev` flags on about 113 platform-binary entries. No version changes.
- **Do not use `--force` or `--legacy-peer-deps` to get past a resolution error.** Both install a tree that npm itself considers invalid.
