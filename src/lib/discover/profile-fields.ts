import { blogSlug } from "@/lib/blog/shared";

/**
 * A business's showcase profile (client, 2026-11-11 round 2: the RepGet
 * Customer Showcase, /discover and /discover/<slug>). A profile is a
 * published Customer stories post whose Business section has an address
 * (lib/blog/business.ts has the name, logo, category, website and tagline;
 * these are the profile's other fields, edited in the same section).
 *
 * No server imports: the admin editor (a client component) reads the limits
 * and the address rule too. The server applies them on every save
 * (lib/blog/post-fields.ts cleanBusinessProfile).
 */

/** As the editor sends it: every field a string, empty for none; lists one entry per line. */
export type BusinessProfile = {
  /** The profile's address: /discover/<slug>. Empty: no profile (the post stays a story only). */
  slug: string;
  /** The chips above the name, one per line, e.g. "Photography". */
  tags: string;
  /** "Based in", e.g. "Rome and Milan, Italy". */
  location: string;
  /** "Available in", e.g. "Italy / Worldwide". */
  availability: string;
  /** "About": plain text, paragraphs separated by a blank line. Empty: the post's description. */
  about: string;
  /** "Who it's for": plain text. */
  audience: string;
  /** "Main services", one per line. */
  services: string;
  /** "Industry", e.g. "Photography, film and creative production". Empty: the business category. */
  industry: string;
};

export const EMPTY_PROFILE: BusinessProfile = {
  slug: "",
  tags: "",
  location: "",
  availability: "",
  about: "",
  audience: "",
  services: "",
  industry: "",
};

export const PROFILE_LIMITS = {
  slug: 60,
  tag: 40,
  tags: 6,
  location: 120,
  availability: 120,
  about: 2000,
  audience: 600,
  service: 80,
  services: 12,
  industry: 120,
} as const;

/** Addresses the directory itself could need one day; never a business's. */
export const RESERVED_DISCOVER_SLUGS = new Set(["page", "category", "search", "new"]);

/** A profile address from what was typed: lower-case letters, digits and hyphens ("Image Studio" -> "image-studio"). */
export function discoverSlug(raw: string): string {
  return blogSlug(String(raw ?? "")).slice(0, PROFILE_LIMITS.slug).replace(/-+$/, "");
}

/** True for an address as stored (what a /discover/<slug> request must look like). */
export function isDiscoverSlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= PROFILE_LIMITS.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** A one-per-line field as a list: each line trimmed and tidied, empty lines and repeats dropped. */
export function profileLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    const key = line.toLocaleLowerCase();
    if (!line || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** Plain text as paragraphs: split on blank lines, each paragraph's lines joined. */
export function profileParagraphs(text: string | null | undefined): string[] {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** The monogram a profile shows without a logo: the first letters of the name's first two words ("Image Studio" -> "IS"). */
export function monogram(name: string): string {
  const letters = String(name ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters ? letters.toLocaleUpperCase() : "•";
}

/** A website's address as a reader recognises it: "imagestudio.com" for https://www.imagestudio.com/. */
export function websiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
