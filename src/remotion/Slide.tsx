import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

import { slideCount, type ReelProps, type VideoPoint } from "../lib/video/formats";
import { BrandShapes, KenBurns, MediaShade } from "./components/Media";
import { PopWords } from "./components/PopWords";
import { Ring } from "./components/Ring";
import { AccentBar, ArrowIcon, CheckIcon, DomainPill, LogoTile, QuoteIcon, TEXT_SAFE, cleanDomain } from "./components/ui";
import { FONT } from "./fonts";
import { figureWords } from "./scenes/Bold";
import { BoxedText } from "./scenes/Story";
import { breakFits, decimalsOf, emphasis, findFigure, fitFontSize, formatNumber, splitHeadline, splitWords } from "./text";
import { alpha, palette, type Palette } from "./theme";

/**
 * One carousel slide (4:5, 1080x1350) as a still: the cover with the hook,
 * one slide per point, the proof, the call to action. Each has to read on
 * its own in a feed, so the text is larger than in the reel and every slide
 * carries the brand and its place ("2/6").
 */

export type SlideProps = ReelProps & { index: number };

const W = 1080;
const PADDING = 80;
const CONTENT = W - PADDING * 2;
/** Springs in shared components are settled by then: a still shows them finished. */
const SETTLED = -600;

export function Slide(props: SlideProps) {
  const pal = palette(props.brand, props.style);
  const total = slideCount(props.script);
  const index = Math.max(0, Math.min(total - 1, Math.round(props.index)));
  const n = props.script.points.length;
  const media = props.media.length ? props.media[index % props.media.length] : null;

  let body: ReactNode;
  if (index === 0) body = <Cover {...props} pal={pal} />;
  else if (index <= n) body = <PointSlide {...props} pal={pal} point={props.script.points[index - 1]} number={index} />;
  else if (index === n + 1) body = <ProofSlide {...props} pal={pal} />;
  else body = <CtaSlide {...props} pal={pal} />;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: pal.ink, overflow: "hidden" }}>
      {props.style === "story" ? (
        <>
          {media ? <KenBurns item={media} seed={index} duration={1} pal={pal} still /> : <BrandShapes seed={index} pal={pal} />}
          <MediaShade pal={pal} strength={index === total - 1 ? 1.5 : 1.1} />
        </>
      ) : (
        <SlideBackground pal={pal} />
      )}
      <Header {...props} pal={pal} index={index} total={total} />
      {body}
      <div style={{ position: "absolute", left: PADDING, bottom: 64, display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 700, color: pal.ink, opacity: 0.85 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: pal.highlight }} />
        {cleanDomain(props.brand.domain)}
      </div>
      {index === 0 ? <SwipeHint pal={pal} /> : null}
    </AbsoluteFill>
  );
}

function SlideBackground({ pal }: { pal: Palette }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${pal.bgTop} 0%, ${pal.bgBottom} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 12% 18%, ${pal.glowA} 0%, transparent 50%), radial-gradient(circle at 92% 88%, ${pal.glowB} 0%, transparent 50%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${pal.dark ? "rgba(255,255,255,0.08)" : alpha(pal.ink, 0.06)} 2px, transparent 2.5px)`,
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 0%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
}

function Header({ brand, pal, index, total }: SlideProps & { pal: Palette; total: number }) {
  return (
    <div style={{ position: "absolute", top: 64, left: PADDING, right: PADDING, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <LogoTile brand={brand} size={60} pal={pal} />
        <span style={{ fontSize: 30, fontWeight: 800, color: pal.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</span>
      </div>
      <div
        style={{
          flexShrink: 0,
          padding: "10px 24px",
          borderRadius: 999,
          fontSize: 28,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          color: pal.ink,
          background: pal.dark ? "rgba(255,255,255,0.16)" : alpha(pal.ink, 0.07),
        }}
      >
        {index + 1}/{total}
      </div>
    </div>
  );
}

/** "Swipe" without words (the slides are in the website's language): a pill with dots and an arrow. */
function SwipeHint({ pal }: { pal: Palette }) {
  return (
    <div
      style={{
        position: "absolute",
        right: PADDING,
        bottom: 48,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 22px 16px 28px",
        borderRadius: 999,
        background: pal.primary,
        boxShadow: `0 14px 34px ${alpha(pal.primary, 0.4)}`,
      }}
    >
      {[1, 0.6, 0.35].map((o, i) => (
        <span key={i} style={{ width: i === 0 ? 30 : 12, height: 12, borderRadius: 6, background: pal.onPrimary, opacity: o }} />
      ))}
      <ArrowIcon size={42} color={pal.onPrimary} />
    </div>
  );
}

function Centre({ children, top = 170, bottom = 150, align = "flex-start" }: { children: ReactNode; top?: number; bottom?: number; align?: "flex-start" | "center" }) {
  return (
    <div style={{ position: "absolute", top, bottom, left: PADDING, right: PADDING, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: align }}>
      {children}
    </div>
  );
}

function Cover({ script, style, pal }: SlideProps & { pal: Palette }) {
  const hook = script.hook;
  if (style === "story") {
    return (
      <Centre top={600} bottom={170}>
        <BoxedText text={hook} size={fitFontSize(hook, CONTENT - 40, 4, 104, 56)} background={pal.primary} color={pal.onPrimary} reveal={1} />
      </Centre>
    );
  }
  const words = splitWords(hook);
  const figure = findFigure(hook);
  return (
    <Centre>
      {style === "numbers" && figure ? (
        <div style={{ fontSize: Math.min(260, 900 / (figure.raw.length * 0.62)), fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em", color: pal.highlight, marginBottom: 24 }}>
          {figure.raw.trim()}
        </div>
      ) : (
        <AccentBar color={pal.highlight} progress={1} width={110} style={{ marginBottom: 40 }} />
      )}
      <div style={{ fontSize: fitFontSize(hook, CONTENT, 5, 128, 62), fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.04em", ...TEXT_SAFE }}>
        {style === "numbers" ? (
          <PopWords words={words} delay={SETTLED} stagger={0} color={pal.ink} emphasis={figure ? figureWords(words) : emphasis(words)} box={{ background: pal.highlight, color: pal.onAccent }} />
        ) : (
          <PopWords words={words} delay={SETTLED} stagger={0} color={pal.ink} emphasis={emphasis(words)} emphasisColor={pal.highlight} />
        )}
      </div>
    </Centre>
  );
}

function PointSlide({ style, pal, point, number, script }: SlideProps & { pal: Palette; point: VideoPoint; number: number }) {
  const label = String(number).padStart(2, "0");
  const titleSize = fitFontSize(point.title, CONTENT, 3, 92, 52);
  const detail = (color: string, align: "left" | "center" = "left") => (
    <div style={{ marginTop: 24, fontSize: 38, fontWeight: 500, lineHeight: 1.4, color, textAlign: align, ...TEXT_SAFE }}>{point.detail}</div>
  );

  if (style === "story") {
    return (
      <Centre top={420} bottom={170}>
        <div style={{ width: 96, height: 96, borderRadius: 30, background: pal.accent, color: pal.onAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, fontWeight: 900, marginBottom: 28 }}>
          {label}
        </div>
        <BoxedText text={point.title} size={fitFontSize(point.title, CONTENT - 40, 3, 84, 50)} background={pal.primary} color={pal.onPrimary} reveal={1} />
        <div style={{ marginTop: 26, fontSize: 36, fontWeight: 700, lineHeight: 1.4, color: "#fff", textShadow: "0 2px 18px rgba(0,0,0,0.6)", ...TEXT_SAFE }}>{point.detail}</div>
      </Centre>
    );
  }

  if (style === "numbers") {
    const stat = point.stat;
    const text = stat ? `${formatNumber(stat.value, decimalsOf(stat.value))}${stat.suffix.length <= 3 ? stat.suffix : ""}` : label;
    const fraction = stat ? (stat.suffix.includes("%") ? Math.min(1, stat.value / 100) : 1) : number / script.points.length;
    return (
      <Centre align="center">
        <div style={{ position: "relative", width: 400, height: 400, flexShrink: 0 }}>
          <Ring size={400} stroke={26} fraction={fraction} progress={1} color={pal.highlight} track="rgba(255,255,255,0.1)" />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: Math.min(150, 290 / (text.length * 0.62)), fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: stat ? pal.ink : pal.highlight }}>{text}</div>
            {stat && stat.suffix.length > 3 ? <div style={{ fontSize: 34, fontWeight: 800, color: pal.highlight, marginTop: 6 }}>{stat.suffix}</div> : null}
          </div>
        </div>
        {stat?.label ? (
          <div style={{ marginTop: 36, fontSize: 30, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.highlight, textAlign: "center", ...TEXT_SAFE }}>{stat.label}</div>
        ) : null}
        <div style={{ marginTop: stat?.label ? 12 : 40, fontSize: fitFontSize(point.title, CONTENT, 2, 76, 46), fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", textAlign: "center", ...TEXT_SAFE }}>
          {point.title}
        </div>
        <div style={{ marginTop: 18, fontSize: 34, fontWeight: 500, lineHeight: 1.4, color: pal.inkSoft, textAlign: "center", ...TEXT_SAFE }}>{point.detail}</div>
      </Centre>
    );
  }

  // bold: the point as a ticked card, with the checklist's progress above it.
  return (
    <Centre>
      <div style={{ display: "flex", gap: 14, marginBottom: 34 }}>
        {script.points.map((_, i) => (
          <CheckIcon key={i} size={54} progress={i < number ? 1 : 0} color={pal.highlight} onColor={pal.onPrimary} idle={alpha(pal.ink, 0.16)} />
        ))}
      </div>
      <div style={{ width: CONTENT, padding: "54px 56px 60px", borderRadius: 44, background: pal.card, boxShadow: `0 30px 70px ${alpha(pal.ink, 0.12)}, inset 0 0 0 3px ${pal.highlight}` }}>
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.05em", color: pal.highlight, marginBottom: 22 }}>{label}</div>
        <div style={{ fontSize: Math.min(titleSize, 84), fontWeight: 900, lineHeight: 1.06, letterSpacing: "-0.03em", color: pal.cardInk, ...TEXT_SAFE }}>{point.title}</div>
        {detail(pal.cardInkSoft)}
      </div>
    </Centre>
  );
}

function ProofSlide({ brand, style, script, pal }: SlideProps & { pal: Palette }) {
  const proof = script.proof;
  const words = splitWords(proof);
  if (style === "story") {
    return (
      <Centre top={420} bottom={170}>
        <div style={{ marginBottom: 24 }}><QuoteIcon size={150} color={pal.accent} /></div>
        <BoxedText text={proof} size={fitFontSize(proof, CONTENT - 40, 5, 78, 46)} background="#ffffff" color="#111118" reveal={1} />
      </Centre>
    );
  }
  if (style === "numbers") {
    const figure = findFigure(proof);
    return (
      <Centre align="center">
        {figure ? (
          <div style={{ fontSize: Math.min(250, 880 / (figure.raw.length * 0.62)), fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em", color: pal.highlight, marginBottom: 30 }}>
            {figure.raw.trim()}
          </div>
        ) : (
          <div style={{ marginBottom: 30 }}>
            <QuoteIcon size={160} color={pal.highlight} />
          </div>
        )}
        <div style={{ textAlign: "center", fontSize: fitFontSize(proof, CONTENT, 5, 76, 44), fontWeight: 800, lineHeight: 1.16, letterSpacing: "-0.025em", ...TEXT_SAFE }}>
          <PopWords words={words} delay={SETTLED} stagger={0} color={pal.ink} emphasis={figure ? figureWords(words) : emphasis(words)} box={{ background: pal.highlight, color: pal.onAccent }} />
        </div>
      </Centre>
    );
  }
  return (
    <Centre top={200}>
      <div style={{ position: "relative", width: CONTENT, padding: "100px 64px 56px", borderRadius: 44, background: pal.card, boxShadow: `0 30px 70px ${alpha(pal.ink, 0.12)}` }}>
        <div
          style={{
            position: "absolute",
            top: -56,
            left: 64,
            width: 112,
            height: 112,
            borderRadius: 34,
            background: pal.highlight,
            color: pal.onPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-6deg)",
          }}
        >
          <QuoteIcon size={66} color={pal.onPrimary} />
        </div>
        <div style={{ fontSize: fitFontSize(proof, CONTENT - 128, 6, 70, 42), fontWeight: 800, lineHeight: 1.16, letterSpacing: "-0.025em", ...TEXT_SAFE }}>
          <PopWords words={words} delay={SETTLED} stagger={0} color={pal.cardInk} emphasis={figureWords(words)} emphasisColor={pal.highlight} />
        </div>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18 }}>
          <LogoTile brand={brand} size={60} pal={pal} />
          <span style={{ fontSize: 30, fontWeight: 800, color: pal.cardInk }}>{brand.name}</span>
        </div>
      </div>
    </Centre>
  );
}

function CtaSlide({ brand, script, pal }: SlideProps & { pal: Palette }) {
  const [first, second] = splitHeadline(script.cta);
  return (
    <Centre align="center">
      <LogoTile brand={brand} size={190} pal={pal} />
      <div style={{ marginTop: 34, fontSize: 46, fontWeight: 800, color: pal.ink, textAlign: "center", ...TEXT_SAFE }}>{brand.name}</div>
      <div style={{ marginTop: 34, textAlign: "center", fontSize: fitFontSize(script.cta, CONTENT, 4, 96, 52), fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.035em", ...TEXT_SAFE }}>
        <span style={{ color: pal.ink }}>{first}</span>
        {second ? (
          <>
            {breakFits(first, second, fitFontSize(script.cta, CONTENT, 4, 96, 52), CONTENT) ? <br /> : " "}
            <span style={{ color: pal.highlight }}>{second}</span>
          </>
        ) : null}
      </div>
      <div style={{ marginTop: 56 }}>
        <DomainPill domain={brand.domain} pal={pal} />
      </div>
    </Centre>
  );
}
