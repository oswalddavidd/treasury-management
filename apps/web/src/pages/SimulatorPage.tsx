import { useSimState } from "../api/simHooks.js";
import { TimeControlPanel } from "../components/sim/TimeControlPanel.js";
import { TradeActionsPanel } from "../components/sim/TradeActionsPanel.js";
import { BulkGeneratorPanel } from "../components/sim/BulkGeneratorPanel.js";
import { LpFxPanel } from "../components/sim/LpFxPanel.js";
import { GateAssetsPanel } from "../components/sim/GateAssetsPanel.js";
import { WithdrawalVaultPanel } from "../components/sim/WithdrawalVaultPanel.js";
import { ScenariosPanel } from "../components/sim/ScenariosPanel.js";
import { EventLogPanel } from "../components/sim/EventLogPanel.js";

export default function SimulatorPage() {
  const { data, isLoading, isError, error } = useSimState();

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">Coinbit Simulator</h1>
        <p className="text-xs text-neutral-500">
          Dev-only data injection tool. Not linked from anywhere in the app — reachable only by
          this URL.
        </p>
      </header>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-400">{error.message}</p>}

      {data && (
        <div className="flex flex-col gap-4">
          <TimeControlPanel now={data.now} period={data.period} />
          <TradeActionsPanel coins={data.coins} />
          <BulkGeneratorPanel />
          <LpFxPanel coins={data.coins} />
          <GateAssetsPanel coins={data.coins} />
          <WithdrawalVaultPanel idrVaults={data.idrVaults} />
          <ScenariosPanel />
          <EventLogPanel events={data.recentEvents} />
        </div>
      )}
    </div>
  );
}
