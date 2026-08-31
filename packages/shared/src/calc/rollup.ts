import Decimal from "decimal.js";
import type { CoinBufferState, SellSideRollup, StatusBand } from "../types/bufferState.js";

const EMPTY_BAND_COUNTS: Record<StatusBand, number> = {
  HALTED: 0,
  CRITICAL: 0,
  ALERT: 0,
  WATCH: 0,
  NORMAL: 0,
};

/**
 * Never averages across coins — 51 healthy coins must not hide one broken
 * one. worstCoin is the argmax of peak; band counts and blockedCount are
 * plain tallies.
 */
export function computeSellSideRollup(states: CoinBufferState[]): SellSideRollup {
  const bandCounts: Record<StatusBand, number> = { ...EMPTY_BAND_COUNTS };

  let worstCoin: string | null = null;
  let worstPeak: Decimal | null = null;

  for (const state of states) {
    bandCounts[state.band] += 1;
    if (worstPeak === null || state.peak.gt(worstPeak)) {
      worstPeak = state.peak;
      worstCoin = state.coinId;
    }
  }

  return { worstCoin, bandCounts, blockedCount: bandCounts.HALTED };
}
