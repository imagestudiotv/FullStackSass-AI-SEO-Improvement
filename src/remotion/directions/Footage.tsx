import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { FONT } from "../fonts";
import { cutFrames, type ProductionPart } from "../production";
import { CtaScene } from "../scenes/Cta";
import { emphasis, fitFontSize, splitWords } from "../text";
import { BrandTag, Enter, FilmTexture, IllustrativeLabel, LegibilityShade, Parts, SceneVisual, StyledCaptions, mediaFor, type DirectionProps, type Motion } from "./common";

/**
 * Footage: real-world clips and photos full-bleed, cut fast (a new shot every
 * 1.3-2.5 s by pacing, alternating crops and the next clip), a kinetic
 * highlighted line per scene, grain and a vignette so it reads as filmed.
 */

const MOTIONS: Motion[] = ["push", "drift", "pull", "punch"];

export function FootageProduction(props: DirectionProps) {
  const { timeline, pal, safe, brand, production, plan } = props;
  const captionStyle = production?.captionStyle ?? plan?.captionStyle ?? "bold";
  return (
    <>
      <Parts timeline={timeline}>
        {(part, index, duration) => (
          <Enter type={part.scene?.transition ?? "cut"}>
            {part.role === "cta" ? (
              <AbsoluteFill>
                <SceneVisual media={mediaFor(props, part)} duration={duration} motion="pull" seed={index} pal={pal} concept={props.concept} query={part.scene?.visual.query} />
                <AbsoluteFill style={{ background: "rgba(5,5,8,0.74)" }} />
                <CtaScene brand={brand} cta={part.title} pal={pal} />
              </AbsoluteFill>
            ) : (
              <FootageScene {...props} part={part} index={index} duration={duration} />
            )}
          </Enter>
        )}
      </Parts>
      <FilmTexture strength={0.8} />
      <StyledCaptions words={timeline.words} style={captionStyle} pal={pal} safe={safe} />
      <BrandTag name={brand.name} pal={pal} top={safe.top} />
    </>
  );
}

function FootageScene(props: DirectionProps & { part: ProductionPart; index: number; duration: number }) {
  const { part, index, duration, pal, safe, plan } = props;
  const shot = cutFrames(plan?.pacing ?? "medium");
  const shots = Math.max(1, Math.round(duration / shot));
  const length = Math.ceil(duration / shots);
  const first = mediaFor(props, part);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {Array.from({ length: shots }, (_, k) => {
        // Every other sub-shot is the next clip, the rest a new crop of this one.
        const media = k % 2 === 1 ? mediaFor(props, part, 1) ?? first : first;
        return (
          <Sequence key={k} from={k * length} durationInFrames={length + 1} layout="none">
            <AbsoluteFill>
              <SceneVisual
                media={media}
                duration={length}
                motion={MOTIONS[(index + k) % MOTIONS.length]}
                seed={index * 7 + k}
                pal={pal}
                concept={props.concept}
                query={part.scene?.visual.query}
                // A different moment of the clip per sub-shot, within its first second (clips are >= 4 s).
                startFrom={k % 2 === 0 ? (k * 13) % 30 : 0}
                extraScale={k % 2 === 0 ? 1 : 1.12}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <LegibilityShade strength={0.9} />
      <KineticLine text={part.title} top={safe.top + 170} pal={pal} hook={part.role === "hook"} />
      {first?.illustrative ? <IllustrativeLabel language={props.language} top={safe.top} /> : null}
    </AbsoluteFill>
  );
}

/** The scene's line, word by word, the key words on an accent highlighter. */
export function KineticLine({ text, top, pal, hook }: { text: string; top: number; pal: DirectionProps["pal"]; hook: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = splitWords(text);
  const strong = emphasis(words);
  const size = fitFontSize(text, 860, hook ? 4 : 3, hook ? 104 : 84, 52);
  // The hook lands within 0.3 s (client: the first 1-2 seconds matter most).
  const stagger = hook ? 1.5 : 2.5;
  return (
    <div style={{ position: "absolute", left: 80, width: 860, top, fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", color: "#fff" }}>
      {words.map((word, i) => {
        const s = spring({ frame: frame - 1 - i * stagger, fps, config: { damping: 13, stiffness: 240, mass: 0.6 } });
        const mark = strong.has(i);
        const sweep = interpolate(frame, [4 + i * stagger, 12 + i * stagger], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.22, transform: `translateY(${(1 - s) * 40}px)`, opacity: Math.min(1, s * 1.6) }}>
            <span
              style={{
                padding: mark ? `0 ${size * 0.12}px` : 0,
                borderRadius: size * 0.12,
                color: mark ? pal.onAccent : "#fff",
                backgroundImage: mark ? `linear-gradient(90deg, ${pal.accent} ${sweep}%, transparent ${sweep}%)` : undefined,
                textShadow: mark ? "none" : "0 4px 22px rgba(0,0,0,0.55)",
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
}
