import { createHash } from "node:crypto";

/** Objects with their keys in order, so the same content always hashes the same. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, part]) => [key, sorted(part)]),
    );
  }
  return value;
}

/** A hash of what a platform returned for a post. See lib/publishing/overwrite-guard.ts. */
export function remoteHash(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(sorted(parts))).digest("hex");
}
