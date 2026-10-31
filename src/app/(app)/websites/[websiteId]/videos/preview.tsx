"use client";

import { Player, Thumbnail } from "@remotion/player";

import { REEL, SLIDE, slideCount, type ReelProps } from "@/lib/video/formats";
import { Reel } from "@/remotion/Reel";
import { Slide } from "@/remotion/Slide";
import { reelTiming } from "@/remotion/timing";

/**
 * The idea's preview: the real template, played in the page by Remotion's
 * player - the same scenes the finished video has, without the voice (it is
 * only spoken once the idea is approved). Nothing is rendered on a server,
 * so twenty previews cost nothing.
 */

/** The reel's length, as the render's calculateMetadata works it out, so the preview cuts at the same frames. */
export function reelFrames(props: ReelProps): number {
  return reelTiming(props).durationInFrames;
}

export function ReelPreview({ props, autoPlay = true, className }: { props: ReelProps; autoPlay?: boolean; className?: string }) {
  return (
    <Player
      component={Reel}
      inputProps={props}
      durationInFrames={reelFrames(props)}
      compositionWidth={REEL.width}
      compositionHeight={REEL.height}
      fps={REEL.fps}
      autoPlay={autoPlay}
      // A preview has no sound yet. Muted, the player keeps its own time instead of the browser's audio
      // clock, which stays suspended until the visitor clicks something - and the preview would not move.
      initiallyMuted={!props.voiceUrl && !props.music}
      loop
      controls
      clickToPlay
      acknowledgeRemotionLicense
      className={className}
      style={{ width: "100%", aspectRatio: `${REEL.width} / ${REEL.height}`, borderRadius: 16, overflow: "hidden" }}
    />
  );
}

/** A carousel's slides side by side, as stills. */
export function CarouselPreview({ props }: { props: ReelProps }) {
  const count = slideCount(props.script);
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="w-[78%] shrink-0 snap-center sm:w-[60%]">
          <Thumbnail
            component={Slide}
            inputProps={{ ...props, index }}
            compositionWidth={SLIDE.width}
            compositionHeight={SLIDE.height}
            frameToDisplay={0}
            durationInFrames={1}
            fps={30}
            style={{ width: "100%", aspectRatio: `${SLIDE.width} / ${SLIDE.height}`, borderRadius: 12, overflow: "hidden" }}
          />
        </div>
      ))}
    </div>
  );
}
