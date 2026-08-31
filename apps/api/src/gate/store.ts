import Decimal from "decimal.js";
import type { PrismaClient } from "../db.js";
import { notifyBufferStateChanged } from "../events.js";

/** Direct write, not a ledger event — same pattern as LP state. */
export async function setGateBalance(prisma: PrismaClient, coinId: string, amount: Decimal) {
  const coin = await prisma.coin.update({
    where: { id: coinId },
    data: { gateBalance: amount.toString() },
  });
  notifyBufferStateChanged();
  return coin;
}
