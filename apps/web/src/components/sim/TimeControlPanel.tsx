import { useState } from "react";
import { buttonClass, Field, inputClass, Panel, secondaryButtonClass } from "./Field.js";
import { useClosePeriod, useTimeAdvance, useTimeSet } from "../../api/simHooks.js";
import type { PeriodDTO } from "../../api/types.js";

export function TimeControlPanel({ now, period }: { now: string; period: PeriodDTO }) {
  const [minutes, setMinutes] = useState("60");
  const [jumpTo, setJumpTo] = useState("");
  const advance = useTimeAdvance();
  const setTime = useTimeSet();
  const closePeriod = useClosePeriod();

  return (
    <Panel title="Simulated clock">
      <div className="mb-4 rounded border border-neutral-800 bg-neutral-950 p-3">
        <div className="text-2xl font-semibold tabular-nums text-neutral-100">
          {new Date(now).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}{" "}
          <span className="text-sm font-normal text-neutral-500">Asia/Jakarta</span>
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          Period: {new Date(period.start).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })} →{" "}
          {new Date(period.end).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Advance by (minutes)">
          <input
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            type="number"
          />
        </Field>
        <button
          className={buttonClass}
          disabled={advance.isPending}
          onClick={() => advance.mutate({ ms: Number(minutes) * 60_000 })}
        >
          Advance
        </button>

        <Field label="Jump to (ISO timestamp)">
          <input
            className={inputClass}
            placeholder="2026-08-27T05:00:00.000Z"
            value={jumpTo}
            onChange={(e) => setJumpTo(e.target.value)}
          />
        </Field>
        <button
          className={secondaryButtonClass}
          disabled={setTime.isPending || !jumpTo}
          onClick={() => setTime.mutate({ timestamp: new Date(jumpTo).toISOString() })}
        >
          Jump
        </button>

        <button
          className={secondaryButtonClass}
          disabled={closePeriod.isPending}
          onClick={() => closePeriod.mutate()}
        >
          Close period now
        </button>
      </div>
      {closePeriod.isError && (
        <p className="mt-2 text-xs text-red-400">{closePeriod.error.message}</p>
      )}
    </Panel>
  );
}
