import { REEL, type ReelProps, type Transition } from "../lib/video/formats";
import { ENTER_FRAMES, partEnd, productionTimeline } from "./production";
import { isProduction, type ProductionReelProps } from "./props";
import { findFigure, splitWords } from "./text";
import { reelTiming, sceneEnd } from "./timing";

/**
 * A reel's cover: the frame of its opening scene where the hook (or, with
 * the hook switched off, the first scene's title) is fully drawn - every
 * entrance finished, before the scene starts to leave (client, 2026-11-18:
 * the covers showed a fading first frame and a lone caption letter).
 *
 * The make job renders this frame as a still without captions
 * (props.hideCaptions; lib/video/render.ts) into video_ideas.cover_url; a
 * video made before has none, and the Videos page shows the MP4 at the same
 * moment instead (its captions are burned in, so one may show there).
 *
 * Each direction draws its opening differently, so each has its own timing,
 * read from the templates' own animations (src/remotion/scenes and
 * directions). Pure: the Videos page uses it too.
 */

/**
 * Frames a template's spring needs to come to rest at 30 fps: the springs
 * the openings use (ui.tsx POP, KineticLine, the meme bar, the type layouts,
 * the slow editorial titles) all settle within 1% in 13-28 frames.
 */
const SETTLE = 28;
/** A beat more once everything has landed. */
const HOLD = 4;
/** Kept clear of the scene's last frames: its exit (SceneExit, 9 frames) and the next scene's transition. */
const END_MARGIN = 10;

/** When a video's props are unknown: about when an opening is on screen. */
export const COVER_FALLBACK_SECONDS = 1.2;

/** The cover's frame within the reel. */
export function coverFrame(props: ReelProps | ProductionReelProps, fps: number = REEL.fps): number {
  return isProduction(props) ? productionCover(props as ProductionReelProps, fps) : animatedCover(props, fps);
}

/** The cover's moment in seconds, for a browser asked to show the MP4 there (#t=). */
export function coverSeconds(props: ReelProps | ProductionReelProps, fps: number = REEL.fps): number {
  return Math.round((coverFrame(props, fps) / fps) * 100) / 100;
}

/** `wanted`, kept between the opening scene's start and `last`, and inside the reel. */
function within(wanted: number, start: number, last: number, durationInFrames: number): number {
  return Math.max(start, Math.min(Math.round(wanted), last, durationInFrames - 1));
}

/** The original templates (Bold, Numbers, Story): their hook scene, as scenes/*.tsx animate it. */
function animatedCover(props: ReelProps, fps: number): number {
  const timing = reelTiming(props, fps);
  const end = sceneEnd(timing, 0);
  const words = splitWords(props.script.hook).length;
  // The hook's words pop in one after another (PopWords), spread over at most 40% of the scene.
  const stagger = Math.min(3.5, (end * 0.4) / Math.max(1, words));
  const lastWord = stagger * Math.max(0, words - 1);
  let settled: number;
  // Numbers: the figure counts up over frames 4-40, the words follow from frame 10 (4 without a figure).
  if (props.style === "numbers") settled = Math.max(40, (findFigure(props.script.hook) ? 10 : 4) + lastWord + SETTLE);
  // Story: the boxed hook wipes in over frames 6-22, the brand chip springs from frame 4.
  else if (props.style === "story") settled = Math.max(22, 4 + SETTLE);
  // Bold: the card fans out and its figure counts to frame 48, the words pop from frame 8.
  else settled = Math.max(48, 8 + lastWord + SETTLE);
  return within(settled + HOLD, 0, end - END_MARGIN, timing.durationInFrames);
}

/** The transition each direction opens with when the plan names none (directions/*.tsx). */
function openingTransition(direction: ProductionReelProps["direction"], planned: Transition | undefined): Transition {
  // Memes cut hard: only a flash or a glitch is kept (Meme.tsx memeCut).
  if (direction === "meme") return planned === "flash" || planned === "glitch" ? planned : "cut";
  if (planned) return planned;
  if (direction === "storytelling") return "fade";
  if (direction === "text_music" || direction === "voiceover") return "zoom";
  return "cut";
}

/** The productions: their first scene, as each direction animates it. */
function productionCover(props: ProductionReelProps, fps: number): number {
  const timeline = productionTimeline(props, fps);
  const part = timeline.parts[0];
  if (!part) return 0;
  const start = timeline.starts[0];
  const end = partEnd(timeline, 0);
  const duration = Math.max(1, end - start);
  const enter = ENTER_FRAMES[openingTransition(props.direction, part.scene?.transition)] ?? 0;
  const hook = part.role === "hook";
  const words = Math.max(1, splitWords(part.title).length);
  let settled: number;
  let last = end - END_MARGIN;
  switch (props.direction) {
    case "meme":
      // The caption bar springs in at once (a non-hook title fades over frames 4-12); the comic beat
      // freezes and punches in at 42% of the scene, so the cover comes before it.
      settled = 1 + SETTLE;
      last = Math.min(last, start + Math.round(duration * 0.42) - 1);
      break;
    case "footage":
      // KineticLine: a word every 1.5 frames on the hook (2.5 otherwise); the brand tag is in by frame 20.
      settled = Math.max(20, 1 + (hook ? 1.5 : 2.5) * (words - 1) + SETTLE);
      break;
    case "voiceover":
      // The hook is a KineticLine; another opening title is a chip springing from frame 4.
      settled = Math.max(20, hook ? 1 + 1.5 * (words - 1) + SETTLE : 4 + SETTLE);
      break;
    case "storytelling":
      // The editorial title rises from frame 3 on a slow spring.
      settled = 3 + SETTLE;
      break;
    case "text_music": {
      // A word per beat (at once on the hook), then the supporting line 8 frames after the last word.
      const reveal = hook ? 2 : Math.max(2, Math.min(6, Math.floor((duration * 0.4) / words)));
      settled = 1 + reveal * (words - 1) + SETTLE;
      if (part.detail && !hook) settled = Math.max(settled, words * reveal + 8 + SETTLE);
      break;
    }
    default:
      settled = SETTLE;
  }
  return within(start + Math.max(enter, settled) + HOLD, start, last, timeline.durationInFrames);
}
