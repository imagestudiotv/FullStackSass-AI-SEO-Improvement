/**
 * PROOF OF OWNERSHIP for a post a direct send may have created.
 *
 * When a create gets no answer, the post may or may not exist. This used to
 * be settled by looking the article's CURRENT slug up on the site and
 * adopting whatever post had it - which adopted (and then overwrote) an
 * unrelated post that happened to own the slug, missed our own post when
 * WordPress had suffixed the slug ("-2"), and missed it again once the
 * article's slug was edited. A slug is neither ours nor stable.
 *
 * Every direct send now carries an invisible marker naming the exact
 * dispatch it came from:
 *
 *   <!-- repget:v1 article=<uuid> website=<uuid> dispatch=<uuid> -->
 *
 * The dispatch row is written (with this marker in its request snapshot)
 * BEFORE the request leaves. Reconciliation searches the site for the
 * dispatch id and adopts a post only when exactly one post's own stored
 * content carries a marker for this dispatch, article and website. Anything
 * else is not proof:
 *
 *   none       - nothing found. One empty search is NOT proof the post does
 *                not exist (a slow create can land later): the dispatch stays
 *                uncertain, the lookup is recorded, and it is looked up again
 *                later. Only a person can declare it not published.
 *   ambiguous  - several posts carry the marker, or one carries it with a
 *                different article/website: a person decides.
 *   unverifiable - the site did not return raw content (no edit rights), or
 *                the dispatch predates markers: a person decides.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MARKER = new RegExp(`<!--\\s*repget:v1\\s+article=(${UUID})\\s+website=(${UUID})\\s+dispatch=(${UUID})\\s*-->`, "gi");

export type Ownership = { articleId: string; websiteId: string; dispatchId: string };

export function ownershipMarker(ids: Ownership): string {
  return `<!-- repget:v1 article=${ids.articleId} website=${ids.websiteId} dispatch=${ids.dispatchId} -->`;
}

/** The HTML sent for a dispatch: the delivered copy plus its marker. */
export function withOwnershipMarker(html: string, ids: Ownership): string {
  return `${html}\n${ownershipMarker(ids)}`;
}

export function readOwnershipMarkers(html: string): Ownership[] {
  return [...html.matchAll(MARKER)].map((m) => ({
    articleId: m[1].toLowerCase(),
    websiteId: m[2].toLowerCase(),
    dispatchId: m[3].toLowerCase(),
  }));
}

export type MarkerCandidate = {
  remoteId: string;
  remoteUrl: string;
  status: string;
  /** The post's stored content (context=edit). Null when the site withheld it. */
  rawContent: string | null;
};

export type OwnershipVerdict =
  | { result: "found"; post: MarkerCandidate }
  | { result: "none" }
  | { result: "ambiguous"; count: number }
  | { result: "unverifiable" };

export function judgeCandidates(candidates: MarkerCandidate[], ids: Ownership): OwnershipVerdict {
  const dispatchId = ids.dispatchId.toLowerCase();
  const carrying: MarkerCandidate[] = [];
  let conflicting = 0;
  let withheld = 0;
  for (const candidate of candidates) {
    if (candidate.rawContent === null) {
      withheld++;
      continue;
    }
    const markers = readOwnershipMarkers(candidate.rawContent).filter((m) => m.dispatchId === dispatchId);
    if (markers.length === 0) continue; // the id appeared in the text some other way
    if (markers.every((m) => m.articleId === ids.articleId.toLowerCase() && m.websiteId === ids.websiteId.toLowerCase())) {
      carrying.push(candidate);
    } else {
      conflicting++;
    }
  }
  if (conflicting > 0 || carrying.length > 1) return { result: "ambiguous", count: carrying.length + conflicting };
  if (carrying.length === 1) return withheld > 0 ? { result: "unverifiable" } : { result: "found", post: carrying[0] };
  return withheld > 0 ? { result: "unverifiable" } : { result: "none" };
}
