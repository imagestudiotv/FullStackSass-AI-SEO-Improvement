/**
 * The brand kit on Earn Credits (client, 2026-11-26: "for earn credits to add
 * also graphics ready to post as logo, official repget video you have for
 * promotion, etc."): RepGet's own logo files, ready-to-post pictures and a
 * short promo video, for customers who post about RepGet (the "Post about
 * RepGet" way to earn, reviewed by the team). Static files in public/brand-kit;
 * nothing here is generated per customer. Pure data.
 */

export const BRAND_KIT_KINDS = ["logo", "post", "story", "video"] as const;
export type BrandKitKind = (typeof BRAND_KIT_KINDS)[number];

export type BrandKitItem = {
  /** Also the key of its words in EARN_BRAND_KIT_COPY.items. */
  id: string;
  kind: BrandKitKind;
  /** The file under public/, served as is and downloaded with this name. */
  file: string;
  /** The small picture shown in the card (a WebP copy, or a video's cover); the full file is only downloaded. */
  preview: string;
  width: number;
  height: number;
  /** A dark preview background, for the white logo. */
  dark?: boolean;
};

const BASE = "/brand-kit";

export const BRAND_KIT: readonly BrandKitItem[] = [
  // The owner's main promo (2026-11-27, already posted on RepGet's channels): one minute, compressed for the web (H.264 + AAC, under 8 MB).
  { id: "promoMain", kind: "video", file: `${BASE}/repget-promo-full.mp4`, preview: `${BASE}/repget-promo-full-cover.jpg`, width: 720, height: 1280 },
  { id: "promoVideo", kind: "video", file: `${BASE}/repget-promo.mp4`, preview: `${BASE}/repget-promo-cover.jpg`, width: 1080, height: 1920 },
  { id: "postAutopilot", kind: "post", file: `${BASE}/repget-post-autopilot.png`, preview: `${BASE}/thumbs/repget-post-autopilot.webp`, width: 1080, height: 1350 },
  { id: "postOneplace", kind: "post", file: `${BASE}/repget-post-one-place.png`, preview: `${BASE}/thumbs/repget-post-one-place.webp`, width: 1080, height: 1350 },
  { id: "storyAutopilot", kind: "story", file: `${BASE}/repget-story-autopilot.png`, preview: `${BASE}/thumbs/repget-story-autopilot.webp`, width: 1080, height: 1920 },
  { id: "storyTry", kind: "story", file: `${BASE}/repget-story-try.png`, preview: `${BASE}/thumbs/repget-story-try.webp`, width: 1080, height: 1920 },
  { id: "logoColor", kind: "logo", file: `${BASE}/repget-logo.png`, preview: `${BASE}/thumbs/repget-logo.webp`, width: 2757, height: 690 },
  { id: "logoWhite", kind: "logo", file: `${BASE}/repget-logo-white.png`, preview: `${BASE}/thumbs/repget-logo-white.webp`, width: 2757, height: 690, dark: true },
  { id: "logoIcon", kind: "logo", file: `${BASE}/repget-icon.png`, preview: `${BASE}/thumbs/repget-icon.webp`, width: 512, height: 512 },
];

/** The file name a download is saved under. */
export function brandKitFileName(item: Pick<BrandKitItem, "file">): string {
  return item.file.slice(item.file.lastIndexOf("/") + 1);
}
