import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { BrandLook, MediaItem, VideoPoint } from "../../lib/video/formats";
import { BrandShapes, KenBurns, MediaShade } from "../components/Media";
import { LogoTile, PAD, QuoteIcon, SceneExit, TEXT_SAFE, useSpring } from "../components/ui";
import { fitFontSize } from "../text";
import { alpha, type Palette } from "../theme";

/**
 * The "story" style: the website's own pictures and the customer's clips
 * full-bleed, the words over them in brand-colour boxes like an editorial
 * story. Scenes cross-fade (Reel overlaps their sequences).
 */

const CONTENT = 1080 - PAD * 2;
/** Text ends here, above the captions. */
const TEXT_BOTTOM = 1300;

/** Text in boxes that follow its lines; `reveal` wipes it in left to right. */
export function BoxedText({ text, size, background, color, reveal, style }: { text: string; size: number; background: string; color: string; reveal: number; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.36, letterSpacing: "-0.025em", clipPath: `inset(-10% ${(1 - reveal) * 100}% -10% -2%)`, ...TEXT_SAFE, ...style }}>
      <span
        style={{
          background,
          color,
          padding: "0.04em 0.26em 0.08em",
          borderRadius: size * 0.16,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** A story scene's backdrop: the media fading in over the previous scene, or brand shapes. */
export function StoryBackdrop({ item, seed, duration, pal, shade = 1 }: { item: MediaItem | null; seed: number; duration: number; pal: Palette; shade?: number }) {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {item ? <KenBurns item={item} seed={seed} duration={duration} pal={pal} /> : <BrandShapes seed={seed} pal={pal} />}
      <MediaShade pal={pal} strength={item ? shade : shade * 0.6} />
    </AbsoluteFill>
  );
}

function TextBlock({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", padding: `0 ${PAD}px`, paddingBottom: 1920 - TEXT_BOTTOM }}>
      {children}
    </AbsoluteFill>
  );
}

function wipe(frame: number, delay: number, frames = 14): number {
  const t = interpolate(frame, [delay, delay + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return 1 - (1 - t) ** 3;
}

export function StoryHook({ brand, hook, duration, pal }: { brand: BrandLook; hook: string; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const chip = useSpring(4);
  return (
    <SceneExit duration={duration}>
      <div
        style={{
          position: "absolute",
          top: 190,
          left: PAD,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "12px 30px 12px 12px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.22)",
          opacity: chip,
          transform: `translateY(${(1 - chip) * -30}px)`,
          maxWidth: CONTENT,
        }}
      >
        <LogoTile brand={brand} size={64} pal={pal} />
        <span style={{ color: "#fff", fontSize: 32, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</span>
      </div>
      <TextBlock>
        <BoxedText text={hook} size={fitFontSize(hook, CONTENT - 40, 4, 108, 58)} background={pal.primary} color={pal.onPrimary} reveal={wipe(frame, 6, 16)} />
      </TextBlock>
    </SceneExit>
  );
}

export function StoryPoint({ point, index, duration, pal }: { point: VideoPoint; index: number; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const badge = useSpring(4, { damping: 11, stiffness: 180 });
  const detail = useSpring(16);
  return (
    <SceneExit duration={duration}>
      <TextBlock>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 30,
            background: pal.accent,
            color: pal.onAccent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 46,
            fontWeight: 900,
            marginBottom: 28,
            transform: `scale(${badge}) rotate(${(1 - badge) * -40}deg)`,
            boxShadow: `0 14px 34px ${alpha(pal.accent, 0.45)}`,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        <BoxedText text={point.title} size={fitFontSize(point.title, CONTENT - 40, 3, 88, 52)} background={pal.primary} color={pal.onPrimary} reveal={wipe(frame, 8)} />
        <div
          style={{
            marginTop: 30,
            maxWidth: CONTENT,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.38,
            color: "#ffffff",
            textShadow: "0 2px 18px rgba(0,0,0,0.6)",
            opacity: detail,
            transform: `translateY(${(1 - detail) * 30}px)`,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            ...TEXT_SAFE,
          }}
        >
          {point.detail}
        </div>
      </TextBlock>
    </SceneExit>
  );
}

export function StoryProof({ proof, duration, pal }: { proof: string; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const mark = useSpring(2, { damping: 10, stiffness: 150 });
  return (
    <SceneExit duration={duration}>
      <TextBlock>
        <div style={{ transform: `scale(${mark})`, transformOrigin: "0% 100%", marginBottom: 24 }}><QuoteIcon size={150} color={pal.accent} /></div>
        <BoxedText text={proof} size={fitFontSize(proof, CONTENT - 40, 5, 78, 46)} background="#ffffff" color="#111118" reveal={wipe(frame, 8, 18)} />
      </TextBlock>
    </SceneExit>
  );
}
