import type { ConsumptionPoint } from "../../api/useBuffersStream.js";

/**
 * Tiny inline trend indicator, no axes. Necessarily starts blank on page
 * load and fills in as SSE frames arrive — there's no historical
 * time-series endpoint behind this, only what's been observed live.
 */
export function Sparkline({
  points,
  width = 64,
  height = 18,
}: {
  points: ConsumptionPoint[];
  width?: number;
  height?: number;
}) {
  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return <svg width={width} height={height} className="opacity-40" />;
  }

  const min = Math.min(0, ...values);
  const max = Math.max(0.01, ...values);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  let d = "";
  let started = false;
  points.forEach((p, i) => {
    if (p.v === null) {
      started = false;
      return;
    }
    const x = i * step;
    const y = height - ((p.v - min) / range) * height;
    d += started ? ` L${x},${y}` : ` M${x},${y}`;
    started = true;
  });

  const last = values[values.length - 1];
  const strokeColor = last > 1 ? "#f87171" : last > 0.5 ? "#fbbf24" : "#6ee7b7";

  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={strokeColor} strokeWidth={1.25} />
    </svg>
  );
}
