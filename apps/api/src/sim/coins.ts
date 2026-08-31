import type { PrismaClient } from "../db.js";

/**
 * The spec says "~52 coins" but never enumerates them. This is a
 * representative subset for the simulator/dashboard to exercise — not a
 * claim about Coinbit's real listed-coin set. Flagged as underspecified.
 */
export const DEFAULT_COINS = [
  { id: "BTC", displayName: "Bitcoin", decimals: 8 },
  { id: "ETH", displayName: "Ethereum", decimals: 18 },
  { id: "SOL", displayName: "Solana", decimals: 9 },
  { id: "XRP", displayName: "XRP", decimals: 6 },
  { id: "ADA", displayName: "Cardano", decimals: 6 },
  { id: "DOGE", displayName: "Dogecoin", decimals: 8 },
];

export async function ensureDefaultCoins(prisma: PrismaClient): Promise<void> {
  for (const coin of DEFAULT_COINS) {
    await prisma.coin.upsert({
      where: { id: coin.id },
      create: coin,
      update: {},
    });
  }
}
