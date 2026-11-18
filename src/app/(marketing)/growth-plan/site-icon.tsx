"use client";

import { useState } from "react";

import type { SiteCard } from "@/lib/websites/site-card";

/**
 * A website's own icon - the PNG our server read (lib/websites/site-icon-data.ts),
 * else loaded straight from the site with no referrer sent - or its first
 * letter on a tile. The letter stays until the icon has actually loaded, so
 * a slow or hanging icon never leaves a gap, and it comes back if the icon
 * fails. A white icon (faviconTone "light") is marked data-tone="light" for
 * a dark tile. Used by the homepage field's suggestion and the growth plan.
 */
export function SiteIcon({
  site,
  host,
  size,
  className,
  letterClassName,
}: {
  site: Pick<SiteCard, "name" | "faviconUrl"> & Partial<Pick<SiteCard, "faviconTone">> | null | undefined;
  host: string;
  size: number;
  className: string;
  letterClassName: string;
}) {
  // Keyed by the address, so a new suggestion starts from the letter again.
  const [state, setState] = useState<{ src: string | null; status: "loading" | "loaded" | "failed" }>({ src: null, status: "loading" });
  const src = site?.faviconUrl ?? null;
  const status = state.src === src ? state.status : "loading";
  const letter = (site?.name ?? host).trim().charAt(0).toUpperCase() || "•";
  const tile = (
    <span className={letterClassName} style={{ width: size, height: size }} aria-hidden="true">
      {letter}
    </span>
  );
  if (!src || status === "failed") return tile;
  return (
    <>
      {status === "loaded" ? null : tile}
      {/* A third-party icon of unknown size and host: next/image would need every host configured. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={className}
        data-tone={site?.faviconTone ?? undefined}
        style={status === "loaded" ? undefined : { display: "none" }}
        referrerPolicy="no-referrer"
        // Already loaded before React was listening (a data URL, or a server-rendered icon): count it.
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0 && status === "loading") setState({ src, status: "loaded" });
        }}
        onLoad={() => setState({ src, status: "loaded" })}
        onError={() => setState({ src, status: "failed" })}
      />
    </>
  );
}
