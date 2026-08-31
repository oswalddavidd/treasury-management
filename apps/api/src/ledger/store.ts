import Decimal from "decimal.js";
import { Prisma, type PrismaClient } from "../../prisma/generated/client/index.js";
import type { LedgerEventType } from "../../prisma/generated/client/index.js";
import { notifyBufferStateChanged } from "../events.js";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AppendLedgerEventInput {
  type: LedgerEventType;
  userId: string;
  coinId?: string;
  idrAmount?: Decimal;
  coinAmount?: Decimal;
  priceIdrPerCoin?: Decimal;
  lpId?: string;
  occurredAt: Date;
}

/** The only way ledger rows get created — never updated, never deleted. */
export async function appendLedgerEvent(db: Db, input: AppendLedgerEventInput) {
  const event = await db.ledgerEvent.create({
    data: {
      type: input.type,
      userId: input.userId,
      coinId: input.coinId,
      idrAmount: input.idrAmount?.toString(),
      coinAmount: input.coinAmount?.toString(),
      priceIdrPerCoin: input.priceIdrPerCoin?.toString(),
      lpId: input.lpId,
      occurredAt: input.occurredAt,
    },
  });

  // A BUY means Coinbit acquires that crypto to fulfill it — the gate's
  // actual holdings grow in real time as buys land, independent of the
  // frozen free float. Resets to the newly-computed free float at every
  // rebalancing (period close) — see closePeriod.
  if (input.type === "BUY" && input.coinId && input.coinAmount) {
    await db.coin.update({
      where: { id: input.coinId },
      data: { gateBalance: { increment: input.coinAmount.toString() } },
    });
  }

  notifyBufferStateChanged();
  return event;
}

export async function getLatestSeq(db: Db): Promise<bigint> {
  const result = await db.ledgerEvent.aggregate({ _max: { seq: true } });
  return result._max.seq ?? 0n;
}

export interface Trajectory {
  current: Decimal; // cumulative value as of the latest event scanned
  peak: Decimal; // max cumulative value at any prefix, floored at 0 (includes t0)
}

/**
 * NS[c](t) trajectory since `sinceSeq` (strictly greater): running
 * sells-minus-buys of one coin, plus the running peak of that trajectory —
 * the peak is what Peak[c](t) = max over [t0,t] of Consumed[c](τ) needs,
 * computed here in raw net-sell units (caller divides by FF once).
 */
export async function getCoinNetSellTrajectory(
  db: Db,
  coinId: string,
  sinceSeq: bigint,
): Promise<Trajectory> {
  const events = await db.ledgerEvent.findMany({
    where: { coinId, seq: { gt: sinceSeq }, type: { in: ["BUY", "SELL"] } },
    orderBy: { seq: "asc" },
    select: { type: true, coinAmount: true },
  });

  let running = new Decimal(0);
  let peak = new Decimal(0);
  for (const event of events) {
    const amount = new Decimal(event.coinAmount?.toString() ?? 0);
    running = event.type === "SELL" ? running.plus(amount) : running.minus(amount);
    if (running.gt(peak)) peak = running;
  }
  return { current: running, peak };
}

/**
 * NB(t) trajectory since `sinceSeq`: running buy-minus-sell value in IDR
 * across all coins (buy side is one shared buffer, not per-coin).
 */
export async function getIdrNetBuyTrajectory(db: Db, sinceSeq: bigint): Promise<Trajectory> {
  const events = await db.ledgerEvent.findMany({
    where: { seq: { gt: sinceSeq }, type: { in: ["BUY", "SELL"] } },
    orderBy: { seq: "asc" },
    select: { type: true, idrAmount: true },
  });

  let running = new Decimal(0);
  let peak = new Decimal(0);
  for (const event of events) {
    const amount = new Decimal(event.idrAmount?.toString() ?? 0);
    running = event.type === "BUY" ? running.plus(amount) : running.minus(amount);
    if (running.gt(peak)) peak = running;
  }
  return { current: running, peak };
}

/**
 * The IDR-value delta of BUY/SELL trades only, within (sinceSeq, uptoSeq] —
 * used both for the trailing-period launch-mode average and as the closed
 * -period equivalent of getIdrNetBuyTrajectory's `current`. Positive = net
 * buying in that window.
 */
export async function getIdrNetBuyForWindow(
  db: Db,
  sinceSeq: bigint,
  uptoSeq: bigint,
): Promise<Decimal> {
  const events = await db.ledgerEvent.findMany({
    where: { seq: { gt: sinceSeq, lte: uptoSeq }, type: { in: ["BUY", "SELL"] } },
    select: { type: true, idrAmount: true },
  });

  let net = new Decimal(0);
  for (const event of events) {
    const amount = new Decimal(event.idrAmount?.toString() ?? 0);
    net = event.type === "BUY" ? net.plus(amount) : net.minus(amount);
  }
  return net;
}

/** BB[coin] — total user holdings of `coinId`, up to and including `uptoSeq`. */
export async function getCoinBalance(db: Db, coinId: string, uptoSeq: bigint): Promise<Decimal> {
  const events = await db.ledgerEvent.findMany({
    where: {
      coinId,
      seq: { lte: uptoSeq },
      type: { in: ["DEPOSIT_COIN", "WITHDRAW_COIN", "BUY", "SELL"] },
    },
    select: { type: true, coinAmount: true },
  });

  let balance = new Decimal(0);
  for (const event of events) {
    const amount = new Decimal(event.coinAmount?.toString() ?? 0);
    if (event.type === "DEPOSIT_COIN" || event.type === "BUY") balance = balance.plus(amount);
    else balance = balance.minus(amount); // WITHDRAW_COIN, SELL
  }
  return balance;
}

/** BB_idr — total user IDR holdings, up to and including `uptoSeq`. */
export async function getIdrBalance(db: Db, uptoSeq: bigint): Promise<Decimal> {
  const events = await db.ledgerEvent.findMany({
    where: {
      seq: { lte: uptoSeq },
      type: { in: ["DEPOSIT_IDR", "WITHDRAW_IDR", "BUY", "SELL"] },
    },
    select: { type: true, idrAmount: true },
  });

  let balance = new Decimal(0);
  for (const event of events) {
    const amount = new Decimal(event.idrAmount?.toString() ?? 0);
    if (event.type === "DEPOSIT_IDR" || event.type === "SELL") balance = balance.plus(amount);
    else balance = balance.minus(amount); // WITHDRAW_IDR, BUY
  }
  return balance;
}

/** Most recent trade price for a coin (IDR per unit), or null if never traded. */
export async function getLastTradePrice(db: Db, coinId: string): Promise<Decimal | null> {
  const event = await db.ledgerEvent.findFirst({
    where: { coinId, type: { in: ["BUY", "SELL"] }, priceIdrPerCoin: { not: null } },
    orderBy: { seq: "desc" },
    select: { priceIdrPerCoin: true },
  });
  return event?.priceIdrPerCoin ? new Decimal(event.priceIdrPerCoin.toString()) : null;
}
