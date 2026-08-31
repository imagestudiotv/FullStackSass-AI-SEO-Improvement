/**
 * Brand voice types and constants.
 *
 * Kept apart from actions.ts because that file is "use server", which may only
 * export async functions — a plain const there fails the build with "A 'use
 * server' file can only export async functions, found object". Types are
 * erased at compile time so they were fine; the platform list was not.
 */

export type SocialLink = { platform: string; url: string };

export type BrandVoiceView = {
  tone: string | null;
  vocabulary: string | null;
  avoid: string | null;
  usps: string[];
  facts: string[];
  socialLinks: SocialLink[];
};

/** Platforms offered in the UI, ordered by how common they are for SMBs. */
export const SOCIAL_PLATFORMS = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "X",
] as const;
