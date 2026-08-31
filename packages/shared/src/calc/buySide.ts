import Decimal from "decimal.js";
import type { CoinId } from "../types/coin.js";
import type {
  BindingSource,
  BuySideState,
  CoinCapacityState,
  LpBufferState,
} from "../types/bufferState.js";
import { statusBandFromPeak } from "./sellSide.js";

export interface ComputeBuySideInput {
  netBuy: Decimal; // NB(t), IDR
  ceilingIdr: Decimal; // frozen, FF_idr
  ceilingUsdt: Decimal; // real-time, IDR-denominated (USDT_avail × fx)
  priorPeak: Decimal;
}

/**
 * All ratios use ceilingIdr as the denominator (never the lower of the two)
 * so the denominator stays frozen and peak stays meaningful — §1.6.
 */
export function computeBuySideState(input: ComputeBuySideInput): BuySideState {
  const { netBuy, ceilingIdr, ceilingUsdt, priorPeak } = input;

  const consumed = ceilingIdr.isZero() ? null : netBuy.div(ceilingIdr);
  const peak = consumed === null ? priorPeak : Decimal.max(priorPeak, consumed);

  const headroomIdr = ceilingIdr.minus(netBuy);
  const headroomUsdt = ceilingUsdt.minus(netBuy);
  const headroomEffective = Decimal.min(headroomIdr, headroomUsdt);

  const bindingSource: BindingSource = ceilingIdr.lte(ceilingUsdt) ? "IDR" : "USDT";
  const unreachable = Decimal.max(0, ceilingIdr.minus(ceilingUsdt));

  const band = statusBandFromPeak(peak);

  return {
    netBuy,
    ceilingIdr,
    ceilingUsdt,
    consumed,
    peak,
    headroomIdr,
    headroomUsdt,
    headroomEffective,
    bindingSource,
    unreachable,
    band,
  };
}

export interface CoinCapacityInput {
  coinId: CoinId;
  coveringLps: Array<{ usdtHeld: Decimal; usdtAllocated: Decimal }>;
}

/**
 * "Pending demand" is never defined in the source spec. Since LPs are
 * assigned synchronously at order time (no order queue — resolved open
 * item), there is no forward-looking demand figure to sum here: a coin is
 * buy-blocked when its covering LPs have no remaining headroom at all, or
 * when nothing covers it.
 */
export function computeCoinCapacity(input: CoinCapacityInput): CoinCapacityState {
  const { coinId, coveringLps } = input;

  const capacityUsdt = coveringLps.reduce(
    (sum, lp) => sum.plus(lp.usdtHeld.minus(lp.usdtAllocated)),
    new Decimal(0),
  );

  return {
    coinId,
    capacityUsdt,
    coveringLpCount: coveringLps.length,
    singleSource: coveringLps.length === 1,
    buyBlocked: coveringLps.length === 0 || capacityUsdt.lte(0),
  };
}

export interface LpBufferInput {
  lpId: string;
  name: string;
  usdtHeld: Decimal;
  usdtAllocated: Decimal;
  coinCount: number;
}

/**
 * "Same band thresholds as coins" (§1.6) — but LP utilisation has no notion
 * of a within-period peak (it's a live ratio, not accumulated since period
 * start), so it bands on the live utilisation value directly.
 */
export function computeLpBufferState(input: LpBufferInput): LpBufferState {
  const { lpId, name, usdtHeld, usdtAllocated, coinCount } = input;

  const utilisation = usdtHeld.isZero() ? null : usdtAllocated.div(usdtHeld);
  const headroom = usdtHeld.minus(usdtAllocated);
  const band = statusBandFromPeak(utilisation ?? new Decimal(0));

  return { lpId, name, utilisation, headroom, band, coinCount };
}
