import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "../../db.js";
import { appendLedgerEvent } from "../../ledger/store.js";
import { setFxRate } from "../../fx/store.js";
import { setLpState } from "../../lp/store.js";
import { SimClock } from "../../clock/simClock.js";
import { closePeriod } from "../../snapshot/periodClose.js";
import { computeCurrentBufferState, type BufferComputedResult } from "../index.js";

async function resetDb() {
  await prisma.snapshotCoinBalance.deleteMany();
  await prisma.periodSnapshot.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.lpCoinCoverage.deleteMany();
  await prisma.lpProvider.deleteMany();
  await prisma.fxRateEvent.deleteMany();
  await prisma.idrVaultState.deleteMany();
  await prisma.simClockState.deleteMany();
  await prisma.coin.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await resetDb();
  await prisma.coin.create({ data: { id: "BTC", displayName: "Bitcoin", decimals: 8 } });
  await prisma.coin.create({ data: { id: "ETH", displayName: "Ethereum", decimals: 18 } });
  await prisma.user.create({ data: { id: "user-1" } });
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("computeCurrentBufferState", () => {
  it("reports launch mode with no formulas evaluated before any period has closed", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z"));
    const result = await computeCurrentBufferState(prisma, clock);
    expect(result.launchMode).toBe(true);
    expect(result.period).toBeNull();
    expect(result.coinStates).toHaveLength(0);
  });

  it("computes per-coin consumption and bands after a period closes with holdings", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z")); // Period A

    // seed BTC holdings before close so the next period's FF is nonzero
    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_COIN",
      userId: "user-1",
      coinId: "BTC",
      coinAmount: new Decimal(100),
      occurredAt: clock.now(),
    });
    await closePeriod(prisma, clock); // snapshot 1: BB[BTC]=100 -> FF[BTC]=30, governs Period B

    clock.setTime(new Date("2026-08-27T05:00:00.000Z")); // now inside Period B (quiet, no trades)
    await closePeriod(prisma, clock); // snapshot 2: closes Period B, now one trailing window exists

    clock.setTime(new Date("2026-08-27T17:00:00.000Z")); // now inside the period snapshot 2 governs

    // sell 15 BTC against nothing (no counterparty bookkeeping needed here —
    // ledger just records the trade)
    await appendLedgerEvent(prisma, {
      type: "SELL",
      userId: "user-1",
      coinId: "BTC",
      coinAmount: new Decimal(15),
      idrAmount: new Decimal(15_000_000),
      priceIdrPerCoin: new Decimal(1_000_000),
      occurredAt: clock.now(),
    });

    const result = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    expect(result.launchMode).toBe(false);
    const btc = result.coinStates.find((c) => c.coinId === "BTC")!;
    expect(btc.freeFloat.toString()).toBe("30");
    expect(btc.netSell.toString()).toBe("15");
    expect(btc.consumed?.toString()).toBe("0.5");
    expect(btc.band).toBe("ALERT");

    const eth = result.coinStates.find((c) => c.coinId === "ETH")!;
    expect(eth.freeFloat.toString()).toBe("0"); // never held, launch-mode-null consumed
    expect(eth.consumed).toBeNull();
  });

  it("flags one breaching coin without dragging the others' bands down", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z"));

    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_COIN",
      userId: "user-1",
      coinId: "BTC",
      coinAmount: new Decimal(100),
      occurredAt: clock.now(),
    });
    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_COIN",
      userId: "user-1",
      coinId: "ETH",
      coinAmount: new Decimal(100),
      occurredAt: clock.now(),
    });
    await closePeriod(prisma, clock); // FF[BTC]=30, FF[ETH]=30

    clock.setTime(new Date("2026-08-27T05:00:00.000Z"));

    // BTC breaches past 100%, ETH stays quiet
    await appendLedgerEvent(prisma, {
      type: "SELL",
      userId: "user-1",
      coinId: "BTC",
      coinAmount: new Decimal(40),
      idrAmount: new Decimal(1),
      priceIdrPerCoin: new Decimal(1),
      occurredAt: clock.now(),
    });
    await appendLedgerEvent(prisma, {
      type: "SELL",
      userId: "user-1",
      coinId: "ETH",
      coinAmount: new Decimal(1),
      idrAmount: new Decimal(1),
      priceIdrPerCoin: new Decimal(1),
      occurredAt: clock.now(),
    });

    const result = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    const btc = result.coinStates.find((c) => c.coinId === "BTC")!;
    const eth = result.coinStates.find((c) => c.coinId === "ETH")!;
    expect(btc.band).toBe("HALTED");
    expect(eth.band).toBe("NORMAL");
    expect(result.rollup.worstCoin).toBe("BTC");
    expect(result.rollup.blockedCount).toBe(1);
  });

  it("flips buy-side binding source when LP liquidity drops below the IDR ceiling", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z"));

    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_IDR",
      userId: "user-1",
      idrAmount: new Decimal(1_000_000_000),
      occurredAt: clock.now(),
    });
    await closePeriod(prisma, clock); // BB_idr = 1e9 -> ceilingIdr = 2e8 (20%)

    clock.setTime(new Date("2026-08-27T05:00:00.000Z"));
    await setFxRate(prisma, new Decimal(15_000), clock.now());
    // LP holds far less than the IDR ceiling once converted: 5,000 USDT * 15,000 = 75,000,000 IDR << 200,000,000
    await setLpState(prisma, {
      name: "LP-A",
      usdtHeld: new Decimal(5_000),
      usdtAllocated: new Decimal(0),
      coverage: ["BTC"],
    });

    const result = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    expect(result.buySide.bindingSource).toBe("USDT");
    expect(result.buySide.unreachable.toString()).toBe("125000000"); // 200M - 75M
  });

  it("adds withdrawal volume into buy-side consumption, through the real DB path — the worked example", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z"));

    await appendLedgerEvent(prisma, {
      type: "DEPOSIT_IDR",
      userId: "user-1",
      idrAmount: new Decimal(100_000),
      occurredAt: clock.now(),
    });
    await closePeriod(prisma, clock); // BB_idr=100,000 -> ceilingIdr = FF_idr = 20,000

    clock.setTime(new Date("2026-08-27T05:00:00.000Z"));
    await setFxRate(prisma, new Decimal(15_000), clock.now());
    await setLpState(prisma, {
      name: "LP-A",
      usdtHeld: new Decimal(1_000_000), // generous — not the constraint in this test
      usdtAllocated: new Decimal(0),
      coverage: ["BTC"],
    });

    await appendLedgerEvent(prisma, {
      type: "BUY",
      userId: "user-1",
      coinId: "BTC",
      idrAmount: new Decimal(10_000),
      coinAmount: new Decimal(10),
      priceIdrPerCoin: new Decimal(1_000),
      occurredAt: clock.now(),
    });

    const afterBuy = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    expect(afterBuy.buySide.consumed?.toString()).toBe("0.5");

    await appendLedgerEvent(prisma, {
      type: "WITHDRAW_IDR",
      userId: "user-1",
      idrAmount: new Decimal(5_000),
      occurredAt: clock.now(),
    });

    const afterWithdrawal = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    expect(afterWithdrawal.buySide.consumed?.toString()).toBe("0.75");
    expect(afterWithdrawal.buySide.netBuy.toString()).toBe("10000"); // unchanged by the withdrawal
    expect(afterWithdrawal.buySide.withdrawalVolume.toString()).toBe("5000");

    // The Withdrawal Vault (separate from this consumption figure) really
    // did get deducted — 20,000 (reset at close) - 5,000 = 15,000.
    expect(afterWithdrawal.withdrawalVault.toString()).toBe("15000");
  });

  it("flags a single-source coin as a concentration risk", async () => {
    const clock = new SimClock(new Date("2026-08-26T17:00:00.000Z"));
    await closePeriod(prisma, clock);
    clock.setTime(new Date("2026-08-27T05:00:00.000Z"));

    await setLpState(prisma, {
      name: "LP-Only",
      usdtHeld: new Decimal(1_000),
      usdtAllocated: new Decimal(0),
      coverage: ["BTC"],
    });

    const result = (await computeCurrentBufferState(prisma, clock)) as BufferComputedResult;
    const btcCapacity = result.coinCapacities.find((c) => c.coinId === "BTC")!;
    expect(btcCapacity.singleSource).toBe(true);
    const ethCapacity = result.coinCapacities.find((c) => c.coinId === "ETH")!;
    expect(ethCapacity.coveringLpCount).toBe(0);
    expect(ethCapacity.buyBlocked).toBe(true);
  });
});
