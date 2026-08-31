import Decimal from "decimal.js";
import type { PrismaClient } from "../../prisma/generated/client/index.js";
import { notifyBufferStateChanged } from "../events.js";

export interface LpWithCoverage {
  id: string;
  name: string;
  usdtHeld: Decimal;
  usdtAllocated: Decimal;
  coverage: string[]; // coin ids
}

export async function listLps(prisma: PrismaClient): Promise<LpWithCoverage[]> {
  const rows = await prisma.lpProvider.findMany({ include: { coverage: true } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    usdtHeld: new Decimal(row.usdtHeld.toString()),
    usdtAllocated: new Decimal(row.usdtAllocated.toString()),
    coverage: row.coverage.map((c) => c.coinId),
  }));
}

export interface SetLpStateInput {
  id?: string; // omit to create
  name: string;
  usdtHeld: Decimal;
  usdtAllocated: Decimal;
  coverage: string[]; // full replacement of coin coverage
}

/** Sim's "Set LP state" — direct write, not routed through the ledger. */
export async function setLpState(prisma: PrismaClient, input: SetLpStateInput) {
  const data = {
    name: input.name,
    usdtHeld: input.usdtHeld.toString(),
    usdtAllocated: input.usdtAllocated.toString(),
  };

  const lp = input.id
    ? await prisma.lpProvider.update({ where: { id: input.id }, data })
    : await prisma.lpProvider.upsert({
        where: { name: input.name },
        create: data,
        update: data,
      });

  await prisma.lpCoinCoverage.deleteMany({ where: { lpId: lp.id } });
  if (input.coverage.length > 0) {
    await prisma.lpCoinCoverage.createMany({
      data: input.coverage.map((coinId) => ({ lpId: lp.id, coinId })),
    });
  }

  notifyBufferStateChanged();
  return lp;
}

/** Increment usdtAllocated on a BUY execution — the commitment is locked at order time. */
export async function allocateLpUsdt(prisma: PrismaClient, lpId: string, amountUsdt: Decimal) {
  const lp = await prisma.lpProvider.findUniqueOrThrow({ where: { id: lpId } });
  const nextAllocated = new Decimal(lp.usdtAllocated.toString()).plus(amountUsdt);
  const updated = await prisma.lpProvider.update({
    where: { id: lpId },
    data: { usdtAllocated: nextAllocated.toString() },
  });
  notifyBufferStateChanged();
  return updated;
}
