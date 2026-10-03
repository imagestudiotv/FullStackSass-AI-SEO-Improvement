import type { WebsiteInvitation, WebsiteMember } from "@/lib/websites/members";

/** Both lists the members table shows, read together so the table never reflows halfway. */
export type MemberLists = { members: WebsiteMember[]; invitations: WebsiteInvitation[] };

export type SyncOutcome = "applied" | "stale" | "failed";

/**
 * Reads one website's people and applies them ONLY if that website is still
 * the one on screen.
 *
 * Every read in the members panel goes through this: the first load after a
 * site switch, the quiet background re-read, and the re-read after an invite,
 * removal, resend or cancellation. The last of those used to apply whatever
 * came back, so switching site while an action was in flight could write the
 * old site's people under the new site's name - showing access that does not
 * exist.
 *
 * `isCurrent` is asked AFTER the reply arrives, which is the point: the
 * choice may have changed while the request was out.
 */
export async function syncMembers(
  websiteId: string,
  isCurrent: (websiteId: string) => boolean,
  load: (websiteId: string) => Promise<MemberLists>,
  apply: (lists: MemberLists) => void,
): Promise<SyncOutcome> {
  let lists: MemberLists;
  try {
    lists = await load(websiteId);
  } catch {
    return isCurrent(websiteId) ? "failed" : "stale";
  }
  if (!isCurrent(websiteId)) return "stale";
  apply(lists);
  return "applied";
}
