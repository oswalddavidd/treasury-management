import type { BufferStateDTO } from "../../api/buffersTypes.js";

/**
 * §1.7 — a banner, not a view swap. Launch mode exists so a coin with zero
 * free float never shows a misleading "0% consumed" in green — but a coin
 * that DOES have real free float has perfectly meaningful data, and hiding
 * it behind an all-dashes table just because other coins are still at zero
 * was wrong. SellSideTable already handles the per-coin case correctly
 * (consumed is null only where freeFloat is actually zero), so this is now
 * just context explaining why some rows show "—" and others don't.
 */
export function LaunchModeBanner({ state }: { state: BufferStateDTO }) {
  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200">
      Reserve coverage hasn't cleared 1.0x for three consecutive periods (or most coins still have
      zero free float) — rows below with no free float show "—" instead of a misleading "0%
      consumed" in green. Coins that do have real free float still show their real numbers.
      {state.reserveCoverage !== null && (
        <span className="ml-1 text-amber-400">
          (reserve coverage:{" "}
          {state.reserveCoverage === "Infinity" ? "∞" : `${Number(state.reserveCoverage).toFixed(2)}x`})
        </span>
      )}
    </div>
  );
}
