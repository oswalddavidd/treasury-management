import type { ReactNode } from "react";
import { formatDurationShort, formatIdr } from "../../lib/format.js";
import type { BufferStateDTO } from "../../api/buffersTypes.js";
import { BAND_TEXT_COLOR } from "./BufferGauge.js";

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-neutral-100">{children}</span>
    </div>
  );
}

export function HeadlineStrip({ state, now }: { state: BufferStateDTO; now: Date }) {
  const period = state.period!;
  const remainingMs = new Date(period.end).getTime() - now.getTime();
  const worstCoin = state.coinStates.find((c) => c.coinId === state.rollup.worstCoin);
  const blockedCount = state.coinCapacities.filter((c) => c.buyBlocked).length;
  const attentionCount = state.rollup.bandCounts.HALTED + state.rollup.bandCounts.CRITICAL;

  return (
    <div className="grid grid-cols-2 gap-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 sm:grid-cols-5">
      <Cell label="Time to period end">{formatDurationShort(remainingMs)}</Cell>
      <Cell label="Worst coin">
        {worstCoin ? (
          <span className={BAND_TEXT_COLOR[worstCoin.band]}>{worstCoin.coinId}</span>
        ) : (
          "—"
        )}
      </Cell>
      <Cell label="Coins critical+">{attentionCount}</Cell>
      <Cell label="Buy capacity">
        {state.buySide ? (
          <span className={state.buySide.bindingSource === "USDT" ? "text-amber-400" : ""}>
            {formatIdr(state.buySide.headroomEffective)}{" "}
            <span className="text-xs font-normal text-neutral-500">
              ({state.buySide.bindingSource})
            </span>
          </span>
        ) : (
          "—"
        )}
      </Cell>
      <Cell label="Blocked coins">
        <span className={blockedCount > 0 ? "text-red-400" : undefined}>{blockedCount}</span>
      </Cell>
    </div>
  );
}
