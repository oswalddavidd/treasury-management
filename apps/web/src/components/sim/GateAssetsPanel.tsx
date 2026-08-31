import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass, Panel } from "./Field.js";
import { useSetGateAsset } from "../../api/simHooks.js";
import type { CoinDTO } from "../../api/types.js";

/**
 * Sets the actual observed balance at the LP/custody gate — a manual
 * override for testing reconciliation, not derived from any trade. In
 * production this would come from a real custody/wallet feed instead of a
 * form; here it's how you deliberately create (or clear) a mismatch against
 * the computed free float to see /buffers flag it.
 */
export function GateAssetsPanel({ coins }: { coins: CoinDTO[] }) {
  const [coinId, setCoinId] = useState(coins[0]?.id ?? "");
  const [amount, setAmount] = useState("0");
  const setGateAsset = useSetGateAsset();

  // See TradeActionsPanel for why this is needed: useState's initializer
  // only runs once, so a coin list arriving after mount (or changing after
  // a reset) would otherwise leave coinId stuck at "" forever.
  useEffect(() => {
    if (coins.length > 0 && !coins.some((c) => c.id === coinId)) {
      setCoinId(coins[0].id);
    }
  }, [coins, coinId]);

  return (
    <Panel title="Gate assets">
      <p className="mb-3 text-xs text-neutral-500">
        The actual balance sitting at the LP/custody gate for a coin — independent of the ledger.
        Set it to anything other than a coin's computed free float to simulate assets being
        somewhere they shouldn't be; <code className="text-neutral-400">/buffers</code> flags the
        mismatch.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Coin">
          <select className={inputClass} value={coinId} onChange={(e) => setCoinId(e.target.value)}>
            {coins.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} (currently {c.gateBalance})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Actual balance at gate">
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <button
          className={buttonClass}
          disabled={setGateAsset.isPending || !coinId}
          onClick={() => setGateAsset.mutate({ coinId, amount })}
        >
          Set
        </button>
      </div>
      {setGateAsset.isError && (
        <p className="mt-2 text-xs text-red-400">{setGateAsset.error.message}</p>
      )}
    </Panel>
  );
}
