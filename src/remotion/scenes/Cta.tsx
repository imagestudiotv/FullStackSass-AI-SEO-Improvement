import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BrandLook } from "../../lib/video/formats";
import { DomainPill, LogoTile, POP, TEXT_SAFE, cleanDomain, useSpring } from "../components/ui";
import { breakFits, fitFontSize, splitHeadline, splitWords } from "../text";
import { alpha, type Palette } from "../theme";

/**
 * The closing card, the same in every style (only the palette changes): the
 * logo with pulsing rings, the brand's name, the call to action and the
 * domain typed into a brand-colour pill.
 */
export function CtaScene({ brand, cta, pal }: { brand: BrandLook; cta: string; pal: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = useSpring(2, { damping: 11, stiffness: 150, mass: 0.8 });
  const name = useSpring(9);
  const [first, second] = splitHeadline(cta);
  const firstWords = splitWords(first);
  const secondWords = splitWords(second);
  const size = fitFontSize(cta, 920, 4, 104, 54);
  const stagger = Math.min(3, 24 / Math.max(1, firstWords.length + secondWords.length));
  const pillDelay = 16 + Math.round((firstWords.length + secondWords.length) * stagger);
  const pill = useSpring(pillDelay);
  const typeFrames = Math.max(10, cleanDomain(brand.domain).length * 1.1);
  const typed = interpolate(frame, [pillDelay + 6, pillDelay + 6 + typeFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settled = frame > pillDelay + 6 + typeFrames;
  const pulse = settled ? 1 + 0.03 * Math.max(0, Math.sin((frame - pillDelay - typeFrames) / 4.5)) : 1;
  const bob = Math.sin(frame / 16) * 8;

  const word = (text: string, i: number, color: string) => {
    const s = spring({ frame: frame - 12 - i * stagger, fps, config: POP });
    return (
      <span key={`${text}-${i}`}>
        <span style={{ display: "inline-block", color, opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 50}px) scale(${0.85 + 0.15 * s})` }}>{text}</span>{" "}
      </span>
    );
  };

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, paddingLeft: 80, paddingRight: 80 }}>
      <div style={{ position: "relative", width: 230, height: 230, transform: `translateY(${bob}px)` }}>
        {[0, 1].map((ring) => {
          const cycle = ((frame + ring * 30) % 60) / 60;
          return (
            <div
              key={ring}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 64,
                border: `4px solid ${alpha(pal.primary, 0.5)}`,
                transform: `scale(${(1 + cycle * 0.75) * logo})`,
                opacity: (1 - cycle) * 0.7 * logo,
              }}
            />
          );
        })}
        <LogoTile brand={brand} size={230} pal={pal} style={{ transform: `scale(${logo}) rotate(${(1 - logo) * -25}deg)` }} />
      </div>
      <div
        style={{
          marginTop: 44,
          fontSize: 50,
          fontWeight: 800,
          color: pal.ink,
          letterSpacing: "-0.02em",
          opacity: name,
          transform: `translateY(${(1 - name) * 24}px)`,
          textAlign: "center",
          ...TEXT_SAFE,
        }}
      >
        {brand.name}
      </div>
      <div
        style={{
          marginTop: 40,
          width: 920,
          textAlign: "center",
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          ...TEXT_SAFE,
        }}
      >
        {firstWords.map((w, i) => word(w, i, pal.ink))}
        {secondWords.length ? breakFits(first, second, size, 920) ? <br /> : " " : null}
        {secondWords.map((w, i) => word(w, firstWords.length + i, pal.highlight))}
      </div>
      <div style={{ marginTop: 64, opacity: pill, transform: `translateY(${(1 - pill) * 40}px) scale(${(0.8 + 0.2 * pill) * pulse})` }}>
        <DomainPill domain={brand.domain} pal={pal} typed={typed} cursor={!settled || Math.floor(frame / 15) % 2 === 0} />
      </div>
    </AbsoluteFill>
  );
}
