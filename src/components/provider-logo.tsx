import { Puzzle } from "lucide-react";

import { PROVIDER_LOGOS } from "@/lib/publishing/logos";

/**
 * The brand mark for a publishing provider.
 *
 * IN ITS OWN TILE, not bare. The design puts each logo on a rounded square,
 * which does real work: the marks have wildly different silhouettes — Ghost
 * is a tall glyph, Shopify a wide bag, WordPress a circle — and set loose on
 * a card they sit at different optical weights and make the grid look
 * misaligned. A common tile gives them one footprint.
 *
 * FALLS BACK TO A PUZZLE PIECE rather than a broken image or an empty gap.
 * A provider can be registered without a mark here — the webhook has no
 * brand, and a new CMS may be added before anyone extracts its logo — and
 * the card still needs something in that slot.
 *
 * Rendered as inline SVG from a path string, so there is no image request and
 * nothing to 404. See lib/publishing/logos.ts for where the paths come from
 * and the licence they carry.
 */
export function ProviderLogo({
  providerId,
  className,
}: {
  providerId: string;
  className?: string;
}) {
  const logo = PROVIDER_LOGOS[providerId];

  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background ${className ?? ""}`}
    >
      {logo ? (
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          /*
            The official brand colour. A monochrome mark would read as
            disabled next to the coloured ones, and recolouring somebody's
            logo to fit our palette is the one thing a trademark owner
            reliably objects to.
          */
          fill={`#${logo.hex}`}
          role="img"
          aria-label={logo.title}
        >
          <path d={logo.path} />
        </svg>
      ) : (
        <Puzzle className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}
