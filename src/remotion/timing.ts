import { MAX_REEL_SECONDS, REEL, silentTiming, type ReelProps } from "../lib/video/formats";

/**
 * A reel's length and scene starts, shared by the Remotion composition
 * (calculateMetadata) and the Player in the app, so a preview and the
 * rendered file always cut at the same frames.
 */

/** The music and closing card run on this long after the last word. */
export const TAIL_MS = 1200;

export type ReelTiming = {
  /** Start frame of each part: hook, each point, proof, CTA. */
  starts: number[];
  durationInFrames: number;
};

export function reelTiming(props: Pick<ReelProps, "script" | "voiceMs" | "sceneStartsMs">, fps: number = REEL.fps): ReelTiming {
  const parts = props.script.points.length + 3;
  const voiced = props.voiceMs > 0 && props.sceneStartsMs.length === parts;
  const silent = silentTiming(props.script);
  const startsMs = voiced ? props.sceneStartsMs : silent.sceneStartsMs;
  const totalMs = Math.min(MAX_REEL_SECONDS * 1000, voiced ? props.voiceMs + TAIL_MS : silent.totalMs);
  const durationInFrames = Math.max(1, Math.round((totalMs / 1000) * fps));
  // The hook is on screen from the first frame even if the voice starts a beat later,
  // and every later scene keeps at least a few frames (a cut voice past the limit).
  const starts: number[] = [];
  startsMs.forEach((ms, i) => {
    const frame = i === 0 ? 0 : Math.round((ms / 1000) * fps);
    const floor = i === 0 ? 0 : starts[i - 1] + 6;
    starts.push(Math.min(Math.max(frame, floor), durationInFrames - (parts - i) * 6));
  });
  return { starts: starts.map((s) => Math.max(0, s)), durationInFrames };
}

/** The frame a part ends at (the next part's start, or the end of the reel). */
export function sceneEnd(timing: ReelTiming, index: number): number {
  return index + 1 < timing.starts.length ? timing.starts[index + 1] : timing.durationInFrames;
}
