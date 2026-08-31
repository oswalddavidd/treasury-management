import type Decimal from "decimal.js";
import type { CoinId } from "./coin.js";

export interface PeriodSnapshot {
  effectiveFrom: Date; // period start this snapshot governs
  effectiveTo: Date;
  seqBoundary: bigint; // last ledger seq included (strictly before effectiveFrom)
  bbIdr: Decimal; // BB_idr — total user IDR holdings at snapshot instant
  bbCoin: Record<CoinId, Decimal>; // BB[coin] per coin
}
