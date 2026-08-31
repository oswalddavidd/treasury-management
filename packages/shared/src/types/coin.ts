export type CoinId = string; // symbol, e.g. "BTC"

export interface Coin {
  id: CoinId;
  displayName: string;
  decimals: number;
  isActive: boolean;
}
