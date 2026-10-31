import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import type { VideoPoint } from "../../lib/video/formats";
import { PopWords } from "../components/PopWords";
import { Ring } from "../components/Ring";
import { PAD, QuoteIcon, SceneExit, TEXT_SAFE, useSpring } from "../components/ui";
import { decimalsOf, emphasis, findFigure, fitFontSize, formatNumber, splitWords, type Figure } from "../text";
import { alpha, type Palette } from "../theme";
import { figureWords } from "./Bold";

/**
 * The "numbers" style: a deep brand gradient where every point is a figure -
 * a counter that runs up inside a gauge - and the hook and proof lean on
 * the biggest number in them.
 */

const CONTENT = 1080 - PAD * 2;

/** 0 -> 1 with a strong ease-out, for counters (fast start, gentle landing). */
function useCount(delay: number, frames: number): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

/** A figure counting up: the number big, a short suffix beside it in the accent colour. */
function Counter({ value, decimals, prefix, suffix, progress, size, pal }: { value: number; decimals: number; prefix: string; suffix: string; progress: number; size: number; pal: Palette }) {
  const shortSuffix = suffix.length <= 3;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: size, fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.055em", color: pal.ink, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {prefix}
        {formatNumber(value * progress, decimals)}
        {shortSuffix && suffix ? <span style={{ color: pal.highlight, fontSize: size * 0.55, marginLeft: size * 0.04 }}>{suffix}</span> : null}
      </div>
      {!shortSuffix ? <div style={{ marginTop: 10, fontSize: Math.min(44, 900 / suffix.length), fontWeight: 800, color: pal.highlight }}>{suffix}</div> : null}
    </div>
  );
}

function counterSize(text: string, width: number, max: number): number {
  return Math.round(Math.min(max, width / (Math.max(1, text.length) * 0.62)));
}

/** A slowly turning arc decoration behind a headline. */
function Orbit({ size, pal, top }: { size: number; pal: Palette; top: number }) {
  const frame = useCurrentFrame();
  const draw = useCount(0, 40);
  return (
    <div style={{ position: "absolute", left: 540 - size / 2, top, width: size, height: size, transform: `rotate(${frame * 0.6}deg)`, opacity: 0.45 }}>
      <Ring size={size} stroke={6} fraction={0.72} progress={draw} color={alpha(pal.highlight, 0.55)} track="rgba(255,255,255,0.05)" />
      <div style={{ position: "absolute", inset: 70, transform: `rotate(${-frame * 1.4}deg)` }}>
        <Ring size={size - 140} stroke={3} fraction={0.4} progress={draw} color="rgba(255,255,255,0.4)" track="transparent" />
      </div>
    </div>
  );
}

export function NumbersHook({ hook, duration, pal }: { hook: string; duration: number; pal: Palette }) {
  const figure = findFigure(hook);
  const words = splitWords(hook);
  const size = fitFontSize(hook, CONTENT, 5, figure ? 100 : 124, 58);
  const count = useCount(4, 36);
  const big = useSpring(0, { damping: 12, stiffness: 120 });
  const stagger = Math.min(3.5, (duration * 0.4) / Math.max(1, words.length));
  return (
    <SceneExit duration={duration}>
      <Orbit size={figure ? 640 : 820} pal={pal} top={figure ? 300 : 360} />
      <AbsoluteFill style={{ top: 260, height: 1060, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `0 ${PAD}px` }}>
        {figure ? (
          <div style={{ transform: `scale(${0.6 + 0.4 * big})`, opacity: Math.min(1, big * 1.5), marginBottom: 40 }}>
            <Counter value={figure.value} decimals={figure.decimals} prefix={figure.prefix} suffix={figure.suffix} progress={count} size={counterSize(figure.raw, 820, 300)} pal={pal} />
          </div>
        ) : null}
        <div style={{ width: CONTENT, textAlign: "center", fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.035em", ...TEXT_SAFE }}>
          <PopWords
            words={words}
            delay={figure ? 10 : 4}
            stagger={stagger}
            color={pal.ink}
            emphasis={figure ? figureWords(words) : emphasis(words)}
            box={{ background: pal.highlight, color: pal.onAccent }}
          />
        </div>
      </AbsoluteFill>
    </SceneExit>
  );
}

export function NumbersPoint({ point, index, total, duration, pal }: { point: VideoPoint; index: number; total: number; duration: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const head = useSpring(0);
  const gauge = useSpring(2, { damping: 14, stiffness: 110 });
  const count = useCount(6, Math.min(45, duration * 0.5));
  const title = useSpring(10);
  const detail = useSpring(16);
  const stat = point.stat;
  const fraction = stat ? (stat.suffix.includes("%") ? Math.min(1, stat.value / 100) : 1) : (index + 1) / total;
  const number = String(index + 1).padStart(2, "0");
  const glow = 0.5 + 0.5 * Math.sin(frame / 10);
  const statText = stat ? `${formatNumber(stat.value, decimalsOf(stat.value))}${stat.suffix.length <= 3 ? stat.suffix : ""}` : "";

  return (
    <SceneExit duration={duration}>
      <div style={{ position: "absolute", top: 250, left: PAD, width: CONTENT, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "baseline", gap: 10, opacity: head, transform: `translateX(${(1 - head) * -40}px)` }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: pal.highlight }}>{number}</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: pal.inkSoft }}>/ {String(total).padStart(2, "0")}</span>
        </div>
        <div style={{ position: "relative", width: 500, height: 500, marginTop: 30, transform: `scale(${0.7 + 0.3 * gauge}) rotate(${(1 - gauge) * -40}deg)`, opacity: Math.min(1, gauge * 1.5) }}>
          <div style={{ position: "absolute", inset: 40, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(pal.highlight, 0.12 + 0.08 * glow)} 0%, transparent 70%)` }} />
          <Ring size={500} stroke={30} fraction={fraction} progress={count} color={pal.highlight} track="rgba(255,255,255,0.09)" />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {stat ? (
              <Counter value={stat.value} decimals={decimalsOf(stat.value)} prefix="" suffix={stat.suffix} progress={count} size={counterSize(statText, 360, 180)} pal={pal} />
            ) : (
              <div
                style={{
                  fontSize: 230,
                  fontWeight: 900,
                  letterSpacing: "-0.06em",
                  lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: `5px ${pal.highlight}`,
                  padding: "0 0.08em",
                  backgroundImage: `linear-gradient(0deg, ${pal.highlight} ${count * 100}%, transparent ${count * 100}%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                }}
              >
                {number}
              </div>
            )}
          </div>
        </div>
        {stat?.label ? (
          <div style={{ marginTop: 44, fontSize: 30, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.highlight, textAlign: "center", opacity: title, ...TEXT_SAFE }}>
            {stat.label}
          </div>
        ) : null}
        <div
          style={{
            marginTop: stat?.label ? 14 : 50,
            fontSize: fitFontSize(point.title, CONTENT, 2, 70, 44),
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: pal.ink,
            textAlign: "center",
            opacity: title,
            transform: `translateY(${(1 - title) * 40}px)`,
            ...TEXT_SAFE,
          }}
        >
          {point.title}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.38,
            color: pal.inkSoft,
            textAlign: "center",
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
      </div>
    </SceneExit>
  );
}

export function NumbersProof({ proof, duration, pal }: { proof: string; duration: number; pal: Palette }) {
  const figure: Figure | null = findFigure(proof);
  const words = splitWords(proof);
  const size = fitFontSize(proof, CONTENT, 5, figure ? 72 : 92, 44);
  const count = useCount(4, 40);
  const big = useSpring(0, { damping: 12, stiffness: 120 });
  const bar = useCount(14, 40);
  const stagger = Math.min(2.5, (duration * 0.4) / Math.max(1, words.length));
  return (
    <SceneExit duration={duration}>
      <AbsoluteFill style={{ top: 240, height: 1080, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `0 ${PAD}px` }}>
        {figure ? (
          <div style={{ transform: `scale(${0.6 + 0.4 * big})`, opacity: Math.min(1, big * 1.5), marginBottom: 40 }}>
            <Counter value={figure.value} decimals={figure.decimals} prefix={figure.prefix} suffix={figure.suffix} progress={count} size={counterSize(figure.raw, 860, 280)} pal={pal} />
          </div>
        ) : (
          <div style={{ transform: `scale(${big})`, marginBottom: 30 }}><QuoteIcon size={170} color={pal.highlight} /></div>
        )}
        <div style={{ width: CONTENT, textAlign: "center", fontSize: size, fontWeight: 800, lineHeight: 1.14, letterSpacing: "-0.025em", ...TEXT_SAFE }}>
          <PopWords
            words={words}
            delay={10}
            stagger={stagger}
            color={pal.ink}
            emphasis={figure ? figureWords(words) : emphasis(words)}
            box={{ background: pal.highlight, color: pal.onAccent }}
          />
        </div>
        <div style={{ marginTop: 60, width: 520, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{ width: `${bar * 100}%`, height: "100%", borderRadius: 7, background: `linear-gradient(90deg, ${alpha(pal.highlight, 0.6)}, ${pal.highlight})`, boxShadow: `0 0 24px ${pal.highlight}` }} />
        </div>
      </AbsoluteFill>
    </SceneExit>
  );
}
