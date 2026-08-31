import type Decimal from "decimal.js";
import type { StatusBand } from "@coinbit/shared";
import type { PrismaClient } from "../db.js";
import { sendTelegramMessage } from "./telegram.js";
import { formatAssetStatusAlert } from "./format.js";

const BAND_SEVERITY: Record<StatusBand, number> = {
  NORMAL: 0,
  WATCH: 1,
  ALERT: 2,
  CRITICAL: 3,
  HALTED: 4,
};

export interface AlertableCoinState {
  coinId: string;
  band: StatusBand;
  consumed: Decimal | null;
}

/**
 * Edge-triggered, not level-triggered: fires only when a coin's band gets
 * MORE severe than the last band alerted for it *within the current
 * period* — never on every tick a threshold happens to be crossed. That's
 * what stops the 30%→29%→30% flapping case from spamming: peak (which the
 * band is based on) never decreases within a period, so once WATCH is
 * alerted it won't re-fire for the same or a lesser band until either the
 * band escalates further or a new period starts (periodEffectiveFrom
 * changes, resetting the dedupe — a new period means a fresh peak).
 */
export async function checkCoinAlerts(
  prisma: PrismaClient,
  coinStates: AlertableCoinState[],
  periodEffectiveFrom: Date,
): Promise<void> {
  for (const coin of coinStates) {
    const currentSeverity = BAND_SEVERITY[coin.band];
    if (currentSeverity < BAND_SEVERITY.WATCH) continue; // NORMAL never alerts

    const existing = await prisma.coinAlertState.findUnique({ where: { coinId: coin.coinId } });
    const samePeriod = !!existing && existing.periodEffectiveFrom.getTime() === periodEffectiveFrom.getTime();
    const lastSeverity = samePeriod ? BAND_SEVERITY[existing!.lastAlertedBand as StatusBand] : -1;

    if (currentSeverity <= lastSeverity) continue; // already alerted this band (or worse) this period

    const consumedPct = coin.consumed ? coin.consumed.times(100).toFixed(1) : "—";
    const delivered = await sendTelegramMessage(formatAssetStatusAlert(coin.coinId, coin.band, consumedPct));
    if (!delivered) continue; // don't record dedup state for a message that never actually sent

    await prisma.coinAlertState.upsert({
      where: { coinId: coin.coinId },
      create: { coinId: coin.coinId, lastAlertedBand: coin.band, periodEffectiveFrom },
      update: { lastAlertedBand: coin.band, periodEffectiveFrom },
    });
  }
}
