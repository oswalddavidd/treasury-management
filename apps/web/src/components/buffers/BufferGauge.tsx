import type { StatusBand } from "../../api/buffersTypes.js";

// Domain runs to 140% rather than 100% so a breach still has somewhere to
// go on the track instead of clipping flush against the edge.
const DOMAIN_MAX = 1.4;
const THRESHOLD = 0.5;

export const BAND_COLOR: Record<StatusBand, string> = {
  HALTED: "bg-red-500",
  CRITICAL: "bg-red-500",
  ALERT: "bg-amber-500",
  WATCH: "bg-neutral-400",
  NORMAL: "bg-emerald-500",
};

export const BAND_TEXT_COLOR: Record<StatusBand, string> = {
  HALTED: "text-red-400",
  CRITICAL: "text-red-400",
  ALERT: "text-amber-400",
  WATCH: "text-neutral-300",
  NORMAL: "text-emerald-400",
};

function pct(value: number): number {
  return Math.max(0, Math.min(1, value / DOMAIN_MAX)) * 100;
}

/**
 * Per-coin (and buy-side) buffer gauge: fill = current consumption, a peak
 * marker that only moves right (guaranteed monotonic by the backend), and a
 * fixed 50% threshold line. Deliberately subdued — this renders ~52 times.
 */
export function BufferGauge({
  consumed,
  peak,
  band,
}: {
  consumed: number | null;
  peak: number;
  band: StatusBand;
}) {
  const fillPct = consumed === null ? 0 : pct(Math.max(0, consumed));
  const peakPct = pct(peak);
  const thresholdPct = pct(THRESHOLD);

  return (
    <div className="relative h-2 w-full overflow-visible rounded-sm bg-neutral-800">
      {consumed !== null && (
        <div
          className={`absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500 ${BAND_COLOR[band]}`}
          style={{ width: `${fillPct}%` }}
        />
      )}
      <div
        className="absolute inset-y-0 w-px bg-neutral-600"
        style={{ left: `${thresholdPct}%` }}
      />
      <div
        className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-neutral-100 transition-[left] duration-500"
        style={{ left: `${peakPct}%` }}
        title={`Peak: ${(peak * 100).toFixed(1)}%`}
      />
    </div>
  );
}
