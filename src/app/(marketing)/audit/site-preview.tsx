/*
  eslint-disable @next/next/no-img-element --
  The image is on the CUSTOMER's domain, which is not knowable ahead of time.
  next/image needs every remote host in remotePatterns, so optimising this
  would mean either a wildcard — which turns our optimiser into an open image
  proxy — or a config change per visitor.
*/
import { Globe } from "lucide-react";

import { previewSiteImage } from "@/lib/audit/site-image";

/**
 * The browser frame on the audit loading screen, with a picture of the site.
 *
 * WHY NOT AN IFRAME. That was the first attempt, and it renders blank for most
 * real sites: measured across seven, four refused framing with
 * X-Frame-Options or a frame-ancestors CSP — including imagestudio.com, the
 * client's own domain, which is what the report was about. Worse, a blocked
 * frame fires no error a script can read, so there is no way to detect the
 * failure and swap in something else.
 *
 * So the picture comes from the site's own og:image, fetched on the server
 * where no framing policy applies. Every one of those four blocked sites has
 * one, because it is the image they already publish for social cards — which
 * makes it the closest thing to a screenshot that is both reliable and free.
 *
 * A server component, deliberately: the fetch happens during the render that
 * is already waiting on the crawl, so the picture costs no extra wait.
 */
export async function SitePreview({ domain }: { domain: string }) {
  const image = await previewSiteImage(domain);

  return (
    <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/10 via-muted/40 to-blue-500/10">
      {image ? (
        <img
          src={image}
          alt=""
          className="size-full object-cover object-top"
        />
      ) : (
        /*
          No og:image either. A tinted panel with the address rather than a
          broken-image icon or a spinner that never resolves — the frame is
          scenery, and scenery should not look like a failure.
        */
        <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
          <Globe className="size-7 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{domain}</p>
        </div>
      )}
    </div>
  );
}

/**
 * What the frame shows while the picture is still being fetched.
 *
 * The same box at the same size, so nothing shifts when the image lands.
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
