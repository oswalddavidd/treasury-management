import Decimal from "decimal.js";
import type { CoinId } from "../types/coin.js";

export interface LaunchModeInput {
  freeFloatUsd: Record<CoinId, Decimal>; // FF[c] converted to USD
  /**
   * Average net sell per period (USD) over up to 5 trailing periods.
   * null when there is no period history at all (true launch) — not to be
   * confused with a real average of 0.
   */
  trailingAvgNetSellUsd: Decimal | null;
  totalListedCoins: number;
}

export interface LaunchModeResult {
  reserveCoverage: Decimal | null; // null only when trailingAvgNetSellUsd is null
  launchMode: boolean;
}

/**
 * §1.7. At true launch (no trailing period history) coverage is undefined,
 * not a divide-by-zero artifact — undefined is treated as launch mode.
 * Once history exists, an average net sell that is zero *or negative*
 * (a trailing window with net buying rather than net selling) yields
 * infinite coverage — reserves aren't being depleted at all, so dividing a
 * positive free float by a negative number to get a "coverage" below 1.0
 * would flag launch mode for the opposite of the right reason.
 */
export function computeLaunchMode(input: LaunchModeInput): LaunchModeResult {
  const { freeFloatUsd, trailingAvgNetSellUsd, totalListedCoins } = input;

  const coinValues = Object.values(freeFloatUsd);
  const totalFreeFloatUsd = coinValues.reduce((sum, ff) => sum.plus(ff), new Decimal(0));
  const zeroFreeFloatCount = coinValues.filter((ff) => ff.isZero()).length;
  const zeroFreeFloatMajority =
    totalListedCoins > 0 && zeroFreeFloatCount > totalListedCoins / 2;

  if (trailingAvgNetSellUsd === null) {
    return { reserveCoverage: null, launchMode: true };
  }

  const reserveCoverage = trailingAvgNetSellUsd.lte(0)
    ? new Decimal(Infinity)
    : totalFreeFloatUsd.div(trailingAvgNetSellUsd);

  const launchMode = reserveCoverage.lt(1) || zeroFreeFloatMajority;

  return { reserveCoverage, launchMode };
}
