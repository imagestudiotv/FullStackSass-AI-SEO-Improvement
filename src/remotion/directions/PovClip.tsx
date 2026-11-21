import { useState, type CSSProperties } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { LogoTile, TEXT_SAFE } from "../components/ui";
import { FONT } from "../fonts";
import { partEnd } from "../production";
import type { SceneMedia } from "../props";
import { CtaScene } from "../scenes/Cta";
import { fitFontSize } from "../text";
import { alpha } from "../theme";
import { ConceptFrame, type DirectionProps } from "./common";

/**
 * A POV clip video (client, 2026-11-21; ShotPlan.povClip): one of RepGet's AI
 * POV clips full screen for its whole length, the customer's POV line on
 * top as Instagram meme reels write it - white, bold, centred, plain text
 * (no white bar: that is the Meme direction) - and the brand small at the
 * bottom; then the closing card over the clip's last frame. Each video's
 * copy of a clip is mirrored, zoomed and hue-turned by its plan ("to not be
 * 100 same videos identic online"). Timing: production.ts povTimeline.
 */

/** A dark outline and glow, so white words read on any clip. */
const OUTLINE = [
  "-2px -2px 0 #000",
  "2px -2px 0 #000",
  "-2px 2px 0 #000",
  "2px 2px 0 #000",
  "0 -2px 0 #000",
  "0 2px 0 #000",
  "-2px 0 0 #000",
  "2px 0 0 #000",
  "0 4px 18px rgba(0,0,0,0.55)",
].join(", ");

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
  const cta = timeline.parts.findIndex((part) => part.role === "cta");
  return (
    <>
      {hook ? (
        <Sequence from={0} durationInFrames={hookFrames} layout="none">
          <AbsoluteFill>
            <Freeze frame={lastFrame} active={(f) => f > lastFrame}>
              <ClipFill {...props} clip={clip} lookStyle={lookStyle} startFrom={0} />
            </Freeze>
            <PovLine {...props} text={hook.title} />
            <BrandMark {...props} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      {cta > 0 ? (
        <Sequence from={timeline.starts[cta]} durationInFrames={Math.max(1, partEnd(timeline, cta) - timeline.starts[cta])} layout="none">
          <AbsoluteFill>
            <Freeze frame={0}>
              <ClipFill {...props} clip={clip} lookStyle={lookStyle} startFrom={lastFrame} />
            </Freeze>
            <CtaShade />
            <CtaScene brand={props.brand} cta={timeline.parts[cta].title} pal={props.pal} />
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

/** The POV line in the clip's calm top fifth, inside the safe area, at most three lines, popping in over 6 frames. */
function PovLine({ text, safe }: DirectionProps & { text: string }) {
  const frame = useCurrentFrame();
  const width = safe.right - safe.left;
  const size = fitFontSize(text, width, 3, 68, 44, 0.56);
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: safe.left,
        width,
        top: safe.top + 20,
        textAlign: "center",
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.16,
        letterSpacing: "-0.01em",
        color: "#ffffff",
        textShadow: OUTLINE,
        opacity: enter,
        transform: `scale(${0.9 + 0.1 * enter})`,
        transformOrigin: "50% 0%",
        ...TEXT_SAFE,
      }}
    >
      {text}
    </div>
  );
}

/** Who made the video, small and subtle at the bottom of the safe area: the logo when there is one, else a brand-colour dot. */
function BrandMark({ brand, pal, safe }: DirectionProps) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [8, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: safe.left, top: safe.bottom - 66, display: "flex", alignItems: "center", gap: 12, opacity: enter * 0.85, fontFamily: FONT }}>
      {brand.logoUrl ? (
        <LogoTile brand={brand} size={46} pal={pal} />
      ) : (
        <span style={{ width: 14, height: 14, borderRadius: 7, background: pal.accent, boxShadow: `0 0 14px ${alpha(pal.accent, 0.7)}` }} />
      )}
      <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.7)", maxWidth: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {brand.name}
      </span>
    </div>
  );
}

/** The closing card's dark wash over the clip's last frame, as the Meme direction closes. */
function CtaShade() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "rgba(5,5,8,0.78)", opacity: interpolate(frame, [0, 6], [0.4, 1], { extrapolateRight: "clamp" }) }} />;
}
