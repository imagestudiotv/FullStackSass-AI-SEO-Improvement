/**
 * The choices offered on the Article Settings screen.
 *
 * Pure data, no database import, so the client bundle can read it: the form
 * renders these and the writer prompt reads the same ids, which is what stops
 * a style existing in the dropdown that the generator has never heard of.
 */

export type Option = {
  id: string;
  label: string;
  /** One line under the label, explaining what picking it does. */
  hint: string;
};

/**
 * Editorial register.
 *
 * Each hint describes the WRITING, not the reader — "precise editorial tone
 * with balanced caveats" tells someone what they will get back, where
 * "for professionals" only tells them who it is supposedly for.
 */
export const ARTICLE_STYLES: Option[] = [
  {
    id: "expert",
    label: "Expert",
    hint: "Precise editorial tone with balanced caveats and terminology.",
  },
  {
    id: "conversational",
    label: "Conversational",
    hint: "Plain, direct sentences. Explains terms the first time they appear.",
  },
  {
    id: "friendly",
    label: "Friendly",
    hint: "Warm and encouraging, second person, light on jargon.",
  },
  {
    id: "journalistic",
    label: "Journalistic",
    hint: "Leads with the finding, attributes claims, no marketing language.",
  },
];

/**
 * The image styles offered, by stored id.
 *
 * ONE IMAGE PER ARTICLE. `image_style` (these ids) decides the style of the
 * single image generated for each article - the header image, which the CMS
 * also uses as the featured image. No images are generated inside the body.
 *
 * Labels and hints live in the dictionary (messages.ts, app.article
 * .bodyImageStyles / coverImageStyles) so every language gets them. The ids
 * are stored values and name the example files in public/style-samples, so
 * they never change.
 */
export const IMAGE_STYLE_IDS = [
  "sketch",
  "watercolour",
  "realistic",
  "illustration",
  "brand-text",
] as const;

/**
 * The cover ("featured image") style ids. "match" follows the image style.
 *
 * STORED, NOT YET USED BY GENERATION: featured_image_style is saved, but the
 * generator reads only image_style, so the one image an article gets (which is
 * also its cover) is always in the image style. The screen says so.
 */
export const FEATURED_IMAGE_STYLE_IDS = [
  "sketch",
  "watercolour",
  "illustration",
  "match",
] as const;

/** Default when a customer has not chosen, mirroring the column defaults. */
export const DEFAULT_ARTICLE_STYLE = "expert";
export const DEFAULT_IMAGE_STYLE = "realistic";
export const DEFAULT_FEATURED_IMAGE_STYLE = "sketch";

export function styleHint(id: string): string {
  return ARTICLE_STYLES.find((s) => s.id === id)?.hint ?? "";
}

/**
 * The image-model wording each style stands for.
 *
 * SEPARATE FROM the hint shown in the UI. The hint tells a customer what they
 * are picking ("Hand-drawn line work"); this is what the generator is
 * actually told. Keeping both beside each other is what stops the card
 * promising a look the prompt never asks for — which is exactly what happened
 * while imageStyle existed as a column and buildPrompt hardcoded "realistic"
 * for everybody.
 */
export const IMAGE_STYLE_PROMPTS: Record<string, string> = {
  /*
    COLOURED, not a pencil drawing. "Monochrome" produced a grey graphite
    sketch; the reference is an illustration with sketchy linework over warm
    colour, which is a different thing wearing the same word.
  */
  sketch:
    "Coloured sketch illustration with loose hand-drawn linework over soft warm colour, textured paper feel, editorial.",
  /*
    VIVID, not pale. "Muted palette" and "bleeding edges" gave washed-out
    beige; the reference has real pigment in it.
  */
  watercolour:
    "Vivid watercolour illustration with saturated pigment and visible brush strokes, clear colour, white paper showing through.",
  realistic:
    "Clean professional photograph, natural lighting, editorial style.",
  illustration:
    "Flat vector illustration, bold simple shapes, limited palette, no gradients.",
  /*
    A PHOTOGRAPH with a graphic panel over it, which is what the reference
    shows. The previous wording — "bold graphic composition, poster-like" —
    produced a monochrome illustration, losing the photo half entirely.

    The no-text rule still applies to the image itself (image models render
    words as convincing gibberish). NOTHING sets a headline into or over the
    picture, and the stored brand colour is not passed to the model, so the
    panel colour is the model's choice. The screen describes this style as
    exactly that: a photo with a bold colour panel along one edge.
  */
  "brand-text":
    "Clean professional photograph with a bold flat colour panel overlaid along one edge in the brand colours, leaving clear empty space in that panel.",
};

/** The wording for a style id, falling back to photography. */
export function imageStylePrompt(id: string | null | undefined): string {
  return (
    (id && IMAGE_STYLE_PROMPTS[id]) ?? IMAGE_STYLE_PROMPTS.realistic
  );
}
