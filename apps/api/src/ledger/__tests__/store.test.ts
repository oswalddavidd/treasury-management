import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "../../db.js";
import { appendLedgerEvent } from "../store.js";

async function resetDb() {
  await prisma.snapshotCoinBalance.deleteMany();
  await prisma.periodSnapshot.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.lpCoinCoverage.deleteMany();
  await prisma.lpProvider.deleteMany();
  await prisma.fxRateEvent.deleteMany();
  await prisma.coin.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await resetDb();
  await prisma.coin.create({ data: { id: "BTC", displayName: "Bitcoin", decimals: 8 } });
  await prisma.user.create({ data: { id: "user-1" } });
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("appendLedgerEvent", () => {
  it("increments the coin's gate balance on a BUY, by the coin amount bought", async () => {
    await appendLedgerEvent(prisma, {
      type: "BUY",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(50_000_000),
      coinAmount: new Decimal(50),
      priceIdrPerCoin: new Decimal(1_000_000),
      occurredAt: new Date(),
    });

    const coin = await prisma.coin.findUniqueOrThrow({ where: { id: "BTC" } });
    expect(new Decimal(coin.gateBalance.toString()).toString()).toBe("50");

    await appendLedgerEvent(prisma, {
      type: "BUY",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(10_000_000),
      coinAmount: new Decimal(10),
      priceIdrPerCoin: new Decimal(1_000_000),
      occurredAt: new Date(),
    });

    const coinAfterSecondBuy = await prisma.coin.findUniqueOrThrow({ where: { id: "BTC" } });
    expect(new Decimal(coinAfterSecondBuy.gateBalance.toString()).toString()).toBe("60");
  });

  it("does not touch gate balance on a SELL", async () => {
    await appendLedgerEvent(prisma, {
      type: "SELL",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(50_000_000),
      coinAmount: new Decimal(50),
      priceIdrPerCoin: new Decimal(1_000_000),
      occurredAt: new Date(),
    });

    const coin = await prisma.coin.findUniqueOrThrow({ where: { id: "BTC" } });
    expect(new Decimal(coin.gateBalance.toString()).toString()).toBe("0");
  });

  it("does not touch gate balance on IDR-only events", async () => {
    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_IDR",
      userId: "user-1",
      idrAmount: new Decimal(50_000_000),
      occurredAt: new Date(),
    });

    const coin = await prisma.coin.findUniqueOrThrow({ where: { id: "BTC" } });
    expect(new Decimal(coin.gateBalance.toString()).toString()).toBe("0");
  });
});
