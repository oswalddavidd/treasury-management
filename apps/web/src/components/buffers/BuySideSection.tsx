import type { BufferStateDTO, BuySideStateDTO } from "../../api/buffersTypes.js";
import type { ConsumptionPoint } from "../../api/useBuffersStream.js";
import { formatIdr, formatPct } from "../../lib/format.js";
import { BAND_TEXT_COLOR } from "./BufferGauge.js";
import { ConstraintGauge } from "./ConstraintGauge.js";
import { Sparkline } from "./Sparkline.js";

export function BuySideSection({
  buySide,
  history,
  depositVault,
  withdrawalVault,
  withdrawalVaultMismatch,
}: {
  buySide: BuySideStateDTO;
  history: ConsumptionPoint[];
  depositVault: BufferStateDTO["depositVault"];
  withdrawalVault: BufferStateDTO["withdrawalVault"];
  withdrawalVaultMismatch: BufferStateDTO["withdrawalVaultMismatch"];
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Buy side</h2>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-7">
        <div>
          <p className="text-[11px] uppercase text-neutral-500">Net buy</p>
          <p className="tabular-nums text-neutral-100">{formatIdr(buySide.netBuy)}</p>
        </div>
        <div>
          <p
            className="text-[11px] uppercase text-neutral-500"
            title="Added into the same consumption figure as net buy — both draw on the same frozen IDR permission"
          >
            Withdrawal volume
          </p>
          <p className="tabular-nums text-neutral-100">{formatIdr(buySide.withdrawalVolume)}</p>
        </div>
        {/* Two fixed spots, never swap — IDR ceiling always here, USDT in
            LP always there. Whichever is currently binding (the smaller of
            the two — the one that actually stops buying first) just gets
            highlighted, instead of the values trading places. That was the
            old "Binding ceiling / Non-binding" pair's problem: it always
            duplicated one of these two numbers, just which one changed
            with state. */}
        <div>
          <p className="text-[11px] uppercase text-neutral-500">IDR ceiling</p>
          <p
            className={`tabular-nums ${buySide.bindingSource === "IDR" ? BAND_TEXT_COLOR[buySide.band] : "text-neutral-400"}`}
            title={buySide.bindingSource === "IDR" ? "Binding — the tighter of the two limits right now" : undefined}
          >
            {formatIdr(buySide.ceilingIdr)}
            {buySide.bindingSource === "IDR" && <span className="ml-1 text-[10px] text-neutral-500">binding</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-neutral-500">USDT in LP</p>
          <p
            className={`tabular-nums ${buySide.bindingSource === "USDT" ? BAND_TEXT_COLOR[buySide.band] : "text-neutral-400"}`}
            title={buySide.bindingSource === "USDT" ? "Binding — the tighter of the two limits right now" : undefined}
          >
            {formatIdr(buySide.ceilingUsdt)}
            {buySide.bindingSource === "USDT" && <span className="ml-1 text-[10px] text-neutral-500">binding</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-neutral-500">Deposit vault</p>
          <p className="tabular-nums text-neutral-400" title="This period's raw deposits — observational only, resets each period">
            {formatIdr(depositVault)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-neutral-500">Withdrawal vault</p>
          <p
            className={`tabular-nums ${withdrawalVaultMismatch ? "text-amber-400" : "text-neutral-400"}`}
            title={
              withdrawalVaultMismatch
                ? "Doesn't match the frozen IDR ceiling — funds aren't where the books say they are"
                : "Matches the frozen IDR ceiling"
            }
          >
            {formatIdr(withdrawalVault)}
            {withdrawalVaultMismatch && <span className="ml-1">⚠</span>}
          </p>
        </div>
      </div>

      <ConstraintGauge
        consumedAmount={Number(buySide.netBuy) + Number(buySide.withdrawalVolume)}
        ceilingIdr={Number(buySide.ceilingIdr)}
        ceilingUsdt={Number(buySide.ceilingUsdt)}
        peak={Number(buySide.peak)}
        band={buySide.band}
        bindingSource={buySide.bindingSource}
      />

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          Consumed {formatPct(buySide.consumed)} of the {buySide.bindingSource} ceiling (buying +
          withdrawals combined) — pipeline{" "}
          {buySide.bindingSource === "USDT" ? "constrained by LP liquidity" : "constrained by custody permission"}.
        </span>
        <Sparkline points={history} />
      </div>
    </section>
  );
}
