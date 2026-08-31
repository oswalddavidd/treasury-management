import type Decimal from "decimal.js";
import type { CoinId } from "./coin.js";

export type LedgerEventType =
  | "DEPOSIT_IDR"
  | "WITHDRAW_IDR"
  | "DEPOSIT_COIN"
  | "WITHDRAW_COIN"
  | "BUY"
  | "SELL";

export interface LedgerEvent {
  seq: bigint; // monotonic commit order — authoritative, never occurredAt
  type: LedgerEventType;
  userId: string;
  coinId?: CoinId;
  idrAmount?: Decimal;
  coinAmount?: Decimal;
  priceIdrPerCoin?: Decimal;
  lpId?: string; // BUY only — LP assigned at order time
  occurredAt: Date; // simulated clock time — display/audit only
}
