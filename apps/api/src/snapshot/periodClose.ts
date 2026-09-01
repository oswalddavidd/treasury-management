import { computeCoinFreeFloat, computeIdrFreeFloat } from "@coinbit/shared";
import type { PrismaClient } from "../../prisma/generated/client/index.js";
import type { Clock } from "../clock/types.js";
import { nextPeriod, periodFor } from "../domain/period.js";
import { getCoinBalance, getIdrBalance, getLatestSeq } from "../ledger/store.js";
import { rebalanceIdrVaults } from "../idrVault/store.js";
import { notifyBufferStateChanged } from "../events.js";

export class PeriodAlreadyClosedError extends Error {
  constructor(effectiveFrom: Date) {
    super(
      `Period already closed: a snapshot effective ${effectiveFrom.toISOString()} already exists. ` +
        "Advance the simulated clock past it before closing again.",
    );
    this.name = "PeriodAlreadyClosedError";
  }
}

/**
 * §1.3 — closes the current period and writes the snapshot that governs the
 * *next* one, as a single atomic transaction. If anything fails partway
 * through, the whole transaction rolls back and no partial snapshot exists.
 *
 * `seqBoundary` is the latest ledger seq visible inside this transaction at
 * the moment of close — the boundary rule (§1.3: "strictly before the next
 * period's start instant") is enforced by using seq as the ordering key
 * everywhere balances are read, never occurredAt/createdAt.
 */
export async function closePeriod(prisma: PrismaClient, clock: Clock) {
  const now = clock.now();
  const current = periodFor(now);
  const upcoming = nextPeriod(current);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.periodSnapshot.findUnique({
      where: { effectiveFrom: upcoming.start },
      select: { id: true },
    });
    if (existing) throw new PeriodAlreadyClosedError(upcoming.start);

    const seqBoundary = await getLatestSeq(tx);

    const coins = await tx.coin.findMany({ where: { isActive: true } });
    const bbIdr = await getIdrBalance(tx, seqBoundary);

    const snapshot = await tx.periodSnapshot.create({
      data: {
        effectiveFrom: upcoming.start,
        effectiveTo: upcoming.end,
        seqBoundary,
        bbIdr: bbIdr.toString(),
      },
    });

    // IDR side of rebalancing: Withdrawal Vault hard-resets to the newly-
    // computed FF_idr (same treatment as Gate Assets for crypto); Deposit
    // Vault resets to 0 — it's scoped to "this period's incoming deposits"
    // and feeds nothing else.
    const newFfIdr = computeIdrFreeFloat(bbIdr);
    await rebalanceIdrVaults(tx, newFfIdr);

    for (const coin of coins) {
      const bb = await getCoinBalance(tx, coin.id, seqBoundary);
      await tx.snapshotCoinBalance.create({
        data: { snapshotId: snapshot.id, coinId: coin.id, bbAmount: bb.toString() },
      });

      // Rebalancing: at every period boundary, the gate's actual holdings
      // get swept back down to exactly the newly-computed free float — the
      // rest moves to custody. Whatever the gate accumulated from buys (or
      // any manual override) during the period that just ended is
      // overwritten here, on purpose.
      const freeFloat = computeCoinFreeFloat(bb);
      await tx.coin.update({
        where: { id: coin.id },
        data: { gateBalance: freeFloat.toString() },
      });
    }

    return tx.periodSnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
      include: { coinBalances: true },
    });
  }).then((result) => {
    notifyBufferStateChanged();
    return result;
  });
}

/** The snapshot currently governing `now` — the most recent one whose effectiveFrom <= now. */
export async function getActiveSnapshot(prisma: PrismaClient, now: Date) {
  return prisma.periodSnapshot.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
    include: { coinBalances: true },
  });
}

/**
 * Up to the last 5 CLOSED periods, oldest first, for the launch-mode
 * trailing average. A period is "closed" once a snapshot exists for the
 * period *after* it, so window i is
 * (snapshots[i-1].seqBoundary, snapshots[i].seqBoundary].
 */
export async function getRecentClosedPeriodWindows(prisma: PrismaClient, limit = 6) {
  const snapshots = await prisma.periodSnapshot.findMany({
    orderBy: { effectiveFrom: "desc" },
    take: limit,
  });
  snapshots.reverse(); // oldest first

  const windows: Array<{ sinceSeq: bigint; uptoSeq: bigint }> = [];
  for (let i = 1; i < snapshots.length; i++) {
    windows.push({ sinceSeq: snapshots[i - 1].seqBoundary, uptoSeq: snapshots[i].seqBoundary });
  }
  return windows.slice(-5);
}
