import Decimal from "decimal.js";
import type { PrismaClient } from "../db.js";
import type { SimClock } from "../clock/simClock.js";
import { appendLedgerEvent } from "../ledger/store.js";
import { allocateLpUsdt, listLps } from "../lp/store.js";
import { getLatestFxRate } from "../fx/store.js";

export async function depositIdr(prisma: PrismaClient, clock: SimClock, userId: string, amount: Decimal) {
  return appendLedgerEvent(prisma, {
    type: "DEPOSIT_IDR",
    userId,
    idrAmount: amount,
    occurredAt: clock.now(),
  });
}

export async function withdrawIdr(prisma: PrismaClient, clock: SimClock, userId: string, amount: Decimal) {
  return appendLedgerEvent(prisma, {
    type: "WITHDRAW_IDR",
    userId,
    idrAmount: amount,
    occurredAt: clock.now(),
  });
}

export interface BuyInput {
  userId: string;
  coinId: string;
  idrAmount: Decimal;
  price: Decimal; // IDR per unit
  lpId?: string;
}

/**
 * LP is assigned synchronously at order time (resolved open item — no
 * order queue). If no lpId is given, picks the covering LP with the most
 * remaining headroom. Does NOT block if capacity is insufficient — the sim
 * must be able to push a coin over its limits on purpose (see the
 * "one coin breaching" / "USDT ceiling binds" scenarios), unlike a real
 * order path, which is out of scope here.
 */
export async function executeBuy(
  prisma: PrismaClient,
  occurredAt: Date,
  input: BuyInput,
) {
  const coinAmount = input.idrAmount.div(input.price);

  let lpId = input.lpId;
  if (!lpId) {
    const lps = await listLps(prisma);
    const covering = lps
      .filter((lp) => lp.coverage.includes(input.coinId))
      .sort((a, b) =>
        b.usdtHeld.minus(b.usdtAllocated).comparedTo(a.usdtHeld.minus(a.usdtAllocated)),
      );
    lpId = covering[0]?.id;
  }

  const event = await appendLedgerEvent(prisma, {
    type: "BUY",
    userId: input.userId,
    coinId: input.coinId,
    idrAmount: input.idrAmount,
    coinAmount,
    priceIdrPerCoin: input.price,
    lpId,
    occurredAt,
  });

  if (lpId) {
    const fxRate = await getLatestFxRate(prisma);
    if (fxRate && !fxRate.isZero()) {
      await allocateLpUsdt(prisma, lpId, input.idrAmount.div(fxRate));
    }
  }

  return event;
}

export interface SellInput {
  userId: string;
  coinId: string;
  coinAmount: Decimal;
  price: Decimal; // IDR per unit
}

export async function executeSell(prisma: PrismaClient, occurredAt: Date, input: SellInput) {
  return appendLedgerEvent(prisma, {
    type: "SELL",
    userId: input.userId,
    coinId: input.coinId,
    coinAmount: input.coinAmount,
    idrAmount: input.coinAmount.times(input.price),
    priceIdrPerCoin: input.price,
    occurredAt,
  });
}

export interface BulkGenerateInput {
  count: number;
  hours: number;
  buyBias: number; // 0..1, probability a given trade is a BUY rather than a SELL
  userId: string;
  coinIds: string[];
  priceByCoin: Record<string, Decimal>;
  idrAmountRange: [number, number]; // per-trade IDR notional range
}

/**
 * Random generator for realistic trajectories. Events are timestamped
 * across the trailing window and inserted in chronological order so seq
 * order matches occurredAt order — mixing them up would make the
 * within-period trajectory (and its peak) look scrambled.
 */
export async function bulkGenerate(prisma: PrismaClient, clock: SimClock, input: BulkGenerateInput) {
  const nowMs = clock.now().getTime();
  const windowMs = input.hours * 60 * 60 * 1000;

  const plan = Array.from({ length: input.count }, () => {
    const occurredAt = new Date(nowMs - Math.random() * windowMs);
    const coinId = input.coinIds[Math.floor(Math.random() * input.coinIds.length)];
    const isBuy = Math.random() < input.buyBias;
    const [min, max] = input.idrAmountRange;
    const idrAmount = new Decimal(min + Math.random() * (max - min)).toDecimalPlaces(2);
    return { occurredAt, coinId, isBuy, idrAmount };
  }).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const results = [];
  for (const trade of plan) {
    const price = input.priceByCoin[trade.coinId] ?? new Decimal(1);
    if (trade.isBuy) {
      results.push(
        await executeBuy(prisma, trade.occurredAt, {
          userId: input.userId,
          coinId: trade.coinId,
          idrAmount: trade.idrAmount,
          price,
        }),
      );
    } else {
      results.push(
        await executeSell(prisma, trade.occurredAt, {
          userId: input.userId,
          coinId: trade.coinId,
          coinAmount: trade.idrAmount.div(price),
          price,
        }),
      );
    }
  }
  return results;
}
