import type { HookClipPick, HookType, IdeaCategory, ShotPlan, VideoFormat, VideoScript } from "../formats";
import { AI_HOOK_LIBRARY, AI_POV_LIBRARY, AI_PROVIDER, type AiHookClip, type AiPovClip } from "../footage/ai-library";
import { HOOK_LIBRARY, type HookLibraryClip } from "../footage/hook-library";
import { clipStanding, opensOnAiClip, siteClipOrder, type ClipUse, type SiteClips } from "../footage/hooks";
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
 * library not used yet in this batch and as far along the website's clip
 * order as the next one (client, 2026-11-26: a website goes through the
 * clips in order, footage/hooks.ts siteClipOrder - never one it used while
 * one it never used is left); else the next clip in that order. Clips used
 * at the same moment go to the one whose tags and description share the
 * most words with the POV line. Null on an empty library.
 */
export function pickPovClip(
  written: string | null | undefined,
  povLine: string,
  used: ReadonlySet<string>,
  library: readonly PovClipLike[] = AI_POV_LIBRARY,
  site: ReadonlyMap<string, ClipUse> = new Map(),
): string | null {
  if (library.length === 0) return null;
  const line = wordsOf(povLine);
  const fit = (clip: PovClipLike) => {
    const words = wordsOf(`${clip.shows} ${clip.tags.join(" ")}`);
    return [...line].filter((word) => words.has(word)).length;
  };
  const [next] = siteClipOrder(library, (clip) => clip.id, site, used, fit);
  const chosen = written ? library.find((clip) => clip.id === written) : undefined;
  if (chosen && !used.has(chosen.id) && clipStanding(site.get(chosen.id)) === clipStanding(site.get(next.id))) return chosen.id;
  return next.id;
}

/** Clips offered to the writer beyond one per POV slot, so it can still fit a clip to the line (client, 2026-11-26). */
export const POV_OFFER_SPARE = 3;

/**
 * The POV clips the writer picks from: the website's next ones in its clip
 * order (siteClipOrder), one per POV slot of the batch plus POV_OFFER_SPARE,
 * so the writer still fits a clip to the line but a website never skips far
 * ahead (a clip it passes over is first in the order next time). None for a
 * batch without a POV slot. Pure.
 */
export function povClipsOffered(
  povSlotCount: number,
  library: readonly PovClipLike[] = AI_POV_LIBRARY,
  site: ReadonlyMap<string, ClipUse> = new Map(),
): { id: string; shows: string }[] {
  if (povSlotCount <= 0) return [];
  return siteClipOrder(library, (clip) => clip.id, site)
    .slice(0, povSlotCount + POV_OFFER_SPARE)
    .map((clip) => ({ id: clip.id, shows: clip.shows }));
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
 * each with the other as the fallback. Each library of the type is taken in
 * the website's clip order (client, 2026-11-26; footage/hooks.ts
 * siteClipOrder): the clips the website never used, in the library's order;
 * then the ones it only saw in an idea, then the ones it made a video with,
 * least recently used first. The other library is turned to before a clip
 * the website already used; clips already used in this batch
 * ("<provider>:<id>") only when nothing else of the type is left. The search
 * words only break ties of clips used at the same moment. Null when neither
 * library has a clip of the type (the make job searches then).
 */
export function hookPick(
  type: HookType,
  query: string,
  seed: number,
  used: ReadonlySet<string> = new Set(),
  aiLibrary: readonly AiHookClip[] = AI_HOOK_LIBRARY,
  pixabayLibrary: readonly HookLibraryClip[] = HOOK_LIBRARY,
  site: ReadonlyMap<string, ClipUse> = new Map(),
): HookClipPick | null {
  const sources: { provider: HookClipPick["provider"]; library: readonly HookLibraryClip[] }[] = [
    { provider: AI_PROVIDER, library: aiLibrary },
    { provider: "pixabay", library: pixabayLibrary },
  ];
  const words = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const fit = (clip: HookLibraryClip) => clip.tags.filter((tag) => tag.toLowerCase().split(/\s+/).some((word) => words.has(word))).length;
  const ranked = (opensOnAiClip(seed) ? sources : [...sources].reverse()).map(({ provider, library }) =>
    siteClipOrder(
      library.filter((clip) => clip.type === type),
      (clip) => `${provider}:${clip.id}`,
      site,
      used,
      fit,
    ).map((clip) => ({ provider, id: clip.id, key: `${provider}:${clip.id}` })),
  );
  // Step by step, so the share decides only between clips equally new to the website.
  const steps: ((key: string) => boolean)[] = [
    (key) => !used.has(key) && clipStanding(site.get(key)) === 0,
    (key) => !used.has(key) && clipStanding(site.get(key)) <= 1,
    (key) => !used.has(key),
    () => true,
  ];
  for (const accept of steps) {
    for (const list of ranked) {
      const hit = list.find((entry) => accept(entry.key));
      if (hit) return { provider: hit.provider, id: hit.id };
    }
  }
  return null;
}

/* ------------------------------------------- clips moved off already-made ones */

/** A not-yet-made idea on the website's list that holds a clip; `seed` is the one its clip was picked with (stableHash of its title). */
export type PendingClipIdea = { id: string; line: string; seed: number; plan: ShotPlan };

/** A new clip for a pending idea: its new plan, and the clip it gave up ("<provider>", "<id>"). */
export type ClipMove = { id: string; plan: ShotPlan; from: { provider: string; id: string } };

/**
 * The website's not-yet-made ideas (Today's ideas) that hold a clip the
 * website has made a video with get the next clip in its order instead
 * (client, 2026-11-26: "is recreating the same clips ... but I have it
 * already saved and publish a very similar video"). A clip another of these
 * ideas holds is not taken while another is left, and two moves never take
 * the same clip. An idea stays as it is when every clip was made already
 * (nothing better to give it). Pure; `now` is the time the new clips count
 * as used from.
 */
export function movesOffMadeClips(
  pending: readonly PendingClipIdea[],
  site: SiteClips,
  now: number,
  libraries: { pov?: readonly PovClipLike[]; ai?: readonly AiHookClip[]; pixabay?: readonly HookLibraryClip[] } = {},
): ClipMove[] {
  const povLibrary = libraries.pov ?? AI_POV_LIBRARY;
  const povUse = new Map(site.pov);
  const hookUse = new Map(site.hooks);
  const heldPov = new Set(pending.flatMap((idea) => (idea.plan.povClip ? [idea.plan.povClip.id] : [])));
  const heldHooks = new Set(pending.flatMap((idea) => (idea.plan.hookClip?.pick ? [hookPickKey(idea.plan.hookClip.pick)] : [])));
  const moves: ClipMove[] = [];
  for (const idea of pending) {
    const { povClip, hookClip } = idea.plan;
    if (povClip && povUse.get(povClip.id)?.made) {
      const next = pickPovClip(null, idea.line, heldPov, povLibrary, povUse);
      if (!next || next === povClip.id || clipStanding(povUse.get(next)) === 2) continue;
      const before = povLibrary.find((clip) => clip.id === povClip.id)?.shows;
      const after = povLibrary.find((clip) => clip.id === next)!.shows;
      heldPov.add(next);
      povUse.set(next, { lastUsedAt: now, made: false });
      moves.push({
        id: idea.id,
        // Its one scene shows the clip (ideas.ts composeRows): the new clip's description with it.
        plan: {
          ...idea.plan,
          povClip: { ...povClip, id: next },
          scenes: (idea.plan.scenes ?? []).map((scene) => (before !== undefined && scene.visual?.query === before ? { ...scene, visual: { ...scene.visual, query: after } } : scene)),
        },
        from: { provider: AI_PROVIDER, id: povClip.id },
      });
    } else if (hookClip?.pick && hookUse.get(hookPickKey(hookClip.pick))?.made) {
      const next = hookPick(hookClip.type, "", idea.seed, heldHooks, libraries.ai, libraries.pixabay, hookUse);
      if (!next || hookPickKey(next) === hookPickKey(hookClip.pick) || clipStanding(hookUse.get(hookPickKey(next))) === 2) continue;
      heldHooks.add(hookPickKey(next));
      hookUse.set(hookPickKey(next), { lastUsedAt: now, made: false });
      moves.push({ id: idea.id, plan: { ...idea.plan, hookClip: { ...hookClip, pick: next } }, from: { provider: hookClip.pick.provider, id: hookClip.pick.id } });
    }
  }
  return moves;
}
