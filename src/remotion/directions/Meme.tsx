import { AbsoluteFill, Freeze, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { Transition } from "../../lib/video/formats";
import { FONT } from "../fonts";
import type { ProductionPart } from "../production";
import { fitFontSize } from "../text";
import { CtaScene } from "../scenes/Cta";
import { Enter, IllustrativeLabel, LegibilityShade, Parts, SceneVisual, StyledCaptions, mediaFor, type DirectionProps } from "./common";

/**
 * Meme: a relatable POV/reaction situation, as people post them - a white
 * caption bar on top ("POV: ..."), the picture or clip under it, and comic
 * timing in every scene: the setup, a beat (freeze-frame, punch-in, a shake),
 * then the payoff with a reaction sticker (ShotScene.reaction).
 */

/**
 * Memes cut hard: a flash or a glitch can land the beat, but a zoom, slide or
 * fade would blend two caption bars into each other - those become cuts.
 */
function memeCut(transition: Transition | undefined): Transition {
  return transition === "flash" || transition === "glitch" ? transition : "cut";
}

/** The white bar's height for its words. */
function barSize(text: string): { size: number; height: number } {
  const size = fitFontSize(text, 860, 3, 66, 46, 0.56);
  const lines = Math.min(3, Math.ceil((text.length * size * 0.56) / (860 * 0.9)));
  return { size, height: Math.round(lines * size * 1.18 + 70) };
}

export function MemeProduction(props: DirectionProps) {
  const { timeline, pal, safe, brand, production } = props;
  const captionStyle = production?.captionStyle ?? props.plan?.captionStyle ?? "bold";
  return (
    <>
      <Parts timeline={timeline}>
        {(part, index, duration) =>
          part.role === "cta" ? (
            <Enter type={memeCut(part.scene?.transition)}>
              <AbsoluteFill style={{ background: "#0b0b10" }}>
                <SceneVisual media={mediaFor(props, part)} duration={duration} motion="still" seed={index} pal={pal} concept={props.concept} />
                <AbsoluteFill style={{ background: "rgba(5,5,8,0.78)" }} />
                <CtaScene brand={brand} cta={part.title} pal={pal} />
              </AbsoluteFill>
            </Enter>
          ) : (
            <Enter type={memeCut(part.scene?.transition)}>
              <MemeScene {...props} part={part} index={index} duration={duration} />
            </Enter>
          )
        }
      </Parts>
      <StyledCaptions words={timeline.words} style={captionStyle} pal={pal} safe={safe} />
    </>
  );
}

function MemeScene(props: DirectionProps & { part: ProductionPart; index: number; duration: number }) {
  const { part, index, duration, pal, safe } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const media = mediaFor(props, part);
  // The bar: the plan's POV line, else the scene's own words - on screen within 0.3 s.
  const bar = part.scene?.overlay?.trim() || part.title;
  const { size, height } = barSize(bar);
  const barTop = safe.top - 30;
  const barIn = spring({ frame: frame - 1, fps, config: { damping: 16, stiffness: 320, mass: 0.5 } });

  // Comic timing: setup -> beat -> payoff.
  const beatAt = Math.round(duration * 0.42);
  const payoffAt = Math.round(duration * 0.58);
  const inBeat = frame >= beatAt && frame < payoffAt;
  const punch = interpolate(frame, [beatAt, beatAt + 4, payoffAt, payoffAt + 6], [1, 1.28, 1.28, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = inBeat ? (random(`shake-${index}-${frame}`) - 0.5) * 26 : 0;
  const sticker = spring({ frame: frame - payoffAt, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  const reaction = part.scene?.reaction?.trim() || null;
  const visualTop = barTop + height;

  const visual = (
    <SceneVisual media={media} duration={duration} motion="punch" seed={index} pal={pal} concept={props.concept} query={part.scene?.visual.query} extraScale={punch} />
  );

  return (
    <AbsoluteFill style={{ background: "#ffffff", fontFamily: FONT }}>
      {/* The picture fills the frame under the bar, as a meme does. */}
      <AbsoluteFill style={{ top: visualTop, transform: `translate(${shake}px, ${shake * 0.4}px)`, overflow: "hidden" }}>
        {inBeat ? <Freeze frame={beatAt}>{visual}</Freeze> : visual}
        <LegibilityShade strength={0.7} top={0} />
        {inBeat ? <AbsoluteFill style={{ background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 10px #ffffff" }} /> : null}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: visualTop,
          background: "#ffffff",
          display: "flex",
          alignItems: "flex-end",
          paddingBottom: 30,
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            marginLeft: safe.left,
            width: 860,
            fontSize: size,
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: "-0.015em",
            color: "#111114",
            opacity: Math.min(1, barIn * 1.5),
            transform: `translateY(${(1 - barIn) * 14}px)`,
          }}
        >
          {bar}
        </div>
      </div>
      {part.role !== "hook" && part.title.trim().toLowerCase() !== bar.toLowerCase() ? (
        <div
          style={{
            position: "absolute",
            left: safe.left,
            right: 1080 - safe.right + 20,
            top: visualTop + 40,
            fontSize: 44,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 3px 0 #000, 0 0 18px rgba(0,0,0,0.8)",
            opacity: interpolate(frame, [4, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {part.title}
        </div>
      ) : null}
      {reaction ? (
        <div
          style={{
            position: "absolute",
            right: 1080 - safe.right + 10,
            top: Math.min(safe.bottom - 520, visualTop + 300),
            padding: "18px 30px",
            borderRadius: 26,
            background: pal.accent,
            color: pal.onAccent,
            fontSize: reaction.length <= 3 ? 120 : 64,
            fontWeight: 900,
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            transform: `scale(${sticker}) rotate(${(1 - sticker) * 30 - 8}deg)`,
            opacity: frame >= payoffAt ? 1 : 0,
          }}
        >
          {reaction}
        </div>
      ) : null}
      {media?.illustrative ? <IllustrativeLabel language={props.language} top={visualTop + 20} /> : null}
    </AbsoluteFill>
  );
}
