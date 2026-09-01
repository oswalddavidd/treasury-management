import { useMemo, useState } from "react";
import type { BufferStateDTO, CoinBufferStateDTO, StatusBand } from "../../api/buffersTypes.js";
import { formatCoinAmount, formatPct } from "../../lib/format.js";
import { BAND_TEXT_COLOR, BufferGauge } from "./BufferGauge.js";
import { BandCounts } from "./BandCounts.js";

type FilterChip = "worst6" | "alertPlus" | "all";

const ALERT_PLUS: StatusBand[] = ["HALTED", "CRITICAL", "ALERT"];

export function SellSideTable({ state }: { state: BufferStateDTO }) {
  const [chip, setChip] = useState<FilterChip>("all");
  const [bandFilter, setBandFilter] = useState<StatusBand | null>(null);

  const sorted = useMemo(
    () => [...state.coinStates].sort((a, b) => Number(b.peak) - Number(a.peak)),
    [state.coinStates],
  );

  const rows = useMemo(() => {
    let list = sorted;
    if (bandFilter) list = list.filter((c) => c.band === bandFilter);
    else if (chip === "worst6") list = list.slice(0, 6);
    else if (chip === "alertPlus") list = list.filter((c) => ALERT_PLUS.includes(c.band));
    return list;
  }, [sorted, chip, bandFilter]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BandCounts counts={state.rollup.bandCounts} activeBand={bandFilter} onSelect={setBandFilter} />
        <div className="flex gap-1 text-xs">
          {(["worst6", "alertPlus", "all"] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                setChip(c);
                setBandFilter(null);
              }}
              className={`rounded border px-2 py-1 ${
                chip === c && !bandFilter
                  ? "border-neutral-300 bg-neutral-800 text-neutral-100"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              {c === "worst6" ? "Worst 6" : c === "alertPlus" ? "Alert+" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr>
              <th className="py-1.5 pr-3 font-normal">Coin</th>
              <th className="py-1.5 pr-3 font-normal">Gate assets</th>
              <th className="py-1.5 pr-3 font-normal">Free float</th>
              <th className="py-1.5 pr-3 font-normal">Net sell</th>
              <th className="py-1.5 pr-3 font-normal">Consumed</th>
              <th className="py-1.5 pr-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((coin: CoinBufferStateDTO) => {
              // Net sell can go negative (net buying) — that's not a
              // sell-side buffer risk, so the sell-side table shows it
              // clamped at 0 to avoid reading as an ambiguous "-200".
              // The raw signed value (and what it means) is still in the
              // tooltip for anyone who wants the direction.
              const rawNetSell = Number(coin.netSell);
              const rawConsumed = coin.consumed === null ? null : Number(coin.consumed);
              const clampedConsumed = rawConsumed === null ? null : Math.max(0, rawConsumed);
              const isNetBuying = rawNetSell < 0;

              return (
                <tr key={coin.coinId} className="border-t border-neutral-800">
                  <td className="py-2 pr-3 font-medium text-neutral-100">{coin.coinId}</td>
                  <td
                    className={`py-2 pr-3 tabular-nums ${coin.gateMismatch ? "text-amber-400" : "text-neutral-400"}`}
                    title={
                      coin.gateMismatch
                        ? "Doesn't match computed free float — asset isn't where the books say it is"
                        : "Matches computed free float"
                    }
                  >
                    {formatCoinAmount(coin.gateBalance)}
                    {coin.gateMismatch && <span className="ml-1">⚠</span>}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-400">
                    {formatCoinAmount(coin.freeFloat)}
                  </td>
                  <td
                    className="py-2 pr-3 tabular-nums text-neutral-400"
                    title={
                      isNetBuying
                        ? `Net buying: ${formatCoinAmount(Math.abs(rawNetSell))} bought net — not a sell-side risk`
                        : undefined
                    }
                  >
                    {formatCoinAmount(coin.netSellClamped)}
                    {isNetBuying && <span className="ml-1 text-neutral-600">(net buying)</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-28">
                        <BufferGauge consumed={clampedConsumed} peak={Number(coin.peak)} band={coin.band} />
                      </div>
                      <span className="tabular-nums text-neutral-300">{formatPct(clampedConsumed)}</span>
                    </div>
                  </td>
                  <td className={`py-2 pr-3 font-medium ${BAND_TEXT_COLOR[coin.band]}`}>{coin.band}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-neutral-500">
                  No coins match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
