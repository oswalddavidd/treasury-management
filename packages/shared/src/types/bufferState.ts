import type Decimal from "decimal.js";
import type { CoinId } from "./coin.js";

export type StatusBand = "HALTED" | "CRITICAL" | "ALERT" | "WATCH" | "NORMAL";

export interface CoinBufferState {
  coinId: CoinId;
  freeFloat: Decimal; // FF[c], frozen for the period
  netSell: Decimal; // NS[c](t), signed, real-time
  netSellClamped: Decimal; // max(0, NS) — display only, never used in maths
  consumed: Decimal | null; // NS/FF; null when FF == 0 (launch mode — see §1.7)
  peak: Decimal; // monotonic max of consumed over the period, >= 0
  headroom: Decimal; // FF - NS
  band: StatusBand;
}

export type BindingSource = "IDR" | "USDT";

export interface BuySideState {
  netBuy: Decimal; // NB(t), IDR
  ceilingIdr: Decimal; // frozen, FF_idr
  ceilingUsdt: Decimal; // real-time, IDR-denominated
  consumed: Decimal | null; // NB/ceilingIdr; null when ceilingIdr == 0
  peak: Decimal;
  headroomIdr: Decimal;
  headroomUsdt: Decimal;
  headroomEffective: Decimal; // min(headroomIdr, headroomUsdt)
  bindingSource: BindingSource;
  unreachable: Decimal; // max(0, ceilingIdr - ceilingUsdt) — dead zone, never headroom
  band: StatusBand;
}

export interface CoinCapacityState {
  coinId: CoinId;
  capacityUsdt: Decimal; // sum over covering LPs of (held - allocated)
  coveringLpCount: number;
  singleSource: boolean;
  buyBlocked: boolean;
}

export interface LpBufferState {
  lpId: string;
  name: string;
  utilisation: Decimal | null; // allocated/held; null when held == 0
  headroom: Decimal; // held - allocated
  band: StatusBand;
  coinCount: number;
}

export interface SellSideRollup {
  worstCoin: CoinId | null; // argmax peak
  bandCounts: Record<StatusBand, number>;
  blockedCount: number; // count in HALTED band
}
