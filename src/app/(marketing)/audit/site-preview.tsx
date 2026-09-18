import { Globe } from "lucide-react";

/**
 * The picture area inside the browser frame on the audit loading screen.
 *
 * This is the WAITING state: the site's address on a tinted panel, shown
 * while the crawl runs.
 *
 * There is deliberately no fetching here. An earlier version fetched the
 * site's og:image from this component, which raced the audit — a cached
 * result returns in milliseconds while the picture still needs a second or
 * two, so the screen unmounted before the image arrived and this fallback was
 * the only thing anyone ever saw. The picture now travels on the audit result
 * itself, from the crawl that already reads the page, and appears with the
 * findings.
 */
export function SitePreviewFallback({ domain }: { domain: string }) {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-muted/40 to-blue-500/10 px-6 text-center">
      <Globe
        className="size-7 animate-pulse text-muted-foreground/40"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{domain}</p>
    </div>
  );
}
