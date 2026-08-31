import type { StatusBand } from "../../api/buffersTypes.js";
import { BAND_COLOR } from "./BufferGauge.js";

/**
 * Buy-side constraint gauge. Fixed axis 0..ceilingIdr (never rescales
 * mid-period). Fill = NB(t). When USDT is the binding constraint, the gap
 * between ceilingUsdt and ceilingIdr renders as a grey dead zone — rupiah
 * Coinbit is permitted to convert but has no USDT liquidity behind, never
 * presented as usable headroom (§1.6).
 */
export function ConstraintGauge({
  netBuy,
  ceilingIdr,
  ceilingUsdt,
  peak,
  band,
  bindingSource,
}: {
  netBuy: number;
  ceilingIdr: number;
  ceilingUsdt: number;
  peak: number;
  band: StatusBand;
  bindingSource: "IDR" | "USDT";
}) {
  const pct = (v: number) => (ceilingIdr > 0 ? Math.max(0, Math.min(1, v / ceilingIdr)) * 100 : 0);

  const fillPct = pct(Math.max(0, netBuy));
  const peakPct = pct(peak);
  const usdtPct = pct(ceilingUsdt);
  const hasDeadZone = bindingSource === "USDT" && ceilingUsdt < ceilingIdr;

  return (
    <div>
      <div className="relative h-2.5 w-full overflow-visible rounded-sm bg-neutral-800">
        {hasDeadZone && (
          <div
            className="absolute inset-y-0 right-0 bg-neutral-700"
            style={{ left: `${usdtPct}%` }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500 ${BAND_COLOR[band]}`}
          style={{ width: `${fillPct}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-neutral-600" style={{ left: "50%" }} />
        {hasDeadZone && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 rounded bg-sky-300 transition-[left] duration-500"
            style={{ left: `${usdtPct}%` }}
            title="USDT-liquidity ceiling"
          />
        )}
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-neutral-100 transition-[left] duration-500"
          style={{ left: `${peakPct}%` }}
          title={`Peak: ${(peak * 100).toFixed(1)}%`}
        />
      </div>
      {hasDeadZone && (
        <p className="mt-1 text-[11px] text-neutral-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-neutral-700 align-middle" />
          Grey = permitted by custody but unreachable — no USDT liquidity behind it. Not headroom.
        </p>
      )}
    </div>
  );
}
