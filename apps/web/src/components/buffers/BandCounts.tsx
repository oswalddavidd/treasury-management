import type { StatusBand } from "../../api/buffersTypes.js";
import { BAND_TEXT_COLOR } from "./BufferGauge.js";

const BANDS: StatusBand[] = ["HALTED", "CRITICAL", "ALERT", "WATCH", "NORMAL"];

export function BandCounts({
  counts,
  activeBand,
  onSelect,
}: {
  counts: Record<StatusBand, number>;
  activeBand: StatusBand | null;
  onSelect: (band: StatusBand | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BANDS.map((band) => (
        <button
          key={band}
          onClick={() => onSelect(activeBand === band ? null : band)}
          className={`rounded border px-2.5 py-1 text-xs transition-colors ${
            activeBand === band
              ? "border-neutral-300 bg-neutral-800"
              : "border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <span className={BAND_TEXT_COLOR[band]}>{band}</span>{" "}
          <span className="text-neutral-500">{counts[band]}</span>
        </button>
      ))}
    </div>
  );
}
