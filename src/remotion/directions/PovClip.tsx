import { useState, type CSSProperties } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { povCaptionLook } from "../caption-looks";
import { LookText } from "../components/LookText";
import { partEnd } from "../production";
import type { SceneMedia } from "../props";
import { ConceptFrame, type DirectionProps } from "./common";

/**
 * A POV clip video (client, 2026-11-21; ShotPlan.povClip): one of RepGet's AI
 * POV clips full screen for its whole length with the customer's POV line on
 * top in the video's caption look (caption-looks.ts) - and nothing else: no
 * brand mark, no closing card, no web address (client, 2026-11-23: "we want
 * to keep only the viral video with text on it"). Each video's copy of a
 * clip is mirrored, zoomed and hue-turned by its plan ("to not be 100 same
 * videos identic online"). Timing: production.ts povTimeline.
 */

export function PovClipProduction(props: DirectionProps) {
  const { timeline, plan } = props;
  const { fps } = useVideoConfig();
  const media = props.sceneMedia?.[0] ?? null;
  const clip = media?.kind === "video" ? media : null;
  const hook = timeline.parts[0];
  const hookFrames = partEnd(timeline, 0);
  const clipFrames = clip?.durationMs ? Math.max(1, Math.floor((clip.durationMs / 1000) * fps) - 1) : null;
  // The clip plays once; a hook longer than it holds its last frame.
  const lastFrame = Math.max(0, Math.min(hookFrames, clipFrames ?? hookFrames) - 1);
  const look = plan?.povClip;
  const lookStyle: CSSProperties = {
    transform: `scaleX(${look?.mirror ? -1 : 1}) scale(${look?.zoom ?? 1})`,
    filter: look?.hue ? `hue-rotate(${look.hue}deg)` : undefined,
  };
  return (
    <>
      {hook ? (
        <Sequence from={0} durationInFrames={hookFrames} layout="none">
          <AbsoluteFill>
            <Freeze frame={lastFrame} active={(f) => f > lastFrame}>
              <ClipFill {...props} clip={clip} lookStyle={lookStyle} startFrom={0} />
            </Freeze>
            <PovLine {...props} text={hook.title} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
    </>
  );
}

/** The clip filling the frame with the plan's look; without it (an older preview, a failed file) a dark frame. */
function ClipFill({ clip, lookStyle, startFrom, pal, concept, plan }: DirectionProps & { clip: SceneMedia | null; lookStyle: CSSProperties; startFrom: number }) {
  const [failed, setFailed] = useState(false);
  if (!clip || failed) {
    return concept ? <ConceptFrame query={plan?.scenes?.[0]?.visual.query} seed={0} pal={pal} /> : <AbsoluteFill style={{ background: "linear-gradient(180deg, #16161c 0%, #050508 100%)" }} />;
  }
  const position = `${Math.round((clip.focalX ?? 0.5) * 100)}% ${Math.round((clip.focalY ?? 0.5) * 100)}%`;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo
        src={clip.url}
        muted
        startFrom={startFrom}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position, ...lookStyle }}
      />
    </AbsoluteFill>
  );
}

/** The POV line in the clip's calm top fifth, inside the safe area, at most three lines, in the video's caption look, popping in over 6 frames. */
function PovLine({ text, safe, plan }: DirectionProps & { text: string }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const look = plan?.povClip ? povCaptionLook(plan.povClip) : "native";
  return (
    <LookText
      look={look}
      text={text}
      width={safe.right - safe.left}
      style={{ position: "absolute", left: safe.left, top: safe.top + 20, opacity: enter, transform: `scale(${0.9 + 0.1 * enter})`, transformOrigin: "50% 0%" }}
    />
  );
}
