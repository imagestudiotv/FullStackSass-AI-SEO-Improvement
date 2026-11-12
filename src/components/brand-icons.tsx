import type { ReactElement } from "react";

/**
 * Small platform marks for the public site: the homepage's floating cards,
 * logo ribbon and Copilot strip, and the header's Integrations menu (client's
 * design, 2026-11-03).
 *
 * Simplified single-colour drawings in `currentColor`, so the surrounding
 * tile picks the brand colour (and its dark-mode variant) in CSS. Decorative:
 * every use puts the platform's NAME beside or on the tile, so these are
 * aria-hidden and never the only label.
 *
 * Only platforms RepGet actually publishes to or reads from. The design also
 * drew LinkedIn and Google Business Profile, which the product does not
 * connect to (lib/social/platforms.ts, lib/video/formats.ts), so they are not
 * here: an integrations menu is a list of promises.
 */
export type BrandIconName =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "threads"
  | "pinterest"
  | "bluesky"
  | "reddit"
  | "quora"
  | "wordpress"
  | "shopify"
  | "webflow"
  | "wix"
  | "ghost"
  | "webhook"
  | "searchconsole"
  | "analytics"
  | "google"
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "claude"
  | "spark"
  | "globe"
  | "link"
  | "file"
  | "brain";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PATHS: Record<BrandIconName, ReactElement> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" {...S} strokeWidth="2" />
      <circle cx="12" cy="12" r="4" {...S} strokeWidth="2" />
      <circle cx="17.6" cy="6.7" r="1.25" fill="currentColor" />
    </>
  ),
  facebook: <path fill="currentColor" d="M14.8 22V13h3l.5-4H14.8V6.6c0-1.2.4-2 2.2-2h1.5V1.1a21 21 0 0 0-2.5-.1C12 1 10 3.2 10 6.3V9H7v4h3v9h4.8Z" />,
  linkedin: <path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.06c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.86 2.6 4.86 6V21h-4v-5.1c0-1.22-.02-2.8-1.7-2.8-1.72 0-1.98 1.33-1.98 2.7V21h-4V9.75Z" />,
  tiktok: <path fill="currentColor" d="M15 3.4c.4 2.7 2.2 4.4 5 4.8v3.5c-1.9-.1-3.6-.7-5-1.8v5.9a6.2 6.2 0 1 1-6.2-6.2v3.6a2.6 2.6 0 1 0 2.6 2.6V2h3.6v1.4Z" />,
  youtube: (
    <>
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="currentColor" />
      <path d="m10 8.5 6 3.5-6 3.5v-7Z" fill="#fff" />
    </>
  ),
  x: <path fill="currentColor" d="M18.9 2h3.2L15 10.2 23 22h-6.6l-5.3-7.3L4.7 22H1.5l7.9-9L1.5 2h6.7l4.8 6.7L18.9 2Zm-1.2 18h1.8L7.2 3.9H5.3Z" />,
  threads: (
    <path
      {...S}
      strokeWidth="1.8"
      d="M16.6 8.6c-.7-1.9-2.3-2.8-4.3-2.8-3.4 0-5.5 2.6-5.5 6.2 0 3.8 2.2 6.2 5.9 6.2 3.3 0 5.6-2.1 5.6-5.2 0-2.2-1.4-3.5-3.6-3.5-2.5 0-3.9 1.3-3.9 2.9 0 1.3.9 2 2.2 2 1.9 0 3-1.5 3-4 0-4.4-2.7-7-7.2-7C4.7 3.4 2 6.8 2 12c0 5 3 8.6 8.6 8.6 3.3 0 5.6-1.2 7-3.3"
    />
  ),
  pinterest: <path fill="currentColor" d="M12.2 2C6.6 2 3.3 6 3.3 10.4c0 2.8 1.2 5 3.6 5.9.4.1.6 0 .7-.4l.3-1.3c.1-.4 0-.5-.3-.8-.7-.8-1.1-1.8-1.1-3.2 0-4 2.8-7.1 6.8-7.1 3.4 0 5.3 2.1 5.3 4.9 0 3.7-1.6 6.7-3.9 6.7-1.3 0-2.3-1.1-1.9-2.5.4-1.7 1.2-3.6 1.2-4.8 0-1.1-.6-2.1-1.8-2.1-1.4 0-2.6 1.5-2.6 3.4 0 1.2.4 2 .4 2L8.3 22h2l1.6-5.8c.6 1 1.9 1.9 3.5 1.9 4.6 0 7.5-4.2 7.5-8.6C22.9 4.6 19 2 12.2 2Z" />,
  bluesky: <path fill="currentColor" d="M12 10.8C9.4 7.4 5.5 3.8 3.2 5.4c-2.4 1.7 0 6.7 1.8 8.2 1.2 1 3.5 1.5 5 1.3-4.6.8-5.7 3.3-3 5.7 2.4 1.8 4.4-.4 5.2-2.1.8 1.7 2.8 3.9 5.2 2.1 2.7-2.4 1.6-4.9-3-5.7 1.5.2 3.8-.3 5-1.3 1.8-1.5 4.2-6.5 1.8-8.2-2.3-1.6-6.2 2-8.8 5.4Z" />,
  reddit: (
    <>
      <circle cx="12" cy="13.5" r="8" fill="currentColor" />
      <circle cx="8.6" cy="12.8" r="1.2" fill="#fff" />
      <circle cx="15.4" cy="12.8" r="1.2" fill="#fff" />
      <path d="M8.3 16.3c2.2 1.5 5.2 1.5 7.4 0" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="17.5" cy="4.5" r="1.7" fill="currentColor" />
    </>
  ),
  quora: <path fill="currentColor" d="M12 2.5a8.8 8.8 0 0 0-1.4 17.5c.4.7 1 1.6 1.9 2.2 1.4.9 3.2.8 4.4-.4l-.9-1c-.6.5-1.4.6-2 .3a8.8 8.8 0 0 0-2-18.6Zm0 2.4a6.4 6.4 0 0 1 2.2 12.4c-.7-1-1.6-1.9-3.1-1.9-.7 0-1.2.1-1.6.4l.6 1c.3-.2.6-.2 1-.2.8 0 1.3.6 1.8 1.2A6.4 6.4 0 0 1 12 4.9Z" />,
  wordpress: (
    <>
      <circle cx="12" cy="12" r="9.2" {...S} strokeWidth="1.6" />
      <path fill="currentColor" d="m6.2 8.6 3.4 9.4 1.9-5.5-1.4-3.9H8.9V7.8h4.6v.8h-1.2l2.9 8.4 1.5-4.6c.4-1.2.1-2.2-.6-3l.8-.6c1.3 1.2 1.6 2.7 1 4.4l-2.8 7.9h-1l-2.2-6.3-2.1 6.3H8.8L5.1 8.6H6.2Z" />
    </>
  ),
  shopify: (
    <>
      <path fill="currentColor" d="M5 7.4 18.4 5l2 15.6-14.8 1.6L5 7.4Z" />
      <path d="M13.9 10.4c-.7-.4-2.4-.3-2.4.9 0 1.4 2.9 1.1 2.9 3 0 1.8-2.2 2.2-3.5 1.4" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M9 7c.2-2.6 1.3-4.3 2.6-4.3 1.4 0 2.2 1.8 2.2 4" {...S} strokeWidth="1.3" />
    </>
  ),
  webflow: <path fill="currentColor" d="M22 5 14 19H6.5l3.6-6.2H10a9 9 0 0 1-7.5 4.3L8.7 5H16l-3.2 6h.1a8.6 8.6 0 0 0 4.6-6H22Z" />,
  wix: <path fill="currentColor" d="M4.6 8.4 2 15.6h2.2l1.5-4.6 1.4 4.6h2.2L6.7 8.4H4.6Zm5.6 0v7.2h2V8.4h-2Zm3.6 0 2.4 3.5-2.5 3.7h2.4l1.3-2.1 1.3 2.1H21l-2.5-3.7 2.4-3.5h-2.3l-1.2 1.9-1.2-1.9h-2.4Z" />,
  ghost: (
    <>
      <path fill="currentColor" d="M5 19V9.7a7 7 0 0 1 14 0V19l-3.2-1.7-3.7 1.8-3.6-1.8L5 19Z" />
      <circle cx="10" cy="10.7" r="1.1" fill="#fff" />
      <circle cx="14.6" cy="10.7" r="1.1" fill="#fff" />
    </>
  ),
  webhook: (
    <path
      {...S}
      strokeWidth="1.6"
      d="M9.2 5.2a4.6 4.6 0 0 1 7.4 4.6l-2.4 4M14.8 18.8a4.6 4.6 0 0 1-1.1-9M6.9 16.5a4.6 4.6 0 0 1 3.8-7.2l4.6.1M10.7 9.3l-3.8 7.2M17.1 16.6H13"
    />
  ),
  searchconsole: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" {...S} strokeWidth="1.7" />
      <path {...S} strokeWidth="1.7" d="M7 16v-3l3-3 3 2 4-5" />
    </>
  ),
  analytics: (
    <>
      <rect x="3" y="13" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="10" y="8" width="4" height="13" rx="2" fill="currentColor" />
      <rect x="17" y="3" width="4" height="18" rx="2" fill="currentColor" />
    </>
  ),
  google: (
    <>
      <path fill="#4285f4" d="M21.3 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.2c-.2 1.1-.9 2.1-1.9 2.9v2.5h3.2c1.8-1.7 2.8-4.2 2.8-7.2z" />
      <path fill="#34a853" d="M12 21.5c2.6 0 4.9-.9 6.5-2.4l-3.2-2.4c-.9.6-2 .9-3.3.9-2.6 0-4.8-1.8-5.6-4.1H3.2V16A9.8 9.8 0 0 0 12 21.5z" />
      <path fill="#fbbc05" d="M6.4 13.5a6 6 0 0 1 0-4V7H3.2a9.8 9.8 0 0 0 0 9z" />
      <path fill="#ea4335" d="M12 5.9c1.4 0 2.7.5 3.7 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a9.9 9.9 0 0 0-8.8 5l3.2 2.5C7.2 7.2 9.4 5.9 12 5.9z" />
    </>
  ),
  chatgpt: (
    <path
      {...S}
      strokeWidth="1.5"
      d="M12 3.2a4 4 0 0 1 4.5 2.3 4 4 0 0 1 3.6 5.1 4 4 0 0 1-1.4 6.2A4 4 0 0 1 13 19.9a4 4 0 0 1-6.3-.7 4 4 0 0 1-3-5.6A4 4 0 0 1 5.6 7a4 4 0 0 1 6.4-3.8ZM9 9.5l3-1.7 3 1.7v3.4l-3 1.7-3-1.7Z"
    />
  ),
  gemini: <path fill="currentColor" d="M12 2c.4 5.4 4.6 9.6 10 10-5.4.4-9.6 4.6-10 10-.4-5.4-4.6-9.6-10-10 5.4-.4 9.6-4.6 10-10Z" />,
  perplexity: (
    <path
      {...S}
      strokeWidth="1.6"
      d="M12 2v20M5 6l7 6 7-6M5 6v6h14V6M5 12l7 6 7-6M5 12v6h3M19 12v6h-3"
    />
  ),
  claude: (
    <path
      {...S}
      strokeWidth="1.8"
      d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"
    />
  ),
  spark: <path fill="currentColor" d="m12 1.5 1.8 6.7 6.7 1.8-6.7 1.8-1.8 6.7-1.8-6.7-6.7-1.8 6.7-1.8L12 1.5ZM19 16l.9 2.5 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9L19 16Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" {...S} strokeWidth="1.7" />
      <path {...S} strokeWidth="1.4" d="M3 12h18M12 3c-5 5.5-5 12.5 0 18M12 3c5 5.5 5 12.5 0 18" />
    </>
  ),
  link: <path {...S} strokeWidth="2" d="M10 7h-2a5 5 0 0 0 0 10h3m2-10h3a5 5 0 0 1 0 10h-2M8.5 12h7" />,
  file: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" {...S} strokeWidth="1.7" />
      <path {...S} strokeWidth="1.7" d="M8 9h8m-8 4h8m-8 4h5" />
    </>
  ),
  brain: (
    <path
      {...S}
      strokeWidth="1.5"
      d="M12 19V6a4 4 0 0 0-7.1-2.6A4 4 0 0 0 3 10a4 4 0 0 0 1 6.5 4 4 0 0 0 8 2.5Zm0 0V6a4 4 0 0 1 7.1-2.6A4 4 0 0 1 21 10a4 4 0 0 1-1 6.5 4 4 0 0 1-8 2.5Z"
    />
  ),
};

/** Display names, for the label beside each mark. Product names: never translated. */
export const BRAND_NAMES: Record<BrandIconName, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  reddit: "Reddit",
  quora: "Quora",
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
  wix: "Wix",
  ghost: "Ghost",
  webhook: "Webhooks",
  searchconsole: "Search Console",
  analytics: "Google Analytics",
  google: "Google",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
  spark: "",
  globe: "",
  link: "",
  file: "",
  brain: "",
};

export function BrandIcon({ name, className }: { name: BrandIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
