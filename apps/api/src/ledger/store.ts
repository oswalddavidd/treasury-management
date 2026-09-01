import Decimal from "decimal.js";
import { Prisma, type PrismaClient } from "../../prisma/generated/client/index.js";
import type { LedgerEventType } from "../../prisma/generated/client/index.js";
import { notifyBufferStateChanged } from "../events.js";
import { decrementWithdrawalVault, incrementDepositVault } from "../idrVault/store.js";

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
  // actual holdings grow in real time as buys land. A SELL draws down the
  // same gate capacity in the other direction — symmetric to how headroom
  // depletes on the free-float side. Both are independent of the frozen
  // free float itself; the gate resets to the newly-computed free float at
  // every rebalancing (period close) — see closePeriod.
  if (input.type === "BUY" && input.coinId && input.coinAmount) {
    await db.coin.update({
      where: { id: input.coinId },
      data: { gateBalance: { increment: input.coinAmount.toString() } },
    });
  } else if (input.type === "SELL" && input.coinId && input.coinAmount) {
    await db.coin.update({
      where: { id: input.coinId },
      data: { gateBalance: { decrement: input.coinAmount.toString() } },
    });
  }

  // Deposit Vault: real-time, full amount, purely observational (see
  // idrVault/store.ts) — never affects any formula. Withdrawal Vault: real-
  // time deduction only; it's otherwise only ever set at rebalancing.
  if (input.type === "DEPOSIT_IDR" && input.idrAmount) {
    await incrementDepositVault(db, input.idrAmount);
  } else if (input.type === "WITHDRAW_IDR" && input.idrAmount) {
    await decrementWithdrawalVault(db, input.idrAmount);
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

export interface BuySideTrajectory {
  netBuy: Decimal; // buy - sell only, for display — a withdrawal is not a buy
  withdrawalVolume: Decimal; // cumulative withdrawals since period start, monotonic
  peak: Decimal; // peak of the COMBINED (netBuy + withdrawalVolume) trajectory, floored at 0
}

/**
 * Buying and withdrawing draw on the same frozen IDR permission, so the
 * peak that matters for banding is the peak of the *combined* trajectory —
 * not peak(netBuy) plus peak(withdrawalVolume) independently, since those
 * two can peak at different moments. This walks BUY/SELL/WITHDRAW_IDR
 * events together in seq order to get that combined peak right, while
 * still returning netBuy and withdrawalVolume separately for display and
 * for the USDT side (which withdrawals don't affect at all).
 */
export async function getIdrBuySideTrajectory(db: Db, sinceSeq: bigint): Promise<BuySideTrajectory> {
  const events = await db.ledgerEvent.findMany({
    where: { seq: { gt: sinceSeq }, type: { in: ["BUY", "SELL", "WITHDRAW_IDR"] } },
    orderBy: { seq: "asc" },
    select: { type: true, idrAmount: true },
  });

  let netBuy = new Decimal(0);
  let withdrawalVolume = new Decimal(0);
  let combined = new Decimal(0);
  let peak = new Decimal(0);

  for (const event of events) {
    const amount = new Decimal(event.idrAmount?.toString() ?? 0);
    if (event.type === "BUY") {
      netBuy = netBuy.plus(amount);
      combined = combined.plus(amount);
    } else if (event.type === "SELL") {
      netBuy = netBuy.minus(amount);
      combined = combined.minus(amount);
    } else {
      // WITHDRAW_IDR
      withdrawalVolume = withdrawalVolume.plus(amount);
      combined = combined.plus(amount);
    }
    if (combined.gt(peak)) peak = combined;
  }

  return { netBuy, withdrawalVolume, peak };
}

/**
 * The IDR-value delta of BUY/SELL trades only, within (sinceSeq, uptoSeq] —
 * used for the trailing-period launch-mode average (§1.7), which is
 * deliberately scoped to trading activity only, not withdrawals. Positive
 * = net buying in that window.
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
