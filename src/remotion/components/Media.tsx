import { useState } from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, useCurrentFrame } from "remotion";

import type { MediaItem } from "../../lib/video/formats";
import { alpha, mix, type Palette } from "../theme";

/**
 * Full-bleed backgrounds for the story style: the website's pictures and the
 * customer's clips with a slow Ken Burns move, or - without any media, or
 * when a file fails to load - drifting brand-colour shapes.
 */

/** A slow zoom and pan; the direction changes with `seed` so cuts feel different. */
export function KenBurns({ item, seed, duration, pal, still = false }: { item: MediaItem; seed: number; duration: number; pal: Palette; still?: boolean }) {
  const frame = useCurrentFrame();
  const [failed, setFailed] = useState(false);
  const t = still ? 0.5 : interpolate(frame, [0, Math.max(1, duration)], [0, 1], { extrapolateRight: "clamp" });
  const zoomIn = random(`kb-zoom-${seed}`) > 0.4;
  const scale = zoomIn ? 1.06 + 0.16 * t : 1.22 - 0.14 * t;
  const dx = (random(`kb-x-${seed}`) - 0.5) * 70 * (t - 0.5);
  const dy = (random(`kb-y-${seed}`) - 0.5) * 90 * (t - 0.5);
  if (failed) return <BrandShapes seed={seed} pal={pal} />;
  const style = { width: "100%", height: "100%", objectFit: "cover" as const, transform: `scale(${scale}) translate(${dx}px, ${dy}px)` };
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      {item.kind === "video" ? (
        <OffthreadVideo src={item.url} muted style={style} onError={() => setFailed(true)} />
      ) : (
        <Img src={item.url} style={style} onError={() => setFailed(true)} />
      )}
    </AbsoluteFill>
  );
}

/** The dark wash that keeps white text legible on any picture. */
export function MediaShade({ pal, strength = 1 }: { pal: Palette; strength?: number }) {
  return (
    <>
      <AbsoluteFill style={{ background: alpha(pal.primary, 0.16 * strength), mixBlendMode: "multiply" }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${0.5 * strength}) 0%, rgba(0,0,0,${0.12 * strength}) 26%, rgba(0,0,0,${0.35 * strength}) 48%, rgba(0,0,0,${0.82 * strength}) 74%, rgba(0,0,0,${0.9 * strength}) 100%)`,
        }}
      />
    </>
  );
}

/** Soft brand shapes drifting over a deep gradient (no media to show). */
export function BrandShapes({ seed, pal }: { seed: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const primary = pal.primary;
  const accent = pal.accent;
  const t = frame / 30;
  const shapes = Array.from({ length: 5 }, (_, i) => {
    const r = (key: string) => random(`shape-${seed}-${i}-${key}`);
    const size = 380 + r("s") * 520;
    return {
      size,
      x: r("x") * 1080 + Math.sin(t / (2 + r("p")) + i) * 60,
      y: r("y") * 1920 + Math.cos(t / (2.4 + r("q")) + i) * 80,
      rotate: r("r") * 90 + t * (r("v") - 0.5) * 24,
      round: i % 2 === 0 ? "50%" : `${size * 0.22}px`,
      color: i % 3 === 0 ? accent : mix(primary, "#ffffff", r("c") * 0.35),
      alpha: 0.28 + r("a") * 0.3,
    };
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${mix(primary, "#000000", 0.25)} 0%, ${mix(primary, "#05050a", 0.7)} 100%)`, overflow: "hidden" }}>
      {shapes.map((shape, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: shape.x - shape.size,
            top: shape.y - shape.size,
            width: shape.size * 2,
            height: shape.size * 2,
            background: `radial-gradient(circle closest-side, ${alpha(shape.color, shape.alpha + 0.15)} 0%, ${alpha(shape.color, 0)} 100%)`,
          }}
        />
      ))}
      {/* Crisp outlines turning slowly over the glows: the motion-graphics layer. */}
      {shapes.slice(0, 3).map((shape, i) => (
        <div
          key={`line-${i}`}
          style={{
            position: "absolute",
            left: shape.x - shape.size * 0.4,
            top: shape.y - shape.size * 0.4,
            width: shape.size * 0.8,
            height: shape.size * 0.8,
            borderRadius: shape.round,
            border: `3px solid ${alpha(i === 0 ? accent : "#ffffff", 0.22)}`,
            transform: `rotate(${shape.rotate * 1.6}deg)`,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 2px, transparent 2.5px)",
          backgroundSize: "46px 46px",
          backgroundPosition: `${(frame * 0.3) % 46}px ${(frame * 0.6) % 46}px`,
        }}
      />
    </AbsoluteFill>
  );
}
