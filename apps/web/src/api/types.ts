export interface CoinDTO {
  id: string;
  displayName: string;
  decimals: number;
  isActive: boolean;
  gateBalance: string;
}

export interface PeriodDTO {
  start: string;
  end: string;
}

export interface LedgerEventDTO {
  id: string;
  seq: string;
  type: "DEPOSIT_IDR" | "WITHDRAW_IDR" | "DEPOSIT_COIN" | "WITHDRAW_COIN" | "BUY" | "SELL";
  userId: string;
  coinId: string | null;
  idrAmount: string | null;
  coinAmount: string | null;
  priceIdrPerCoin: string | null;
  lpId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface IdrVaultsDTO {
  depositVault: string;
  withdrawalVault: string;
}

export interface SimStateDTO {
  now: string;
  period: PeriodDTO;
  recentEvents: LedgerEventDTO[];
  coins: CoinDTO[];
  idrVaults: IdrVaultsDTO;
}

export interface LpProviderDTO {
  id: string;
  name: string;
  usdtHeld: string;
  usdtAllocated: string;
}
