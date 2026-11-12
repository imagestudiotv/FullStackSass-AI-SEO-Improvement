import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { FONT } from "../fonts";
import type { ProductionPart } from "../production";
import { CtaScene } from "../scenes/Cta";
import { fitFontSize } from "../text";
import { BrandTag, Enter, IllustrativeLabel, LegibilityShade, Parts, SceneVisual, StyledCaptions, mediaFor, type DirectionProps } from "./common";
import { KineticLine } from "./Footage";

/**
 * AI voiceover: the narration over relevant footage and pictures, each scene
 * entering with its planned transition (cut, zoom, whip, slide, flash,
 * glitch, fade), word captions in the chosen style, a small chapter label,
 * the music ducked under the voice (Reel.tsx).
 */

export function VoiceoverProduction(props: DirectionProps) {
  const { timeline, pal, safe, brand, production, plan } = props;
  const captionStyle = production?.captionStyle ?? plan?.captionStyle ?? "bold";
  return (
    <>
      <Parts timeline={timeline}>
        {(part, index, duration) => (
          <Enter type={part.scene?.transition ?? (index % 2 ? "whip" : "zoom")}>
            {part.role === "cta" ? (
              <AbsoluteFill>
                <SceneVisual media={mediaFor(props, part)} duration={duration} motion="pull" seed={index} pal={pal} concept={props.concept} />
                <AbsoluteFill style={{ background: "rgba(5,5,8,0.76)" }} />
                <CtaScene brand={brand} cta={part.title} pal={pal} />
              </AbsoluteFill>
            ) : (
              <VoiceScene {...props} part={part} index={index} duration={duration} />
            )}
          </Enter>
        )}
      </Parts>
      <StyledCaptions words={timeline.words} style={captionStyle} pal={pal} safe={safe} />
      <BrandTag name={brand.name} pal={pal} top={safe.top} />
    </>
  );
}

function VoiceScene(props: DirectionProps & { part: ProductionPart; index: number; duration: number }) {
  const { part, index, duration, pal, safe } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const media = mediaFor(props, part);
  const chip = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 150 } });
  const fade = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <SceneVisual media={media} duration={duration} motion={index % 2 ? "pull" : "push"} seed={index} pal={pal} concept={props.concept} query={part.scene?.visual.query} />
      <LegibilityShade strength={0.85} />
      {part.role === "hook" ? (
        <KineticLine text={part.title} top={safe.top + 170} pal={pal} hook />
      ) : (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: safe.top + 90,
            maxWidth: 820,
            padding: "14px 24px",
            borderRadius: 16,
            background: "rgba(10,10,14,0.6)",
            borderLeft: `8px solid ${pal.accent}`,
            fontFamily: FONT,
            fontSize: fitFontSize(part.title, 760, 2, 52, 44, 0.56),
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#fff",
            opacity: chip * fade,
            transform: `translateX(${(1 - chip) * -60}px)`,
          }}
        >
          {part.title}
        </div>
      )}
      {media?.illustrative ? <IllustrativeLabel language={props.language} top={safe.top + 40} /> : null}
    </AbsoluteFill>
  );
}
