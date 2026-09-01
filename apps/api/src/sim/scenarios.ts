import Decimal from "decimal.js";
import type { PrismaClient } from "../db.js";
import type { SimClock } from "../clock/simClock.js";
import { DEFAULT_COINS, ensureDefaultCoins } from "./coins.js";
import { depositIdr, executeBuy, executeSell } from "./actions.js";
import { setFxRate } from "../fx/store.js";
import { setLpState } from "../lp/store.js";
import { closePeriod } from "../snapshot/periodClose.js";
import { notifyBufferStateChanged } from "../events.js";

export const SIM_USER_ID = "sim-user-1";
const DEFAULT_FX_RATE = new Decimal(15_800); // IDR per USD, placeholder reference rate
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/**
 * Wipes all trading state back to zero. The coin catalog is reference data,
 * not trading history — it's re-seeded here rather than deleted, so the
 * dropdown in /sim (which lists a fixed coin set, not a DB read) never goes
 * stale relative to what actually exists to trade against. Same for the
 * default sim user, so the trade forms' default userId always resolves.
 */
export async function resetAll(prisma: PrismaClient, clock: SimClock, resetTime: Date): Promise<void> {
  await prisma.snapshotCoinBalance.deleteMany();
  await prisma.periodSnapshot.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.lpCoinCoverage.deleteMany();
  await prisma.lpProvider.deleteMany();
  await prisma.fxRateEvent.deleteMany();
  await prisma.idrVaultState.deleteMany();
  await prisma.coin.deleteMany();
  await prisma.user.deleteMany();

  await ensureDefaultCoins(prisma);
  await prisma.user.create({ data: { id: SIM_USER_ID, label: "Sim user" } });

  clock.setTime(resetTime);
  await prisma.simClockState.upsert({
    where: { id: 1 },
    create: { id: 1, simulatedNow: resetTime },
    update: { simulatedNow: resetTime },
  });

  notifyBufferStateChanged();
}

const baseline = resetAll;

export type ScenarioName =
  | "zero-balance"
  | "healthy"
  | "one-coin-breaching"
  | "usdt-ceiling-binds"
  | "single-source-starved";

export async function seedScenario(
  prisma: PrismaClient,
  clock: SimClock,
  name: ScenarioName,
  now: Date,
): Promise<void> {
  switch (name) {
    case "zero-balance":
      return seedZeroBalance(prisma, clock, now);
    case "healthy":
      return seedHealthy(prisma, clock, now);
    case "one-coin-breaching":
      return seedOneCoinBreaching(prisma, clock, now);
    case "usdt-ceiling-binds":
      return seedUsdtCeilingBinds(prisma, clock, now);
    case "single-source-starved":
      return seedSingleSourceStarved(prisma, clock, now);
  }
}

/** Everything empty — verifies FF=0 / no-history divide-by-zero handling. */
async function seedZeroBalance(prisma: PrismaClient, clock: SimClock, now: Date): Promise<void> {
  await baseline(prisma, clock, now);
  await setFxRate(prisma, DEFAULT_FX_RATE, clock.now());
}

/** All coins funded and trading well under threshold; nothing red or amber. */
async function seedHealthy(prisma: PrismaClient, clock: SimClock, now: Date): Promise<void> {
  await baseline(prisma, clock, now);
  await setFxRate(prisma, DEFAULT_FX_RATE, clock.now());
  await setLpState(prisma, {
    name: "LP-Primary",
    usdtHeld: new Decimal(1_000_000),
    usdtAllocated: new Decimal(0),
    coverage: DEFAULT_COINS.map((c) => c.id),
  });

  await depositIdr(prisma, clock, SIM_USER_ID, new Decimal(10_000_000_000));
  for (const coin of DEFAULT_COINS) {
    // 100 units each -> FF = 30 after close
    await executeBuy(prisma, clock.now(), {
      userId: SIM_USER_ID,
      coinId: coin.id,
      idrAmount: new Decimal(100_000_000),
      price: new Decimal(1_000_000),
    });
  }

  await closePeriod(prisma, clock);
  clock.advance(TWELVE_HOURS_MS);
  await closePeriod(prisma, clock); // establishes a trailing window
  await persistClock(prisma, clock);

  // 10% consumption on every coin -> NORMAL band, well under the 25% watch line
  for (const coin of DEFAULT_COINS) {
    await executeSell(prisma, clock.now(), {
      userId: SIM_USER_ID,
      coinId: coin.id,
      coinAmount: new Decimal(3),
      price: new Decimal(1_000_000),
    });
  }
  // buy side at ~5% of its ceiling — uses ETH so it doesn't distort BTC's
  // per-coin net-sell trajectory (BTC is the coin seedOneCoinBreaching
  // pushes over threshold on top of this baseline).
  await executeBuy(prisma, clock.now(), {
    userId: SIM_USER_ID,
    coinId: "ETH",
    idrAmount: new Decimal(100_000_000),
    price: new Decimal(1_000_000),
  });
}

/** One coin driven past 100% while the rest stay green — no aggregate hides it. */
async function seedOneCoinBreaching(prisma: PrismaClient, clock: SimClock, now: Date): Promise<void> {
  await seedHealthy(prisma, clock, now); // reuses the healthy baseline, then breaches BTC on top
  await executeSell(prisma, clock.now(), {
    userId: SIM_USER_ID,
    coinId: "BTC",
    coinAmount: new Decimal(40), // FF[BTC]=30, already sold 3 -> now well past 100%
    price: new Decimal(1_000_000),
  });
}

/** LP liquidity set below the IDR ceiling — verifies the dead zone and binding-source flip. */
async function seedUsdtCeilingBinds(prisma: PrismaClient, clock: SimClock, now: Date): Promise<void> {
  await baseline(prisma, clock, now);
  await setFxRate(prisma, DEFAULT_FX_RATE, clock.now());

  await depositIdr(prisma, clock, SIM_USER_ID, new Decimal(10_000_000_000)); // ceilingIdr = 2,000,000,000
  await closePeriod(prisma, clock);
  clock.advance(TWELVE_HOURS_MS);
  await closePeriod(prisma, clock);
  await persistClock(prisma, clock);

  // 10,000 USDT * 15,800 = 158,000,000 IDR reachable, far below the 2B ceiling
  await setLpState(prisma, {
    name: "LP-Thin",
    usdtHeld: new Decimal(10_000),
    usdtAllocated: new Decimal(0),
    coverage: DEFAULT_COINS.map((c) => c.id),
  });

  await executeBuy(prisma, clock.now(), {
    userId: SIM_USER_ID,
    coinId: "BTC",
    idrAmount: new Decimal(50_000_000),
    price: new Decimal(1_000_000),
  });
}

/** The one LP covering a coin gets drained — verifies singleSource + buyBlocked. */
async function seedSingleSourceStarved(prisma: PrismaClient, clock: SimClock, now: Date): Promise<void> {
  await baseline(prisma, clock, now);
  await setFxRate(prisma, DEFAULT_FX_RATE, clock.now());
  await depositIdr(prisma, clock, SIM_USER_ID, new Decimal(10_000_000_000));
  await closePeriod(prisma, clock);
  clock.advance(TWELVE_HOURS_MS);
  await closePeriod(prisma, clock);
  await persistClock(prisma, clock);

  // one LP, exclusively covering BTC, fully drained -> capacityUsdt = 0
  await setLpState(prisma, {
    name: "LP-Sole-BTC",
    usdtHeld: new Decimal(5_000),
    usdtAllocated: new Decimal(5_000),
    coverage: ["BTC"],
  });
  // a well-funded LP for everything else, so only BTC is starved
  await setLpState(prisma, {
    name: "LP-Rest",
    usdtHeld: new Decimal(500_000),
    usdtAllocated: new Decimal(0),
    coverage: DEFAULT_COINS.filter((c) => c.id !== "BTC").map((c) => c.id),
  });
}

async function persistClock(prisma: PrismaClient, clock: SimClock): Promise<void> {
  await prisma.simClockState.upsert({
    where: { id: 1 },
    create: { id: 1, simulatedNow: clock.now() },
    update: { simulatedNow: clock.now() },
  });
}
