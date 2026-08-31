import { buttonClass, Panel, secondaryButtonClass } from "./Field.js";
import { useResetSim, useSeedScenario } from "../../api/simHooks.js";

const SCENARIOS: Array<{ name: string; label: string; description: string }> = [
  {
    name: "zero-balance",
    label: "Zero balance / launch mode",
    description: "Everything empty — verifies the divide-by-zero handling.",
  },
  {
    name: "healthy",
    label: "Healthy steady state",
    description: "All coins comfortable, well under threshold.",
  },
  {
    name: "one-coin-breaching",
    label: "One coin breaching",
    description: "One coin driven past 100% while the rest stay green.",
  },
  {
    name: "usdt-ceiling-binds",
    label: "USDT ceiling binds",
    description: "LP balances below the IDR ceiling — dead zone + binding-source flip.",
  },
  {
    name: "single-source-starved",
    label: "Single-source LP starved",
    description: "The one LP covering a coin gets drained.",
  },
];

export function ScenariosPanel() {
  const seed = useSeedScenario();
  const reset = useResetSim();

  return (
    <Panel title="Seed scenarios">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.name}
            className={`${secondaryButtonClass} flex flex-col items-start gap-0.5 text-left`}
            disabled={seed.isPending}
            onClick={() => seed.mutate(s.name)}
          >
            <span className="font-medium text-neutral-100">{s.label}</span>
            <span className="text-xs font-normal text-neutral-500">{s.description}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <button
          className={`${buttonClass} bg-red-500 text-neutral-950 hover:bg-red-400`}
          disabled={reset.isPending}
          onClick={() => {
            if (confirm("Wipe all data back to zero?")) reset.mutate();
          }}
        >
          Reset everything
        </button>
      </div>
    </Panel>
  );
}
