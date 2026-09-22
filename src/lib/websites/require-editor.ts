import { requireWebsite, type WebsiteContext } from "@/lib/tenant";

/**
 * Loads a website and refuses if the caller may only read it.
 *
 * WHY THIS EXISTS: the Viewer role was stored and never enforced.
 * requireWebsite has computed `access` since websites gained collaborators,
 * but only two call sites in the codebase read it — both in members.ts,
 * guarding invitations. Every other write action called requireWebsite,
 * ignored the access it returned, and wrote.
 *
 * So somebody invited as a Viewer could edit the business profile, change
 * article settings, start an audit, run keyword research and regenerate
 * articles. The only thing they could not do was invite other people. The
 * dropdown offering "Editor" or "Viewer" was choosing between two words for
 * the same permissions.
 *
 * That gap was invisible because the feature is unused — website_members is
 * empty — which is exactly when it is cheapest to close. The first customer
 * who invites a viewer would otherwise discover it by having their content
 * changed by somebody they meant to give read-only access.
 *
 * OWNER AND EDITOR PASS. An owner is in the workspace that pays for the
 * site; an editor was invited specifically to work on it. Only a viewer is
 * refused, and only for writes — reads still go through requireWebsite,
 * because a viewer is supposed to see everything.
 *
 * Returns the full context so a caller needs one call, not two.
 */
export async function requireEditor(
  websiteId: string,
): Promise<
  | { ok: true; context: WebsiteContext }
  | { ok: false; error: string }
> {
  const context = await requireWebsite(websiteId);

  if (context.access === "viewer") {
    return {
      ok: false,
      error: "You have view-only access to this website.",
    };
  }

  return { ok: true, context };
}
