import { useBuffersStream } from "../api/useBuffersStream.js";
import { ActionBanner } from "../components/buffers/ActionBanner.js";
import { HeadlineStrip } from "../components/buffers/HeadlineStrip.js";
import { SellSideTable } from "../components/buffers/SellSideTable.js";
import { BuySideSection } from "../components/buffers/BuySideSection.js";
import { LpBreakdown } from "../components/buffers/LpBreakdown.js";
import { LaunchModeBanner } from "../components/buffers/LaunchModeBanner.js";

const STALE_AFTER_MS = 15_000;

export default function BuffersPage() {
  const { state, connected, lastUpdated, buyHistory } = useBuffersStream();

  const stale = lastUpdated !== null && Date.now() - lastUpdated > STALE_AFTER_MS;

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-500">
        Connecting to /api/buffers/stream…
      </div>
    );
  }

  // True cold start — no period has ever closed, nothing to derive at all.
  if (state.period === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="max-w-md text-center">
          <p className="text-sm">No period has closed yet — trading hasn't started.</p>
          <p className="mt-2 text-xs text-neutral-600">
            Seed a scenario or close a period from /sim to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-neutral-950 p-6 text-neutral-100 ${stale ? "opacity-60" : ""}`}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Treasury Buffers</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          {connected ? "live" : "reconnecting…"}
          {stale && lastUpdated && (
            <span className="text-amber-500">
              — stale, last update {Math.round((Date.now() - lastUpdated) / 1000)}s ago
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <ActionBanner state={state} />
        <HeadlineStrip state={state} />

        {/* launchMode (§1.7) is a banner, not a table swap — see
            LaunchModeBanner for why. The table itself already renders "—"
            per-coin wherever freeFloat is actually zero. */}
        {state.launchMode && <LaunchModeBanner state={state} />}
        <SellSideTable state={state} />
        {state.buySide && (
          <BuySideSection
            buySide={state.buySide}
            history={buyHistory}
            depositVault={state.depositVault}
            withdrawalVault={state.withdrawalVault}
            withdrawalVaultMismatch={state.withdrawalVaultMismatch}
          />
        )}
        <LpBreakdown state={state} />
      </div>
    </div>
  );
}
