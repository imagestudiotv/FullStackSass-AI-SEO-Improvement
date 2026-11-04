import type { ReactElement, SVGProps } from "react";

/**
 * The header's and footer's drawings, exactly as the client's design draws
 * them (RepGet homepage design, 2026-11-03: the `ic-*`, `rgf-icon-*` and
 * `rgint-i-*` sprites). Inline rather than a sprite, so a menu that moves
 * between the bar and the phone drawer keeps its icons.
 *
 * All decorative: every use sits beside its own text, so they are
 * aria-hidden.
 */

type Props = SVGProps<SVGSVGElement>;

const svg = (children: ReactElement, viewBox = "0 0 24 24") =>
  function Icon(props: Props) {
    return (
      <svg viewBox={viewBox} aria-hidden="true" focusable="false" {...props}>
        {children}
      </svg>
    );
  };

/* The bar (design `ic-*`): stroke and width come from the caller, as in the design. */
export const ChevronIcon = svg(<path d="m6 9 6 6 6-6" />);
export const ArrowUpRightIcon = svg(<path d="M5 18 18 5M9 5h9v9" />);
export const MoonIcon = svg(<path d="M20.2 14A8.5 8.5 0 0 1 10 3.8 8.6 8.6 0 1 0 20.2 14Z" />);
export const SunIcon = svg(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.4 1.4m11.34 11.34 1.4 1.4M2 12h2m16 0h2M4.93 19.07l1.4-1.4M17.67 6.33l1.4-1.4" />
  </>,
);
export const BarsIcon = svg(<path d="M4 7h16M4 12h16M4 17h16" />);
export const CloseIcon = svg(<path d="M5 5l14 14M19 5 5 19" />);

/* The Features menu (design `rgf-icon-*`), drawn with the `.rgf-svg` stroke. */
export type FeatureIconName = "content" | "social" | "seo" | "backlinks" | "ai" | "growth" | "arrow";
const FEATURE_PATHS: Record<FeatureIconName, ReactElement> = {
  content: (
    <>
      <rect height="18" rx="2.5" width="14" x="5" y="3" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" />
    </>
  ),
  social: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.5 10.7 7-4.5m-7 7.1 7 4.5" />
    </>
  ),
  seo: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5M8 10.5l1.7 1.7 3.4-3.4" />
    </>
  ),
  backlinks: <path d="M9.5 14.5 14.5 9.5M9 7.5H7a4.5 4.5 0 0 0 0 9h3m5-9h2a4.5 4.5 0 0 1 0 9h-3" />,
  ai: <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z" />,
  growth: (
    <>
      <path d="m3 17 6-6 4 3 7-8M15 6h5v5" />
      <path d="M3 21h18" />
    </>
  ),
  arrow: <path d="M4.5 12h15m-5.5-5.5 5.5 5.5-5.5 5.5" />,
};

export function FeatureIcon({ name, ...props }: Props & { name: FeatureIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {FEATURE_PATHS[name]}
    </svg>
  );
}

/* The Integrations menu (design `rgint-i-*`): full-colour marks on brand tiles. */
export type ChannelIconName =
  | "ig"
  | "fb"
  | "tiktok"
  | "linkedin"
  | "x"
  | "youtube"
  | "threads"
  | "pinterest"
  | "gbp"
  | "bluesky"
  | "reddit"
  | "quora"
  | "wordpress"
  | "shopify"
  | "webflow"
  | "wix"
  | "ghost"
  | "webhook"
  | "gsc"
  | "analytics"
  | "spark"
  | "arrow";

const C = "currentColor";
const CHANNEL_PATHS: Record<ChannelIconName, ReactElement> = {
  ig: (
    <>
      <rect fill="none" height="18" rx="5" stroke={C} strokeWidth="2" width="18" x="3" y="3" />
      <circle cx="12" cy="12" fill="none" r="4" stroke={C} strokeWidth="2" />
      <circle cx="17.6" cy="6.7" fill={C} r="1.25" />
    </>
  ),
  fb: <path d="M14.8 22V13h3l.5-4H14.8V6.6c0-1.2.4-2 2.2-2h1.5V1.1a21 21 0 0 0-2.5-.1C12 1 10 3.2 10 6.3V9H7v4h3v9h4.8Z" fill={C} />,
  tiktok: (
    <>
      <path d="M15 3.4c.4 2.7 2.2 4.4 5 4.8v3.5c-1.9-.1-3.6-.7-5-1.8v5.9a6.2 6.2 0 1 1-6.2-6.2v3.6a2.6 2.6 0 1 0 2.6 2.6V2h3.6v1.4Z" fill={C} />
      <path d="M15 4.2v6m-5-1.1v4" fill="none" stroke="#fe2c55" strokeWidth=".8" />
    </>
  ),
  linkedin: (
    <path
      d="M4.3 2.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM2.4 9h3.8v12.5H2.4zM8.5 9h3.6v1.7h.1a4.1 4.1 0 0 1 3.6-2c3.8 0 4.5 2.5 4.5 5.8v7h-3.8v-6.2c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2v6.3H8.5V9z"
      fill={C}
    />
  ),
  x: <path d="M3 2h4.2L21 22h-4.2L3 2Zm17.3 0L3.7 22" fill="none" stroke={C} strokeLinecap="round" strokeWidth="2.25" />,
  youtube: <path d="m9 6.8 9 5.2-9 5.2V6.8Z" fill={C} />,
  threads: (
    <path
      d="M16.8 9c-.8-2.1-2.5-3.1-4.7-3.1-3.9 0-6.2 2.9-6.2 6.4 0 4.3 2.4 6.5 6.6 6.5 4 0 6.5-2.5 6.5-6.2 0-2.4-1.6-4-4.1-4-2.8 0-4.5 1.5-4.5 3.3 0 1.5 1 2.3 2.5 2.3 2.1 0 3.4-1.7 3.4-4.6 0-5.1-3-8.1-8.3-8.1-5.5 0-9.2 3.7-9.2 9.3 0 5.5 3.4 9.1 9.4 9.1 6 0 9.3-3.8 9.3-8.6"
      fill="none"
      stroke={C}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.55"
      transform="translate(1.5 -1.2) scale(.86)"
    />
  ),
  pinterest: (
    <path
      d="M12.3 2C6.5 2 3 6.2 3 11.1c0 3 1.3 5.4 3.8 6.4.4.1.7 0 .8-.4l.3-1.4c.1-.4 0-.5-.3-.9-.7-.8-1.2-1.9-1.2-3.4 0-4.3 3-7.6 7.2-7.6 3.6 0 5.6 2.2 5.6 5.2 0 3.9-1.7 7.1-4.1 7.1-1.4 0-2.4-1.2-2-2.7.4-1.8 1.3-3.8 1.3-5.1 0-1.2-.6-2.2-1.9-2.2-1.5 0-2.7 1.5-2.7 3.6 0 1.3.4 2.1.4 2.1L7.7 22h2.1l1.7-6.1c.6 1.1 2 2 3.7 2 4.9 0 8-4.5 8-9.1C23.2 4.9 19 2 12.3 2Z"
      fill={C}
      transform="translate(1.1 0) scale(.91)"
    />
  ),
  gbp: (
    <>
      <path d="M3 11.5V20h18v-8.5" fill="none" stroke="#4285f4" strokeLinejoin="round" strokeWidth="2" />
      <path d="M5 3h14l2 7H3l2-7" fill="#4285f4" />
      <path d="M3 10h4.5c0 2.3-1 3.2-2.2 3.2S3 12.3 3 10Z" fill="#4285f4" />
      <path d="M7.5 10H12c0 2.3-1 3.2-2.3 3.2S7.5 12.3 7.5 10Z" fill="#ea4335" />
      <path d="M12 10h4.5c0 2.3-1 3.2-2.3 3.2S12 12.3 12 10Z" fill="#fbbc04" />
      <path d="M16.5 10H21c0 2.3-1 3.2-2.3 3.2s-2.2-.9-2.2-3.2Z" fill="#34a853" />
      <path d="M9 20v-5h6v5" fill="none" stroke="#4285f4" strokeWidth="1.4" />
    </>
  ),
  bluesky: (
    <path
      d="M12 10.8C9.4 7.4 5.5 3.8 3.2 5.4c-2.4 1.7 0 6.7 1.8 8.2 1.2 1 3.5 1.5 5 1.3-4.6.8-5.7 3.3-3 5.7 2.4 1.8 4.4-.4 5.2-2.1.8 1.7 2.8 3.9 5.2 2.1 2.7-2.4 1.6-4.9-3-5.7 1.5.2 3.8-.3 5-1.3 1.8-1.5 4.2-6.5 1.8-8.2-2.3-1.6-6.2 2-8.8 5.4Z"
      fill={C}
    />
  ),
  reddit: (
    <>
      <path
        d="M17.5 9.3c1-.6 2.1-.4 2.8.3a2 2 0 0 1-.5 3.2c.1.4.2.8.2 1.2 0 3-3.5 5.4-8 5.4s-8-2.4-8-5.4c0-.4.1-.8.2-1.2a2 2 0 0 1-.5-3.2c.7-.7 1.8-.9 2.8-.3 1.5-.9 3.5-1.4 5.5-1.4l1-4.6 3.1.7"
        fill="none"
        stroke={C}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="16.9" cy="4.7" fill={C} r="1.8" />
      <circle cx="8.5" cy="13.4" fill={C} r="1.2" />
      <circle cx="15.5" cy="13.4" fill={C} r="1.2" />
      <path d="M9.3 16.2c1.7 1.2 3.7 1.2 5.4 0" fill="none" stroke={C} strokeLinecap="round" strokeWidth="1.4" />
    </>
  ),
  quora: (
    <text fill={C} fontFamily="Georgia,serif" fontSize="23" fontWeight="bold" textAnchor="middle" x="12" y="19.1">
      Q
    </text>
  ),
  wordpress: (
    <>
      <circle cx="12" cy="12" fill="none" r="10" stroke={C} strokeWidth="1.4" />
      <text fill={C} fontFamily="Georgia,serif" fontSize="14" fontWeight="bold" textAnchor="middle" x="12" y="17.4">
        W
      </text>
    </>
  ),
  shopify: (
    <>
      <path d="m4 5 15-2 2 17-16 2L4 5Z" fill={C} />
      <path
        d="M8.5 6c.2-2.4 1.2-4 2.4-4 1.4 0 2.2 1.7 2.1 4.7M10.7 6c.2-2.5 1.4-4.4 2.6-4.4 1.2 0 1.9 1.6 2 4.5"
        fill="none"
        stroke={C}
        strokeWidth="1.15"
      />
      <text fill="#fff" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="bold" textAnchor="middle" x="12.6" y="17">
        S
      </text>
    </>
  ),
  webflow: <path d="M22 5 14 19H6.5l3.6-6.2H10a9 9 0 0 1-7.5 4.3L8.7 5H16l-3.2 6h.1a8.6 8.6 0 0 0 4.6-6H22Z" fill={C} />,
  wix: (
    <text fill={C} fontFamily="Arial,sans-serif" fontSize="11" fontWeight="900" letterSpacing="-.8" textAnchor="middle" x="12" y="16.6">
      WIX
    </text>
  ),
  ghost: (
    <>
      <path d="M5 19V9.7a7 7 0 0 1 14 0V19l-3.2-1.7-3.7 1.8-3.6-1.8L5 19Z" fill={C} />
      <circle cx="10" cy="10.7" fill="#fff" r="1.1" />
      <circle cx="14.6" cy="10.7" fill="#fff" r="1.1" />
    </>
  ),
  webhook: (
    <path
      d="M9 5a5 5 0 0 1 8.8 3.2M17.8 8.2l-2.3-1.1m2.3 1.1 1.1-2.5M19.3 13a5 5 0 0 1-5.7 6.9M13.6 19.9l.9-2.3m-.9 2.3 2.5 1M7 18a5 5 0 0 1-3.5-8.5M3.5 9.5l2.5 1m-2.5-1-.8 2.5M9 12.2l3-5.2 3 5.2h-6Zm0 0-3 5.2h6l3-5.2H9Z"
      fill="none"
      stroke={C}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.45"
    />
  ),
  gsc: (
    <>
      <rect fill="none" height="16" rx="3" stroke={C} strokeWidth="1.6" width="16" x="4" y="4" />
      <path d="M7 16v-3l3-3 3 2 4-5" fill="none" stroke={C} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </>
  ),
  analytics: (
    <>
      <rect fill={C} height="8" rx="2" width="4" x="2.8" y="13" />
      <rect fill={C} height="13" rx="2" width="4" x="9.6" y="8" />
      <rect fill={C} height="18" rx="2" width="4" x="16.4" y="3" />
    </>
  ),
  spark: (
    <path
      d="m12 1.5 1.8 6.7 6.7 1.8-6.7 1.8-1.8 6.7-1.8-6.7-6.7-1.8 6.7-1.8L12 1.5ZM19 16l.9 2.5 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9L19 16Z"
      fill={C}
    />
  ),
  arrow: <path d="M4 12h16m-7-7 7 7-7 7" fill="none" stroke={C} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />,
};

export function ChannelIcon({ name, ...props }: Props & { name: ChannelIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {CHANNEL_PATHS[name]}
    </svg>
  );
}
