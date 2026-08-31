import Decimal from "decimal.js";
import type { CoinId } from "../types/coin.js";
import { CRYPTO_FREE_FLOAT_RATIO, IDR_FREE_FLOAT_RATIO } from "../constants.js";

/** §1.3 — FF[coin] = BB[coin] × 0.30 (ICC keeps the other 70%). */
export function computeCoinFreeFloat(bb: Decimal): Decimal {
  return bb.times(CRYPTO_FREE_FLOAT_RATIO);
}

/** §1.3 — FF_idr = BB_idr × 0.20 (KKI keeps the other 80%). */
export function computeIdrFreeFloat(bbIdr: Decimal): Decimal {
  return bbIdr.times(IDR_FREE_FLOAT_RATIO);
}

export function computeAllCoinFreeFloats(
  bbByCoin: Record<CoinId, Decimal>,
): Record<CoinId, Decimal> {
  const result: Record<CoinId, Decimal> = {};
  for (const [coinId, bb] of Object.entries(bbByCoin)) {
    result[coinId] = computeCoinFreeFloat(bb);
  }
  return result;
}
