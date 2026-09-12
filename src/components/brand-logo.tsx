import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The RepGet lockup.
 *
 * Replaces a placeholder that drew a rounded square reading "AI" beside the
 * words "SEO Platform" — hand-rolled in four places (marketing header and
 * footer, and again for each), so any change had to be made four times.
 *
 * Two files rather than a CSS filter: the wordmark is black and the mark is an
 * orange gradient, so inverting for the dark theme would invert both and turn
 * the mark blue. The light variant recolours only the near-black wordmark
 * pixels, which is why it is generated rather than computed at runtime.
 *
 * Both are hidden/shown by theme with CSS rather than picked in JavaScript:
 * reading the theme on the client would flash the wrong one on first paint,
 * and these sit in the header where that is most visible.
 */

/** Intrinsic size of the lockup files, for aspect ratio. */
const LOCKUP = { width: 2757, height: 690 };

export function BrandLogo({
  /** Rendered height in pixels; width follows the aspect ratio. */
  height = 24,
  /**
   * True on the page's primary logo, so the largest text on screen is not an
   * image's alt text. Exactly one per page.
   */
  priority = false,
  className,
}: {
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const width = Math.round((LOCKUP.width / LOCKUP.height) * height);

  return (
    <>
      <Image
        src="/images/repget-logo.png"
        alt="RepGet"
        width={width}
        height={height}
        priority={priority}
        className={cn("dark:hidden", className)}
        style={{ height, width: "auto" }}
      />
      <Image
        src="/images/repget-logo-light.png"
        alt="RepGet"
        width={width}
        height={height}
        priority={priority}
        // Hidden from assistive tech: the light copy is the same word, and
        // announcing "RepGet" twice is noise.
        aria-hidden="true"
        className={cn("hidden dark:block", className)}
        style={{ height, width: "auto" }}
      />
    </>
  );
}

/**
 * The mark on its own, for places too narrow for the wordmark.
 *
 * The same orange in both themes, so it needs no variant.
 */
export function BrandMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/repget-mark.png"
      alt="RepGet"
      width={size}
      height={size}
      className={className}
    />
  );
}
