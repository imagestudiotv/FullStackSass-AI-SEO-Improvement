/**
 * Readable file names for the pictures RepGet puts in a customer's media
 * library (client, 2026-10-16: "Images uploaded from repget platform are not
 * having friendly url"). The WordPress plugin used to keep RepGet's storage
 * name, "1791986572090-96wum8.jpg"; a picture is now named after what it
 * shows, "director-coordinating-a-music-video-shoot.jpg".
 *
 * Mirrors repget_image_name() in the WordPress plugin (1.8.0), so a picture
 * gets the same name whichever way the article travels.
 */

/** Longest name, before the extension. */
export const IMAGE_NAME_MAX = 60;

/** Letters NFKD leaves whole, spelled the way WordPress's remove_accents() spells them. */
const SPELLED: Record<string, string> = {
  ß: "ss", æ: "ae", Æ: "AE", ø: "o", Ø: "O", œ: "oe", Œ: "OE",
  đ: "d", Đ: "D", ł: "l", Ł: "L", þ: "th", Þ: "TH", ð: "d", Ð: "D",
};

function nameFrom(text: string): string {
  const ascii = text
    .replace(/[ßæÆøØœŒđĐłŁþÞðÐ]/g, (letter) => SPELLED[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  let name = ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (name.length > IMAGE_NAME_MAX) {
    // Cut between words: the last hyphen within the limit, or at the limit for one long word.
    const cut = name.slice(0, IMAGE_NAME_MAX + 1);
    const at = cut.lastIndexOf("-");
    name = (at > 0 ? cut.slice(0, at) : name.slice(0, IMAGE_NAME_MAX)).replace(/-+$/g, "");
  }
  return name;
}

/**
 * A picture's file name, without its extension: from what it shows (its alt
 * text), else `fallback` (the article's slug, with the picture's place in the
 * article), else "image". Lower case, words joined by hyphens, no accents, at
 * most IMAGE_NAME_MAX characters. A name of digits only says nothing, so it
 * falls back too.
 */
export function imageFileName(text: string | null | undefined, fallback: string | null | undefined): string {
  const name = nameFrom(text ?? "");
  if (name && !/^[0-9-]+$/.test(name)) return name;
  return nameFrom(fallback ?? "") || "image";
}

/** The file extension for a picture's content type. */
export function imageExtension(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "png";
}
