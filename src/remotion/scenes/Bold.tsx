import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BrandLook, VideoPoint } from "../../lib/video/formats";
import { PopWords } from "../components/PopWords";
import { AccentBar, CheckIcon, Eyebrow, LogoTile, PAD, POP, QuoteIcon, SceneExit, TEXT_SAFE, useSpring } from "../components/ui";
import { breakFits, emphasis, findFigure, fitFontSize, formatNumber, splitHeadline, splitWords } from "../text";
import { alpha, mix, type Palette } from "../theme";

/**
 * The "bold" style - the Ootto reel the client sent: a pale brand-tinted
 * page, heavy dark headlines with the second line in the brand colour, and
 * a checklist of white cards that ticks itself off point by point.
 */

const CONTENT = 1080 - PAD * 2;

/** The hook: logo -> a fanned stack of brand cards, then the headline word by word. */
export function BoldHook({ brand, hook, duration, pal }: { brand: BrandLook; hook: string; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = splitWords(hook);
  const size = fitFontSize(hook, CONTENT, 4, 112, 60);
  const logo = useSpring(0, { damping: 12, stiffness: 160, mass: 0.7 });
  const draw = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stack = useSpring(10, { damping: 13, stiffness: 120, mass: 0.9 });
  const fan = spring({ frame: frame - 16, fps, config: { damping: 15, stiffness: 90 } });
  const figure = findFigure(hook);
  const count = interpolate(frame, [18, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - (1 - count) ** 3;
  const bob = Math.sin(frame / 14) * 10;
  const stagger = Math.min(3.5, (duration * 0.4) / Math.max(1, words.length));
  // The word after the figure labels it on the card ("30 / REELS").
  const label = figure ? splitWords(figure.after)[0]?.replace(/[.,!?;:"'«»“”„()]/g, "") ?? "" : "";
  const backs = [mix(pal.primary, "#000000", 0.55), mix(pal.primary, "#ffffff", 0.55), mix(pal.primary, "#000000", 0.3), mix(pal.primary, "#ffffff", 0.25)];

  return (
    <SceneExit duration={duration}>
      <div style={{ position: "absolute", top: 300, left: 0, width: 1080, height: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <div style={{ transform: `translateY(${-bob * 0.6}px) rotate(-7deg) scale(${logo})` }}>
          <LogoTile brand={brand} size={200} pal={pal} />
        </div>
        <svg width="170" height="120" viewBox="0 0 170 120" style={{ overflow: "visible", marginTop: -40 }}>
          <path d="M8 92 C 40 18, 112 6, 150 60" fill="none" stroke={pal.ink} strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          <path
            d="M124 56 L151 62 L154 34"
            fill="none"
            stroke={pal.ink}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={draw > 0.9 ? 1 : 0}
          />
        </svg>
        <div style={{ position: "relative", width: 300, height: 390, transform: `translateY(${bob}px) scale(${0.6 + 0.4 * stack})`, opacity: Math.min(1, stack * 1.5) }}>
          {backs.map((background, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 34,
                background,
                border: "5px solid #ffffff",
                boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
                transform: `translateX(${(i - 4) * 9 * fan}px) rotate(${(-14 + i * 4) * fan}deg)`,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 34,
              background: `linear-gradient(150deg, ${mix(pal.primary, "#ffffff", 0.12)} 0%, ${mix(pal.primary, "#000000", 0.14)} 100%)`,
              border: "5px solid #ffffff",
              boxShadow: `0 30px 60px ${alpha(pal.primary, 0.45)}`,
              transform: `rotate(${6 * fan}deg)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: pal.onPrimary,
              padding: 24,
              overflow: "hidden",
            }}
          >
            {figure ? (
              <>
                <div style={{ fontSize: figure.raw.length > 4 ? 96 : 150, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>
                  {figure.prefix}
                  {formatNumber(figure.value * eased, figure.decimals)}
                  {figure.suffix}
                </div>
                {label ? (
                  <div style={{ marginTop: 10, fontSize: Math.min(34, 560 / Math.max(6, label.length)), fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>{label}</div>
                ) : null}
              </>
            ) : (
              <>
                <CheckIcon size={130} progress={count} color={pal.onPrimary} onColor={pal.primary} idle={alpha(pal.onPrimary, 0.3)} />
                {[0.9, 0.7, 0.8].map((width, i) => (
                  <div
                    key={i}
                    style={{
                      marginTop: i === 0 ? 34 : 16,
                      height: 16,
                      borderRadius: 8,
                      width: `${width * 100 * interpolate(frame, [24 + i * 4, 40 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
                      background: alpha(pal.onPrimary, 0.75 - i * 0.15),
                      alignSelf: "flex-start",
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 860,
          left: PAD,
          width: CONTENT,
          textAlign: "center",
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.035em",
          color: pal.ink,
          ...TEXT_SAFE,
        }}
      >
        <PopWords words={words} delay={8} stagger={stagger} color={pal.ink} emphasis={emphasis(words)} emphasisColor={pal.highlight} />
      </div>
    </SceneExit>
  );
}

/** The headline block of the inner scenes: eyebrow, two-tone headline, accent bar. */
export function BoldHeader({ eyebrow, headline, pal, enter }: { eyebrow: string; headline: string; pal: Palette; enter: number }) {
  const [first, second] = splitHeadline(headline);
  const size = fitFontSize(headline, CONTENT, 3, 92, 54);
  return (
    <div style={{ opacity: Math.min(1, enter * 1.4), transform: `translateY(${(1 - enter) * 40}px)` }}>
      <Eyebrow text={eyebrow} color={pal.highlight} />
      <div style={{ marginTop: 14, fontSize: size, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.035em", ...TEXT_SAFE }}>
        <span style={{ color: pal.ink }}>{first}</span>
        {second ? (
          <>
            {breakFits(first, second, size, CONTENT) ? <br /> : " "}
            <span style={{ color: pal.highlight }}>{second}</span>
          </>
        ) : null}
      </div>
      <AccentBar color={pal.highlight} progress={enter} style={{ marginTop: 26 }} />
    </div>
  );
}

/**
 * All the points as one checklist scene: every item is laid out from the
 * start (ghosted), and as the voice reaches a point its card lights up, its
 * check draws and its detail opens; done items stay ticked.
 */
export function BoldChecklist({
  brand,
  hook,
  points,
  pointStarts,
  duration,
  pal,
}: {
  brand: BrandLook;
  hook: string;
  points: VideoPoint[];
  /** Start frame of each point, relative to this scene. */
  pointStarts: number[];
  duration: number;
  pal: Palette;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useSpring(0, { damping: 18, stiffness: 140 });
  const titleSize = Math.min(...points.map((p) => fitFontSize(p.title, 700, 2, 44, 30)));

  return (
    <SceneExit duration={duration}>
      <div style={{ position: "absolute", top: 230, left: PAD, width: CONTENT }}>
        <BoldHeader eyebrow={brand.name} headline={hook} pal={pal} enter={enter} />
        <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 18 }}>
          {points.map((point, i) => {
            const appear = spring({ frame: frame - 4 - i * 4, fps, config: { damping: 16, stiffness: 140 } });
            const start = pointStarts[i] + (i === 0 ? 8 : 2);
            const on = spring({ frame: frame - start, fps, config: POP });
            const off = i + 1 < points.length ? spring({ frame: frame - pointStarts[i + 1], fps, config: { damping: 20, stiffness: 120 } }) : 0;
            const check = spring({ frame: frame - start - 5, fps, config: { damping: 16, stiffness: 110 } });
            // Springs overshoot a hair past 1; a negative max-height would be ignored.
            const active = Math.max(0, Math.min(1, on * (1 - off)));
            const reached = Math.min(1, on);
            const ripple = interpolate(frame, [start + 10, start + 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 26,
                  alignItems: "flex-start",
                  padding: "28px 32px",
                  borderRadius: 30,
                  background: reached > 0.01 ? `rgba(255,255,255,${0.5 + 0.5 * reached})` : "rgba(255,255,255,0.5)",
                  boxShadow: `0 ${6 + 20 * active}px ${18 + 40 * active}px ${alpha(pal.ink, 0.04 + 0.08 * active)}, inset 0 0 0 ${3 * active}px ${pal.highlight}`,
                  opacity: Math.min(1, appear * 1.4) * (0.42 + 0.58 * reached),
                  transform: `translateY(${(1 - appear) * 60}px) scale(${1 + 0.03 * active})`,
                  transformOrigin: "50% 50%",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0, marginTop: 2 }}>
                  <CheckIcon size={60} progress={check} color={pal.highlight} onColor={pal.onPrimary} idle={alpha(pal.ink, 0.14)} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: `3px solid ${pal.highlight}`,
                      transform: `scale(${1 + ripple * 1.2})`,
                      opacity: ripple > 0 && ripple < 1 ? (1 - ripple) * 0.6 : 0,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", color: pal.cardInk, ...TEXT_SAFE }}>{point.title}</div>
                  <div
                    style={{
                      maxHeight: 128 * active,
                      overflow: "hidden",
                      opacity: active,
                      marginTop: 10 * active,
                      fontSize: 30,
                      fontWeight: 500,
                      lineHeight: 1.35,
                      color: pal.cardInkSoft,
                      ...TEXT_SAFE,
                    }}
                  >
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{point.detail}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneExit>
  );
}

/** The proof: one striking line on a big white card with a quote mark. */
export function BoldProof({ brand, proof, duration, pal }: { brand: BrandLook; proof: string; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const card = useSpring(0, { damping: 15, stiffness: 120, mass: 0.9 });
  const quote = useSpring(8, { damping: 10, stiffness: 160 });
  const footer = useSpring(14);
  const words = splitWords(proof);
  const size = fitFontSize(proof, 780, 6, 76, 44);
  const stagger = Math.min(2.5, (duration * 0.4) / Math.max(1, words.length));
  const sway = Math.sin(frame / 20) * 0.6;

  return (
    <SceneExit duration={duration}>
      <div
        style={{
          position: "absolute",
          left: PAD,
          width: CONTENT,
          top: 440,
          padding: "110px 70px 64px",
          borderRadius: 48,
          background: pal.card,
          boxShadow: `0 40px 90px ${alpha(pal.ink, 0.13)}, 0 0 0 1px ${pal.cardBorder}`,
          transform: `translateY(${(1 - card) * 120}px) scale(${0.92 + 0.08 * card}) rotate(${(1 - card) * -3 + sway}deg)`,
          opacity: Math.min(1, card * 1.5),
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -64,
            left: 70,
            width: 128,
            height: 128,
            borderRadius: 40,
            background: pal.highlight,
            color: pal.onPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 20px 40px ${alpha(pal.highlight, 0.4)}`,
            transform: `scale(${quote}) rotate(${(1 - quote) * 30 - 6}deg)`,
          }}
        >
          <QuoteIcon size={76} color={pal.onPrimary} />
        </div>
        <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.14, letterSpacing: "-0.025em", color: pal.cardInk, ...TEXT_SAFE }}>
          <PopWords words={words} delay={10} stagger={stagger} color={pal.cardInk} emphasis={figureWords(words)} emphasisColor={pal.highlight} />
        </div>
        <div style={{ marginTop: 50, display: "flex", alignItems: "center", gap: 20, opacity: footer, transform: `translateX(${(1 - footer) * -30}px)` }}>
          <LogoTile brand={brand} size={64} pal={pal} />
          <div style={{ fontSize: 32, fontWeight: 800, color: pal.cardInk, ...TEXT_SAFE }}>{brand.name}</div>
        </div>
      </div>
    </SceneExit>
  );
}

/** Words of a sentence that hold a figure, to colour them. */
export function figureWords(words: string[]): Set<number> {
  return new Set(words.flatMap((word, i) => (/\d/.test(word) ? [i] : [])));
}
