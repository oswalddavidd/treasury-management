import type { PrismaClient } from "../db.js";
import type { Clock } from "../clock/types.js";
import { bufferEvents } from "../events.js";
import { computeCurrentBufferState } from "../engine/index.js";
import { checkCoinAlerts } from "./monitor.js";

/**
 * Hooks the same "changed" event that drives the SSE stream — band
 * transitions can only happen when ledger/LP/FX/clock state changes, so
 * there's no need for a separate poll loop.
 */
export function registerAlertMonitor(prisma: PrismaClient, clock: Clock): void {
  const check = async () => {
    const state = await computeCurrentBufferState(prisma, clock);
    if (!state.period) return; // no snapshot yet — nothing meaningful to alert on
    await checkCoinAlerts(prisma, state.coinStates, state.period.start);
  };

  bufferEvents.on("changed", () => {
    check().catch((err) => console.error("[alerts] check failed:", err));
  });
}
