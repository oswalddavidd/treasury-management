import { useState } from "react";
import { buttonClass, Field, inputClass, Panel } from "./Field.js";
import { useBulkGenerate } from "../../api/simHooks.js";

export function BulkGeneratorPanel() {
  const [count, setCount] = useState("50");
  const [hours, setHours] = useState("6");
  const [buyBias, setBuyBias] = useState("0.5");
  const bulk = useBulkGenerate();

  return (
    <Panel title="Bulk / random generator">
      <p className="mb-3 text-xs text-neutral-500">
        Generates N random buy/sell trades spread across the trailing window, timestamped in
        chronological order so the within-period trajectory stays coherent.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Event count">
          <input className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        <Field label="Over last (hours)">
          <input className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Field label="Buy bias (0 = all sell, 1 = all buy)">
          <input className={inputClass} value={buyBias} onChange={(e) => setBuyBias(e.target.value)} />
        </Field>
        <button
          className={buttonClass}
          disabled={bulk.isPending}
          onClick={() =>
            bulk.mutate({
              count: Number(count),
              hours: Number(hours),
              buyBias: Number(buyBias),
            })
          }
        >
          {bulk.isPending ? "Generating…" : "Generate"}
        </button>
      </div>
      {bulk.isError && <p className="mt-2 text-xs text-red-400">{bulk.error.message}</p>}
    </Panel>
  );
}
