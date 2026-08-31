import type { BufferStateDTO } from "../../api/buffersTypes.js";
import { formatPct, formatUsdt } from "../../lib/format.js";
import { BAND_COLOR, BAND_TEXT_COLOR } from "./BufferGauge.js";

export function LpBreakdown({ state }: { state: BufferStateDTO }) {
  const singleSourceCoins = new Set(
    state.coinCapacities.filter((c) => c.singleSource).map((c) => c.coinId),
  );

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">LP breakdown</h2>

      <div className="flex flex-col gap-3">
        {state.lpStates.map((lp) => (
          <div key={lp.lpId} className="flex items-center gap-4 text-sm">
            <div className="w-28 shrink-0 font-medium text-neutral-100">{lp.name}</div>
            <div className="h-2 flex-1 rounded-sm bg-neutral-800">
              <div
                className={`h-full rounded-sm ${BAND_COLOR[lp.band]}`}
                style={{ width: `${Math.min(100, (lp.utilisation ? Number(lp.utilisation) : 0) * 100)}%` }}
              />
            </div>
            <div className="w-16 shrink-0 tabular-nums text-neutral-400">
              {formatPct(lp.utilisation)}
            </div>
            <div className="w-24 shrink-0 tabular-nums text-neutral-500">
              {formatUsdt(lp.headroom)} free
            </div>
            <div className="w-12 shrink-0 text-neutral-500">{lp.coinCount} coins</div>
            <div className={`w-16 shrink-0 font-medium ${BAND_TEXT_COLOR[lp.band]}`}>{lp.band}</div>
          </div>
        ))}
        {state.lpStates.length === 0 && <p className="text-sm text-neutral-500">No LPs configured.</p>}
      </div>

      {singleSourceCoins.size > 0 && (
        <p className="mt-3 border-t border-neutral-800 pt-3 text-xs text-amber-400">
          Single-source concentration risk: {Array.from(singleSourceCoins).join(", ")}
        </p>
      )}
    </section>
  );
}
