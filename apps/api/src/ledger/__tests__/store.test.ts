import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "../../db.js";
import { appendLedgerEvent } from "../store.js";
import { getIdrVaultState, rebalanceIdrVaults } from "../../idrVault/store.js";

async function resetDb() {
  await prisma.snapshotCoinBalance.deleteMany();
  await prisma.periodSnapshot.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.lpCoinCoverage.deleteMany();
  await prisma.lpProvider.deleteMany();
  await prisma.fxRateEvent.deleteMany();
  await prisma.idrVaultState.deleteMany();
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

  it("decrements the coin's gate balance on a SELL, by the coin amount sold", async () => {
    await prisma.coin.update({ where: { id: "BTC" }, data: { gateBalance: "50" } });

    await appendLedgerEvent(prisma, {
      type: "SELL",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(10_000_000),
      coinAmount: new Decimal(10),
      priceIdrPerCoin: new Decimal(1_000_000),
      occurredAt: new Date(),
    });

    const coin = await prisma.coin.findUniqueOrThrow({ where: { id: "BTC" } });
    expect(new Decimal(coin.gateBalance.toString()).toString()).toBe("40");
  });

  it("allows gate balance to go negative on a SELL that exceeds it — a real deficit, not clamped away", async () => {
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
    expect(new Decimal(coin.gateBalance.toString()).toString()).toBe("-50");
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

  it("increments the Deposit Vault in real time on a DEPOSIT_IDR, and leaves the Withdrawal Vault untouched", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(5_000)); // seed a withdrawal vault balance

    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_IDR",
      userId: "user-1",
      idrAmount: new Decimal(100_000),
      occurredAt: new Date(),
    });

    const state = await getIdrVaultState(prisma);
    expect(state.depositVault.toString()).toBe("100000");
    expect(state.withdrawalVault.toString()).toBe("5000"); // untouched by a deposit
  });

  it("decrements the Withdrawal Vault in real time on a WITHDRAW_IDR, and leaves the Deposit Vault untouched", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(20_000));

    await appendLedgerEvent(prisma, {
      type: "WITHDRAW_IDR",
      userId: "user-1",
      idrAmount: new Decimal(3_000),
      occurredAt: new Date(),
    });

    const state = await getIdrVaultState(prisma);
    expect(state.withdrawalVault.toString()).toBe("17000");
    expect(state.depositVault.toString()).toBe("0"); // untouched by a withdrawal
  });

  it("does not touch either IDR vault on a BUY or SELL", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(10_000));
    await appendLedgerEvent(prisma, {
      type: "BUY",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(1_000),
      coinAmount: new Decimal(1),
      priceIdrPerCoin: new Decimal(1_000),
      occurredAt: new Date(),
    });

    const state = await getIdrVaultState(prisma);
    expect(state.depositVault.toString()).toBe("0");
    expect(state.withdrawalVault.toString()).toBe("10000");
  });
});
