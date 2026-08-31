import type { BuySideStateDTO } from "../../api/buffersTypes.js";
import type { ConsumptionPoint } from "../../api/useBuffersStream.js";
import { formatIdr, formatPct } from "../../lib/format.js";
import { BAND_TEXT_COLOR } from "./BufferGauge.js";
import { ConstraintGauge } from "./ConstraintGauge.js";
import { Sparkline } from "./Sparkline.js";

export function BuySideSection({
  buySide,
  history,
}: {
  buySide: BuySideStateDTO;
  history: ConsumptionPoint[];
}) {
  const nonBinding = buySide.bindingSource === "IDR" ? "USDT" : "IDR";
  const nonBindingValue =
    buySide.bindingSource === "IDR" ? buySide.ceilingUsdt : buySide.ceilingIdr;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Buy side</h2>

      <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-[11px] uppercase text-neutral-500">Net buy</p>
          <p className="tabular-nums text-neutral-100">{formatIdr(buySide.netBuy)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-neutral-500">
            Binding ceiling ({buySide.bindingSource})
          </p>
          <p className={`tabular-nums ${BAND_TEXT_COLOR[buySide.band]}`}>
            {formatIdr(buySide.bindingSource === "IDR" ? buySide.ceilingIdr : buySide.ceilingUsdt)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-neutral-500">Non-binding ({nonBinding})</p>
          <p className="tabular-nums text-neutral-400">{formatIdr(nonBindingValue)}</p>
        </div>
      </div>

      <ConstraintGauge
        netBuy={Number(buySide.netBuy)}
        ceilingIdr={Number(buySide.ceilingIdr)}
        ceilingUsdt={Number(buySide.ceilingUsdt)}
        peak={Number(buySide.peak)}
        band={buySide.band}
        bindingSource={buySide.bindingSource}
      />

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          Consumed {formatPct(buySide.consumed)} of the {buySide.bindingSource} ceiling — pipeline{" "}
          {buySide.bindingSource === "USDT" ? "constrained by LP liquidity" : "constrained by custody permission"}.
        </span>
        <Sparkline points={history} />
      </div>
    </section>
  );
}
