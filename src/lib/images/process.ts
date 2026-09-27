import sharp, { type Metadata, type Sharp } from "sharp";

/**
 * Every GENERATED article image, made exactly 1280 x 720.
 *
 * WHY. The client asked for 1280 x 720 header images, and the two providers
 * disagreed: OpenAI was asked for 1024 x 1024 (a square), Replicate for 16:9
 * at whatever size it chose, returned as WebP while we labelled it PNG. So
 * the same site got squares and banners, and a mislabelled file.
 *
 * HOW. Providers are asked for a size they actually support, as wide as
 * they offer (openAiSize, below), and told to compose for a landscape crop.
 * What comes back is then processed here, deterministically:
 *
 *  - a source at least COVER_MIN_RATIO wide (3:2 and wider) is scaled to
 *    cover 1280 x 720 and CROPPED FROM THE CENTRE - at most a sixth of the
 *    height of a 3:2 image, which the prompt keeps free of the subject;
 *  - a narrower source (a square from a model that only makes squares) is
 *    not cropped to a sliver: the WHOLE image is fitted inside 1280 x 720,
 *    on a blurred, darkened fill made from itself. Nothing is stretched.
 *
 * The result is a JPEG (photographs, a fraction of a PNG's size, and a type
 * every CMS accepts), EXIF orientation applied and metadata stripped. Its
 * decoded dimensions are read back and checked before it is returned: a CSS
 * width proves nothing about the file.
 *
 * Only generated images go through this. A picture a customer uploads is
 * theirs, and is stored as they sent it.
 */

export const ARTICLE_IMAGE_WIDTH = 1280;
export const ARTICLE_IMAGE_HEIGHT = 720;
export const ARTICLE_IMAGE_TYPE = "image/jpeg";

/** Width / height at or above which a source is cropped rather than fitted. */
export const COVER_MIN_RATIO = 1.5;

/**
 * Decoded-pixel ceiling. The download is already capped in bytes; this caps
 * what those bytes may expand to (a small file can declare a huge canvas).
 */
const MAX_INPUT_PIXELS = 40_000_000;

/** Formats a provider may legitimately return. Anything else is refused. */
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

export type ArticleImage = {
  data: Buffer;
  contentType: typeof ARTICLE_IMAGE_TYPE;
  width: typeof ARTICLE_IMAGE_WIDTH;
  height: typeof ARTICLE_IMAGE_HEIGHT;
};

/**
 * The OpenAI size to request for a model: the widest landscape size that
 * model documents, or the square every image model supports.
 *
 *   gpt-image-*  1536x1024 (3:2)
 *   dall-e-3     1792x1024 (7:4)
 *   anything else (dall-e-2, unknown) 1024x1024
 *
 * Never an arbitrary size: an unsupported one fails inside the article job.
 */
export function openAiSize(model: string): "1536x1024" | "1792x1024" | "1024x1024" {
  const id = model.trim().toLowerCase();
  if (id.startsWith("gpt-image")) return "1536x1024";
  if (id.startsWith("dall-e-3")) return "1792x1024";
  return "1024x1024";
}

/** What the prompt asks of the composition, so the centre crop loses nothing. */
export const LANDSCAPE_COMPOSITION =
  "Wide landscape composition: keep the main subject centred, with space above and below it.";

async function decodedSize(input: Buffer): Promise<{ width: number; height: number; format: string }> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch (error) {
    throw new ImageProcessingError(
      `The image could not be decoded: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageProcessingError(`Unsupported image format: ${meta.format ?? "unknown"}`);
  }
  if (!meta.width || !meta.height) throw new ImageProcessingError("The image has no dimensions");
  // Orientations 5-8 are rotated a quarter turn: width and height swap once applied.
  const swapped = (meta.orientation ?? 1) >= 5;
  return {
    width: swapped ? meta.height : meta.width,
    height: swapped ? meta.width : meta.height,
    format: meta.format,
  };
}

/** Converts any accepted image into the 1280 x 720 article image. */
export async function toArticleImage(input: Buffer): Promise<ArticleImage> {
  const source = await decodedSize(input);
  const open = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
  const W = ARTICLE_IMAGE_WIDTH;
  const H = ARTICLE_IMAGE_HEIGHT;

  let pipeline: Sharp;
  if (source.width / source.height >= COVER_MIN_RATIO) {
    pipeline = open().resize(W, H, { fit: "cover", position: "centre" });
  } else {
    const fill = await open()
      .resize(W, H, { fit: "cover", position: "centre" })
      .blur(30)
      .modulate({ brightness: 0.7 })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();
    const subject = await open()
      .resize(W, H, { fit: "inside", withoutEnlargement: false })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    pipeline = sharp(fill).composite([{ input: subject, gravity: "centre" }]);
  }

  const data = await pipeline
    // JPEG has no transparency: a transparent source goes on white, not black.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  const check = await sharp(data).metadata();
  if (check.width !== W || check.height !== H || check.format !== "jpeg") {
    throw new ImageProcessingError(
      `Processed image is ${check.width}x${check.height} ${check.format}, not ${W}x${H} jpeg`,
    );
  }
  return { data, contentType: ARTICLE_IMAGE_TYPE, width: W, height: H };
}
