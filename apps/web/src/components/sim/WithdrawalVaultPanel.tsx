import { useState } from "react";
import { buttonClass, Field, inputClass, Panel } from "./Field.js";
import { useSetWithdrawalVault } from "../../api/simHooks.js";
import type { IdrVaultsDTO } from "../../api/types.js";

/**
 * The IDR counterpart of Gate Assets: manually overrides the Withdrawal
 * Vault, independent of the real mechanics (rebalance-to-FF_idr at period
 * close, real-time deduction on withdrawal). Same testing purpose —
 * deliberately create or clear a mismatch to see /buffers flag it.
 *
 * The Deposit Vault has no override here — it's purely observational
 * (this period's raw deposits) and only ever moves via real deposits.
 */
export function WithdrawalVaultPanel({ idrVaults }: { idrVaults: IdrVaultsDTO }) {
  const [amount, setAmount] = useState("0");
  const setWithdrawalVault = useSetWithdrawalVault();

  return (
    <Panel title="Withdrawal vault">
      <p className="mb-3 text-xs text-neutral-500">
        The actual IDR balance available for withdrawals right now (Midtrans vault) —
        independent of the ledger. Normally reset to <code className="text-neutral-400">FF_idr</code>{" "}
        at every period close and drawn down in real time by withdrawals. Set it to anything else
        to simulate a shortfall; <code className="text-neutral-400">/buffers</code> flags the
        mismatch.
      </p>
      <p className="mb-3 text-xs text-neutral-400">
        Currently: deposit vault {idrVaults.depositVault} (this period's raw deposits, resets each
        close) · withdrawal vault {idrVaults.withdrawalVault}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Actual balance at withdrawal vault">
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <button
          className={buttonClass}
          disabled={setWithdrawalVault.isPending}
          onClick={() => setWithdrawalVault.mutate({ amount })}
        >
          Set
        </button>
      </div>
      {setWithdrawalVault.isError && (
        <p className="mt-2 text-xs text-red-400">{setWithdrawalVault.error.message}</p>
      )}
    </Panel>
  );
}
