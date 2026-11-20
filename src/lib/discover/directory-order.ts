/**
 * THE DIRECTORY'S ORDER (client, 2026-11-19: "imagestudio website will be
 * always first stable fixed, no matter the other businesses we will be
 * adding"). The /discover list, in every language: Image Studio's profile is
 * row 1 whichever sort the visitor picks (most upvoted, A-Z) and whenever a
 * category filter or a search still shows it; the rest follow in the chosen
 * sort.
 *
 * Which entry is Image Studio is decided on the server by the stories' rule
 * (lib/success-stories/order.ts isImageStudioCard: website imagestudio.com,
 * or named "Image Studio" with no website) and sent as `pinned`, so this file
 * stays import-free and the browser bundle does not carry the case study.
 *
 * Sorting is a stable partition, never a filter: every entry comes out once,
 * pinned or not, so a list cut into pages after this can neither repeat nor
 * lose Image Studio.
 */

export type DirectorySort = "votes" | "az";

type Sortable = { name: string; upvotes: number; publishedAt: string; pinned?: boolean };

/** "Most upvoted": every upvote, then the newest. */
function byVotes(a: Sortable, b: Sortable): number {
  return b.upvotes - a.upvotes || b.publishedAt.localeCompare(a.publishedAt);
}

/** The entries in the directory's order; a new array, the input untouched. */
export function sortDirectory<T extends Sortable>(entries: readonly T[], sort: DirectorySort, locale: string): T[] {
  const compare = sort === "az" ? (a: T, b: T) => a.name.localeCompare(b.name, locale) || byVotes(a, b) : byVotes;
  const pinned = entries.filter((entry) => entry.pinned).sort(compare);
  const rest = entries.filter((entry) => !entry.pinned).sort(compare);
  return [...pinned, ...rest];
}
