import type Decimal from "decimal.js";
import type { CoinId } from "./coin.js";

export interface LpState {
  id: string;
  name: string;
  usdtHeld: Decimal;
  usdtAllocated: Decimal;
  coverage: CoinId[]; // coins this LP quotes
}
