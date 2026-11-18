"use client";

import { useState } from "react";

import type { SiteCard } from "@/lib/websites/site-card";

/**
 * A website's own icon, loaded straight from it (no referrer sent), or its
 * first letter on a tile when it has none or the icon fails to load. Used by
 * the homepage field's suggestion and the growth plan.
 */
export function SiteIcon({
  site,
  host,
  size,
  className,
  letterClassName,
}: {
  site: Pick<SiteCard, "name" | "faviconUrl"> | null | undefined;
  host: string;
  size: number;
  className: string;
  letterClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (site?.name ?? host).trim().charAt(0).toUpperCase() || "•";
  return site?.faviconUrl && !failed ? (
    // A third-party icon of unknown size and host: next/image would need every host configured.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={site.faviconUrl} alt="" width={size} height={size} className={className} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  ) : (
    <span className={letterClassName} style={{ width: size, height: size }} aria-hidden="true">
      {letter}
    </span>
  );
}
