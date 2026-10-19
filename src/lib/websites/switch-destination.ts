/** Keep section pages when switching sites, never another site's resource ID. */
export function websiteSwitchDestination(pathname: string, websiteId: string, defaultId?: string): string {
  const match = /^\/websites\/[^/]+(?:\/(.*))?$/.exec(pathname);
  if (!match) return websiteId === defaultId ? "/dashboard" : `/dashboard?site=${websiteId}`;

  const section = match[1] ?? "";
  if (section === "articles" || section.startsWith("articles/")) return `/websites/${websiteId}/content`;
  const sharedSections = new Set([
    "", "content", "profile", "publishing", "integrations", "google", "ai-visibility", "traffic",
    "backlinks", "backlinks/links", "backlinks/credits",
  ]);
  return `/websites/${websiteId}${sharedSections.has(section) && section ? `/${section}` : ""}`;
}
