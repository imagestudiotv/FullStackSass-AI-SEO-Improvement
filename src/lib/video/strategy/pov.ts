import type { HookClipPick, HookType, IdeaCategory, VideoFormat, VideoScript } from "../formats";
import { AI_HOOK_LIBRARY, AI_POV_LIBRARY, AI_PROVIDER, type AiHookClip, type AiPovClip } from "../footage/ai-library";
import { HOOK_LIBRARY, type HookLibraryClip } from "../footage/hook-library";
import { libraryPicks, opensOnAiClip } from "../footage/hooks";
import type { LengthPlan } from "./duration";

/**
 * POV clip videos and hook clips chosen when the idea is written (client,
 * 2026-11-21). A POV clip video is one of RepGet's AI POV clips
 * (AI_POV_LIBRARY) full screen with the customer's own POV line on top,
 * music, no voice: half of the viral slots that can hold a clip ("POV clip:
 * 5, others: 5"). A hooked idea's opening clip is picked here too, so the
 * idea's preview shows it (AI:Pixabay = AI_HOOK_SHARE, 70:30). Pure.
 */

/** The POV line over the clip, in characters. */
export const POV_LINE_MAX = 90;

/** A POV clip video's length for the writer: one line over a 10 s clip, no points. */
export const POV_LENGTH: LengthPlan = { seconds: { min: 10, max: 12 }, words: { min: 4, max: 16 }, points: { min: 0, max: 0 } };

type PovClipLike = Pick<AiPovClip, "id" | "shows" | "tags">;

/**
 * Which planned slots are POV clip slots: every other viral slot that can
 * hold a clip (a reel or a Story, never a carousel), the first one included,
 * so ten such slots give five. None while the library is empty.
 */
export function povSlots(slots: readonly { category: IdeaCategory; format: VideoFormat }[], library: readonly PovClipLike[] = AI_POV_LIBRARY): boolean[] {
  let clipCapable = 0;
  return slots.map((slot) => {
    if (library.length === 0 || slot.category !== "viral" || slot.format === "carousel") return false;
    return clipCapable++ % 2 === 0;
  });
}

/** A POV idea's script: the POV line as the hook and the closing line; no points, no proof. Null without a line. */
export function povScript(written: { hook: string; cta: string }): VideoScript | null {
  const line = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);
  const hook = line(written.hook ?? "", POV_LINE_MAX);
  if (!hook) return null;
  return { hook, points: [], proof: "", cta: line(written.cta ?? "", 80) };
}

const wordsOf = (text: string) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2));

/**
 * The POV clip of an idea: the writer's choice when it is a clip of the
 * library not used yet in this batch; else the unused clip whose tags and
 * description share the most words with the POV line (equals rotated by the
 * seed); else, all used, any (rotated). Null on an empty library.
 */
export function pickPovClip(
  written: string | null | undefined,
  povLine: string,
  used: ReadonlySet<string>,
  seed: number,
  library: readonly PovClipLike[] = AI_POV_LIBRARY,
): string | null {
  if (library.length === 0) return null;
  if (written && !used.has(written) && library.some((clip) => clip.id === written)) return written;
  const rotate = <T>(list: T[]) => list[Math.abs(seed) % list.length];
  const free = library.filter((clip) => !used.has(clip.id));
  if (free.length === 0) return rotate([...library].sort((a, b) => a.id.localeCompare(b.id))).id;
  const line = wordsOf(povLine);
  const scored = free
    .map((clip) => {
      const words = wordsOf(`${clip.shows} ${clip.tags.join(" ")}`);
      return { clip, hits: [...line].filter((word) => words.has(word)).length };
    })
    .sort((a, b) => b.hits - a.hits || a.clip.id.localeCompare(b.clip.id));
  return rotate(scored.filter((entry) => entry.hits === scored[0].hits)).clip.id;
}

/** A 32-bit mix, so neighbouring seeds give unrelated looks. */
function mix(seed: number): number {
  let x = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** A POV clip's look for one video, fixed by its seed: mirrored about half the time, a zoom of 1.00-1.12, a hue turn of -8..8 degrees. */
export function povLook(seed: number): { mirror: boolean; zoom: number; hue: number } {
  const a = mix(seed);
  const b = mix(a + 1);
  const c = mix(b + 1);
  return { mirror: a % 1000 < 500, zoom: Number((1 + (b % 13) / 100).toFixed(2)), hue: (c % 17) - 8 };
}

/** The key a picked hook clip has in a batch's used set ("<provider>:<id>", as libraryPicks excludes). */
export const hookPickKey = (pick: HookClipPick) => `${pick.provider}:${pick.id}`;

/**
 * A hooked idea's opening clip, chosen when it is written: an AI clip for
 * about AI_HOOK_SHARE of ideas (opensOnAiClip), else a Pixabay library clip,
 * each with the other as the fallback; clips already used in this batch
 * ("<provider>:<id>") only when nothing else of the type is left. Null when
 * neither library has a clip of the type (the make job searches then).
 */
export function hookPick(
  type: HookType,
  query: string,
  seed: number,
  used: ReadonlySet<string> = new Set(),
  aiLibrary: readonly AiHookClip[] = AI_HOOK_LIBRARY,
  pixabayLibrary: readonly HookLibraryClip[] = HOOK_LIBRARY,
): HookClipPick | null {
  const sources: { provider: HookClipPick["provider"]; library: readonly HookLibraryClip[] }[] = [
    { provider: AI_PROVIDER, library: aiLibrary },
    { provider: "pixabay", library: pixabayLibrary },
  ];
  const order = opensOnAiClip(seed) ? sources : [...sources].reverse();
  for (const exclude of [new Set(used), new Set<string>()]) {
    for (const { provider, library } of order) {
      const [clip] = libraryPicks(type, query, seed, exclude, library, provider);
      if (clip) return { provider, id: clip.id };
    }
  }
  return null;
}
