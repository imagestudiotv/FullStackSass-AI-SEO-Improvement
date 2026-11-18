import {
  HOOK_TECHNIQUES,
  HOOK_TECHNIQUES_FROM,
  VIRAL_TECHNIQUES,
  hookTypeOf,
  isHookTechnique,
  type CreativeDirection,
  type HookType,
  type VideoFormat,
  type ViralTechnique,
} from "../formats";

/**
 * Visual hooks (client, 2026-11-18; formats.ts HOOK_TECHNIQUES): which ideas
 * get one, and the stock-search words for their opening clip. Pure.
 *
 * A clip needs a moving video to cut: never a carousel, never the animated
 * templates. One hook type per idea - two would fight over the opening.
 */

/** Whether an idea of this format and direction can open on a hook clip. */
export function canHook(format: VideoFormat, direction: CreativeDirection | null): boolean {
  return format !== "carousel" && direction !== "animated";
}

/** At most one hook technique (the first), the others kept. */
export function withOneHook(techniques: ViralTechnique[]): ViralTechnique[] {
  const first = techniques.find(isHookTechnique);
  return techniques.filter((technique) => !isHookTechnique(technique) || technique === first);
}

/** No hook technique; an idea left with none keeps a curiosity hook, as a viral idea always has a technique. */
export function withoutHooks(techniques: ViralTechnique[]): ViralTechnique[] {
  const rest = techniques.filter((technique) => !isHookTechnique(technique));
  return rest.length ? rest : ["curiosity_hooks"];
}

/** The idea's hook type: from its techniques, when its format and direction can show one. */
export function hookTypeFor(techniques: readonly string[], format: VideoFormat, direction: CreativeDirection): HookType | null {
  if (!canHook(format, direction)) return null;
  for (const technique of techniques) {
    const type = hookTypeOf(technique);
    if (type) return type;
  }
  return null;
}

/**
 * Search words for a clip that is safe to open a business's video with: one
 * of these, or one the writer chose that names none of the UNSAFE words. They
 * are the searches that found usable Pixabay footage when the library was
 * picked (2026-11-18).
 */
export const SAFE_HOOK_QUERIES: Record<HookType, readonly string[]> = {
  anticipation: ["domino chain falling", "golf ball putt", "darts bullseye", "basketball layup", "skateboard trick", "bowling strike", "water balloon slow motion", "billiards break"],
  impossible: ["plasma ball", "flower blooming timelapse", "ink in water slow motion", "soap bubble colors macro", "bubble freezing", "liquid nitrogen vapor", "ferrofluid magnet", "water droplet macro"],
  danger: ["surfing big wave", "acrobat balance", "paragliding", "rock climbing", "trapeze acrobat", "slackline", "tightrope walker", "gymnast balance beam"],
};

/**
 * Words that never search for a hook clip: real harm or risk people could
 * copy, and subjects the platforms restrict or that put others at risk
 * (vehicles, weapons, animals, children). Checked word by word.
 */
const UNSAFE = new Set(
  (
    "accident accidents crash crashes crashing injury injured injuries wound blood bleeding fight fighting punch gun guns rifle weapon weapons knife knives sword " +
    "explosion explosions explode bomb fire flames burning burn drown drowning suicide death dead dying kill killing police war army soldier soldiers drug drugs " +
    "alcohol beer cigarette smoking nude naked bikini car cars truck motorbike motorcycle racing race traffic highway train child children kid kids baby babies " +
    "toddler animal animals dog dogs cat cats horse snake shark bear bull parkour rooftop stunt stunts prank fail fails"
  ).split(" "),
);

export function unsafeHookWords(words: string): boolean {
  return words
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => UNSAFE.has(word));
}

/** The opening clip's search words: the writer's when they are concrete and safe, else a safe one of the type's. */
export function hookQuery(type: HookType, written: string | null | undefined, seed: number): string {
  const clean = (written ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .slice(0, 8)
    .join(" ");
  if (clean.split(" ").filter(Boolean).length >= 2 && !unsafeHookWords(clean)) return clean;
  const list = SAFE_HOOK_QUERIES[type];
  return list[Math.abs(seed) % list.length];
}

/** The techniques a saved settings row chose; one saved before the visual hooks existed gets them as well (HOOK_TECHNIQUES_FROM). */
export function savedTechniques(stored: string[], savedAt: Date): ViralTechnique[] {
  const known = stored.filter((t): t is ViralTechnique => (VIRAL_TECHNIQUES as readonly string[]).includes(t));
  if (savedAt >= HOOK_TECHNIQUES_FROM) return known;
  return [...known, ...HOOK_TECHNIQUES.filter((technique) => !known.includes(technique))];
}
