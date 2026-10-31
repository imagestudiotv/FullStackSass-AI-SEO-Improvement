import { useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig, type SpringConfig } from "remotion";

import type { BrandLook } from "../../lib/video/formats";
import { alpha, mix, type Palette } from "../theme";

/**
 * Building blocks shared by the three styles and the carousel slides. Parts
 * that animate take their progress as a prop where a still slide needs them
 * finished, and read the frame themselves where only the reel uses them.
 */

/** Side margin of every scene. */
export const PAD = 80;

/** Springy but settled within ~0.6 s: the reference reel's motion. */
export const POP: Partial<SpringConfig> = { damping: 14, stiffness: 170, mass: 0.7 };
export const SOFT: Partial<SpringConfig> = { damping: 200, stiffness: 120, mass: 1 };

export function useSpring(delay: number, config: Partial<SpringConfig> = POP): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

/** 0 -> 1 over the last `frames` frames of a scene `duration` long, for the exit. */
export function useExit(duration: number, frames = 9): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [duration - frames, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** A scene's foreground, leaving upwards in its last frames. */
export function SceneExit({ duration, children, style }: { duration: number; children: ReactNode; style?: CSSProperties }) {
  const exit = useExit(duration);
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `translateY(${-50 * exit}px) scale(${1 - 0.03 * exit})`, ...style }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * The scene background: the palette's gradient with two soft glows that
 * drift and a faint dot grid, so nothing is ever completely still.
 */
export function Background({ pal, seed = 0 }: { pal: Palette; seed?: number }) {
  const frame = useCurrentFrame();
  const t = frame / 30 + seed * 7;
  const zoom = 1.04 + 0.04 * Math.sin(t / 5);
  const glow = (color: string, x: number, y: number, size: number): CSSProperties => ({
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${pal.bgTop} 0%, ${pal.bgBottom} 100%)`, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div style={glow(pal.glowA, 18 + 10 * Math.sin(t / 3.1), 22 + 8 * Math.cos(t / 3.7), 1300)} />
        <div style={glow(pal.glowB, 86 + 9 * Math.cos(t / 2.9), 74 + 9 * Math.sin(t / 3.3), 1200)} />
        <div style={glow(pal.dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", 50 + 6 * Math.sin(t / 4), 46, 1000)} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${pal.dark ? "rgba(255,255,255,0.09)" : alpha(pal.ink, 0.07)} 2px, transparent 2.5px)`,
          backgroundSize: "46px 46px",
          backgroundPosition: `${(frame * 0.25) % 46}px ${(frame * 0.5) % 46}px`,
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 0%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
}

/** A check in a circle; the circle fills and the tick draws itself as `progress` goes 0 -> 1. */
export function CheckIcon({ size, progress, color, onColor, idle }: { size: number; progress: number; color: string; onColor: string; idle: string }) {
  const fill = interpolate(progress, [0, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const draw = interpolate(progress, [0.3, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const length = 30;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0, overflow: "visible" }}>
      <circle cx="24" cy="24" r="21" fill="none" stroke={idle} strokeWidth="3" />
      <circle cx="24" cy="24" r={22 * fill} fill={color} />
      <path
        d="M14.5 24.5 L21 31 L34 17.5"
        fill="none"
        stroke={onColor}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - draw)}
      />
    </svg>
  );
}

/** The brand's logo on a white rounded tile, or its initial when there is no logo (or it fails to load). */
export function LogoTile({ brand, size, pal, style }: { brand: BrandLook; size: number; pal: Palette; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  const initial = (brand.name.trim()[0] ?? "•").toUpperCase();
  const showLogo = Boolean(brand.logoUrl) && !failed;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: showLogo ? "#ffffff" : `linear-gradient(145deg, ${mix(brand.primary, "#ffffff", 0.12)} 0%, ${mix(brand.primary, "#000000", 0.18)} 100%)`,
        boxShadow: `0 ${size * 0.08}px ${size * 0.22}px ${alpha(pal.dark ? "#000000" : brand.primary, pal.dark ? 0.4 : 0.28)}, inset 0 0 0 ${Math.max(1, size * 0.01)}px rgba(255,255,255,0.35)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {showLogo ? (
        <Img
          src={brand.logoUrl ?? ""}
          onError={() => setFailed(true)}
          style={{ width: "72%", height: "72%", objectFit: "contain" }}
        />
      ) : (
        <span style={{ color: pal.onPrimary, fontSize: size * 0.52, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em" }}>{initial}</span>
      )}
    </div>
  );
}

/** The small capitals above a headline. */
export function Eyebrow({ text, color, size = 30 }: { text: string; color: string; size?: number }) {
  return (
    <div style={{ color, fontSize: size, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1.2 }}>{text}</div>
  );
}

/** The short bar under a headline; grows in with `progress`. */
export function AccentBar({ color, progress, width = 84, style }: { color: string; progress: number; width?: number; style?: CSSProperties }) {
  return <div style={{ width: width * progress, height: 10, borderRadius: 5, background: color, ...style }} />;
}

/** A thin-line globe for the domain pill. */
export function GlobeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5c-2.6-2.7-3.9-5.9-3.9-9.5s1.3-6.8 3.9-9.5z" />
    </svg>
  );
}

export function ArrowIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** The domain without the scheme or a trailing slash. */
export function cleanDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** The domain in a brand-colour pill; `typed` 0 -> 1 types it out. */
export function DomainPill({ domain, pal, typed = 1, fontSize = 42, cursor = false }: { domain: string; pal: Palette; typed?: number; fontSize?: number; cursor?: boolean }) {
  const text = cleanDomain(domain);
  const shown = text.slice(0, Math.round(text.length * typed));
  const size = Math.min(fontSize, Math.round(1500 / Math.max(10, text.length)));
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.5}px ${size * 0.55}px ${size * 0.5}px ${size * 0.75}px`,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${mix(pal.primary, "#ffffff", 0.08)} 0%, ${mix(pal.primary, "#000000", 0.12)} 100%)`,
        color: pal.onPrimary,
        boxShadow: `0 18px 44px ${alpha(pal.primary, 0.42)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      <GlobeIcon size={size * 1.05} color={pal.onPrimary} />
      <span style={{ position: "relative" }}>
        <span style={{ visibility: "hidden" }}>{text}</span>
        <span style={{ position: "absolute", left: 0, top: 0 }}>
          {shown}
          {cursor ? <span style={{ display: "inline-block", width: size * 0.09, height: size * 1.05, marginLeft: 3, verticalAlign: "-0.15em", background: pal.onPrimary }} /> : null}
        </span>
      </span>
      <span
        style={{
          width: size * 1.45,
          height: size * 1.45,
          borderRadius: "50%",
          background: alpha(pal.onPrimary, 0.16),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowIcon size={size * 0.85} color={pal.onPrimary} />
      </span>
    </div>
  );
}

/**
 * A word-safe headline: wraps anywhere as a last resort (a German compound
 * the size heuristic underestimated) rather than overflowing the frame.
 */
export const TEXT_SAFE: CSSProperties = { overflowWrap: "anywhere", wordBreak: "normal", hyphens: "manual" };

/** A solid opening quote mark (the font's own glyph is too thin at heavy weights). */
export function QuoteIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path
        fill={color}
        d="M8 36V27.5C8 18.6 12.3 12.6 20.4 9.6l2 4.2c-4.3 1.9-6.6 5-7 9.2H21v13H8zm19 0V27.5c0-8.9 4.3-14.9 12.4-17.9l2 4.2c-4.3 1.9-6.6 5-7 9.2H40v13H27z"
      />
    </svg>
  );
}
