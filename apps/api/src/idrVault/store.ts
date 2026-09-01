import Decimal from "decimal.js";
import type { PrismaClient, Prisma } from "../../prisma/generated/client/index.js";
import { notifyBufferStateChanged } from "../events.js";

type Db = PrismaClient | Prisma.TransactionClient;

const ROW_ID = 1;

export interface IdrVaultStateResult {
  depositVault: Decimal;
  withdrawalVault: Decimal;
}

export async function getIdrVaultState(db: Db): Promise<IdrVaultStateResult> {
  const row = await db.idrVaultState.findUnique({ where: { id: ROW_ID } });
  return {
    depositVault: new Decimal(row?.depositVault.toString() ?? 0),
    withdrawalVault: new Decimal(row?.withdrawalVault.toString() ?? 0),
  };
}

/** Real-time: the full deposit amount, immediately. Purely observational. */
export async function incrementDepositVault(db: Db, amount: Decimal): Promise<void> {
  await db.idrVaultState.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, depositVault: amount.toString(), withdrawalVault: "0" },
    update: { depositVault: { increment: amount.toString() } },
  });
}

/** Real-time: the full withdrawal amount, immediately. Can go negative — a real deficit, not clamped away. */
export async function decrementWithdrawalVault(db: Db, amount: Decimal): Promise<void> {
  await db.idrVaultState.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, depositVault: "0", withdrawalVault: amount.negated().toString() },
    update: { withdrawalVault: { decrement: amount.toString() } },
  });
}

/** Rebalancing: Withdrawal Vault hard-resets to the newly-computed FF_idr; Deposit Vault resets to 0. */
export async function rebalanceIdrVaults(db: Db, newFfIdr: Decimal): Promise<void> {
  await db.idrVaultState.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, depositVault: "0", withdrawalVault: newFfIdr.toString() },
    update: { depositVault: "0", withdrawalVault: newFfIdr.toString() },
  });
}

/** Manual override for testing — same pattern as setGateBalance. */
export async function setWithdrawalVault(db: PrismaClient, amount: Decimal): Promise<void> {
  await db.idrVaultState.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, depositVault: "0", withdrawalVault: amount.toString() },
    update: { withdrawalVault: amount.toString() },
  });
  notifyBufferStateChanged();
}
