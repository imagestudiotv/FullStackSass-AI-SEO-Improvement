import { alpha } from "../theme";

/** A progress ring (the numbers style's gauge); `progress` 0 -> 1 sweeps it to `fraction`. */
export function Ring({ size, stroke, fraction, progress, color, track }: { size: number; stroke: number; fraction: number; progress: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, fraction)) * progress;
  const c = size / 2;
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", overflow: "visible" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={alpha(color, 0.25)} strokeWidth={stroke * 1.9} strokeDasharray={`${length * shown} ${length}`} strokeLinecap="round" opacity={shown > 0.002 ? 1 : 0} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${length * shown} ${length}`} strokeLinecap="round" opacity={shown > 0.002 ? 1 : 0} />
    </svg>
  );
}
