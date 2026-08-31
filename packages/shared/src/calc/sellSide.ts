import Decimal from "decimal.js";
import type { CoinId } from "../types/coin.js";
import type { CoinBufferState, StatusBand } from "../types/bufferState.js";
import { BAND_THRESHOLDS } from "../constants.js";

export function statusBandFromPeak(peak: Decimal): StatusBand {
  if (peak.gte(BAND_THRESHOLDS.HALTED)) return "HALTED";
  if (peak.gte(BAND_THRESHOLDS.CRITICAL)) return "CRITICAL";
  if (peak.gte(BAND_THRESHOLDS.ALERT)) return "ALERT";
  if (peak.gte(BAND_THRESHOLDS.WATCH)) return "WATCH";
  return "NORMAL";
}

export interface ComputeCoinBufferInput {
  coinId: CoinId;
  freeFloat: Decimal; // FF[c], frozen, must be >= 0
  netSell: Decimal; // NS[c](t) = Σsells − Σbuys of c since period start, signed
  priorPeak: Decimal; // peak carried forward from the previous tick; 0 at period start
}

/**
 * Pure, no I/O. FF == 0 (launch mode) makes consumption undefined rather
 * than a divide-by-zero 0 — callers must not render that as "0% consumed".
 * Peak carries forward unchanged in that case since there is nothing to
 * compare it against.
 */
export function computeCoinBufferState(input: ComputeCoinBufferInput): CoinBufferState {
  const { coinId, freeFloat, netSell, priorPeak } = input;

  const netSellClamped = Decimal.max(netSell, 0);
  const consumed = freeFloat.isZero() ? null : netSell.div(freeFloat);
  const peak = consumed === null ? priorPeak : Decimal.max(priorPeak, consumed);
  const headroom = freeFloat.minus(netSell);
  const band = statusBandFromPeak(peak);

  return { coinId, freeFloat, netSell, netSellClamped, consumed, peak, headroom, band };
}
