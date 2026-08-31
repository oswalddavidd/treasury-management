import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass, Panel } from "./Field.js";
import { useSetFxRate, useSetLpState } from "../../api/simHooks.js";
import type { CoinDTO } from "../../api/types.js";

export function LpFxPanel({ coins }: { coins: CoinDTO[] }) {
  const [fxRate, setFxRateValue] = useState("15800");
  const setFxRate = useSetFxRate();

  const [lpName, setLpName] = useState("LP-A");
  const [usdtHeld, setUsdtHeld] = useState("100000");
  const [usdtAllocated, setUsdtAllocated] = useState("0");
  const [coverage, setCoverage] = useState<Set<string>>(new Set(coins.map((c) => c.id)));
  const setLpState = useSetLpState();

  // Same stale-initializer problem as TradeActionsPanel: if coins was
  // empty when this mounted, coverage would silently stay empty forever
  // even after real coins load — saving an LP with zero coverage with no
  // visible sign anything was wrong. Re-defaults to "all coins" whenever
  // the list populates and nothing's been selected yet.
  useEffect(() => {
    if (coins.length > 0 && coverage.size === 0) {
      setCoverage(new Set(coins.map((c) => c.id)));
    }
  }, [coins, coverage]);

  const toggleCoverage = (coinId: string) => {
    setCoverage((prev) => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      return next;
    });
  };

  return (
    <Panel title="LP state & FX rate">
      <div className="mb-4 flex items-end gap-2">
        <Field label="FX rate (IDR per USD)">
          <input
            className={inputClass}
            value={fxRate}
            onChange={(e) => setFxRateValue(e.target.value)}
          />
        </Field>
        <button
          className={buttonClass}
          disabled={setFxRate.isPending}
          onClick={() => setFxRate.mutate({ rateIdrPerUsd: fxRate })}
        >
          Set FX rate
        </button>
      </div>

      <div className="border-t border-neutral-800 pt-4">
        <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Set LP state</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Name (upsert key)">
            <input className={inputClass} value={lpName} onChange={(e) => setLpName(e.target.value)} />
          </Field>
          <Field label="USDT held">
            <input className={inputClass} value={usdtHeld} onChange={(e) => setUsdtHeld(e.target.value)} />
          </Field>
          <Field label="USDT allocated">
            <input
              className={inputClass}
              value={usdtAllocated}
              onChange={(e) => setUsdtAllocated(e.target.value)}
            />
          </Field>
          <button
            className={buttonClass}
            disabled={setLpState.isPending}
            onClick={() =>
              setLpState.mutate({
                name: lpName,
                usdtHeld,
                usdtAllocated,
                coverage: Array.from(coverage),
              })
            }
          >
            Save LP
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {coins.map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={coverage.has(c.id)}
                onChange={() => toggleCoverage(c.id)}
              />
              {c.id}
            </label>
          ))}
        </div>
      </div>
    </Panel>
  );
}
