export type StatusBand = "HALTED" | "CRITICAL" | "ALERT" | "WATCH" | "NORMAL";

export interface CoinBufferStateDTO {
  coinId: string;
  freeFloat: string;
  netSell: string;
  netSellClamped: string;
  consumed: string | null;
  peak: string;
  headroom: string;
  band: StatusBand;
  // Actual observed balance at the LP/custody gate — independently set, not
  // derived from the ledger. gateMismatch flags when it doesn't equal the
  // computed freeFloat, meaning the asset isn't where the books say it is.
  gateBalance: string;
  gateMismatch: boolean;
}

export interface BuySideStateDTO {
  netBuy: string;
  ceilingIdr: string;
  ceilingUsdt: string;
  consumed: string | null;
  peak: string;
  headroomIdr: string;
  headroomUsdt: string;
  headroomEffective: string;
  bindingSource: "IDR" | "USDT";
  unreachable: string;
  band: StatusBand;
}

export interface CoinCapacityDTO {
  coinId: string;
  capacityUsdt: string;
  coveringLpCount: number;
  singleSource: boolean;
  buyBlocked: boolean;
}

export interface LpBufferStateDTO {
  lpId: string;
  name: string;
  utilisation: string | null;
  headroom: string;
  band: StatusBand;
  coinCount: number;
}

export interface SellSideRollupDTO {
  worstCoin: string | null;
  bandCounts: Record<StatusBand, number>;
  blockedCount: number;
}

export interface BufferStateDTO {
  now: string;
  launchMode: boolean;
  period: { start: string; end: string } | null;
  coinStates: CoinBufferStateDTO[];
  rollup: SellSideRollupDTO;
  buySide: BuySideStateDTO | null;
  coinCapacities: CoinCapacityDTO[];
  lpStates: LpBufferStateDTO[];
  reserveCoverage: string | null;
  fxRate?: string | null;
  reason?: string;
  // Deposit Vault: real-time, this period's raw deposits, purely
  // observational — feeds no formula. Withdrawal Vault: the IDR
  // counterpart of Gate Assets, reset to FF_idr at every rebalancing,
  // drawn down in real time only by withdrawals.
  depositVault: string;
  withdrawalVault: string;
  withdrawalVaultMismatch: boolean | null;
}
