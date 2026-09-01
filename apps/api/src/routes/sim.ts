import { z } from "zod";
import Decimal from "decimal.js";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../db.js";
import type { SimClock } from "../clock/simClock.js";
import { persistSimClock } from "../clock/simClock.js";
import { periodFor } from "../domain/period.js";
import { bulkGenerate, depositIdr, executeBuy, executeSell, withdrawIdr } from "../sim/actions.js";
import { resetAll, seedScenario, SIM_USER_ID, type ScenarioName } from "../sim/scenarios.js";
import { setFxRate } from "../fx/store.js";
import { setLpState } from "../lp/store.js";
import { closePeriod, PeriodAlreadyClosedError } from "../snapshot/periodClose.js";
import { notifyBufferStateChanged } from "../events.js";
import { setGateBalance } from "../gate/store.js";
import { getIdrVaultState, setWithdrawalVault } from "../idrVault/store.js";
import { DEFAULT_COINS } from "../sim/coins.js";

const decimalString = z.string().refine((v) => !new Decimal(v).isNaN(), "must be a decimal number");

const depositWithdrawSchema = z.object({ userId: z.string().min(1), amount: decimalString });

const buySchema = z.object({
  userId: z.string().min(1),
  coinId: z.string().min(1),
  idrAmount: decimalString,
  price: decimalString,
  lpId: z.string().optional(),
});

const sellSchema = z.object({
  userId: z.string().min(1),
  coinId: z.string().min(1),
  coinAmount: decimalString,
  price: decimalString,
});

const bulkSchema = z.object({
  count: z.number().int().min(1).max(5000),
  hours: z.number().positive().max(24 * 30),
  buyBias: z.number().min(0).max(1).default(0.5),
  userId: z.string().min(1).default(SIM_USER_ID),
  coinIds: z.array(z.string().min(1)).optional(),
  idrAmountMin: z.number().positive().default(100_000),
  idrAmountMax: z.number().positive().default(5_000_000),
  priceByCoin: z.record(z.string(), decimalString).optional(),
});

const timeAdvanceSchema = z.object({ ms: z.number().positive() });
const timeSetSchema = z.object({ timestamp: z.string().datetime() });
const fxSchema = z.object({ rateIdrPerUsd: decimalString });
const lpSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  usdtHeld: decimalString,
  usdtAllocated: decimalString,
  coverage: z.array(z.string().min(1)),
});
const gateAssetSchema = z.object({ coinId: z.string().min(1), amount: decimalString });
const withdrawalVaultSchema = z.object({ amount: decimalString });
const scenarioParamsSchema = z.object({
  name: z.enum([
    "zero-balance",
    "healthy",
    "one-coin-breaching",
    "usdt-ceiling-binds",
    "single-source-starved",
  ]),
});

/**
 * All /sim routes. Registered only when SIM_ENABLED is true (app.ts), so
 * they 404 in any environment where that flag isn't set — this is the only
 * gate; there is deliberately no link to /sim anywhere in the app.
 */
export function registerSimRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; clock: SimClock },
): void {
  const { prisma, clock } = deps;

  const afterMutation = async () => {
    await persistSimClock(prisma, clock);
  };

  app.get("/api/sim/state", async () => {
    const now = clock.now();
    const period = periodFor(now);
    const recentEvents = await prisma.ledgerEvent.findMany({
      orderBy: { seq: "desc" },
      take: 25,
    });
    // Read from the DB, not the static DEFAULT_COINS constant — this is
    // what makes gateBalance visible/current in the sim UI.
    const coins = await prisma.coin.findMany({ where: { isActive: true } });
    const idrVaults = await getIdrVaultState(prisma);
    return { now, period, recentEvents, coins, idrVaults };
  });

  app.post("/api/sim/deposit-idr", async (request) => {
    const body = depositWithdrawSchema.parse(request.body);
    return depositIdr(prisma, clock, body.userId, new Decimal(body.amount));
  });

  app.post("/api/sim/withdraw-idr", async (request) => {
    const body = depositWithdrawSchema.parse(request.body);
    return withdrawIdr(prisma, clock, body.userId, new Decimal(body.amount));
  });

  app.post("/api/sim/buy", async (request) => {
    const body = buySchema.parse(request.body);
    return executeBuy(prisma, clock.now(), {
      userId: body.userId,
      coinId: body.coinId,
      idrAmount: new Decimal(body.idrAmount),
      price: new Decimal(body.price),
      lpId: body.lpId,
    });
  });

  app.post("/api/sim/sell", async (request) => {
    const body = sellSchema.parse(request.body);
    return executeSell(prisma, clock.now(), {
      userId: body.userId,
      coinId: body.coinId,
      coinAmount: new Decimal(body.coinAmount),
      price: new Decimal(body.price),
    });
  });

  app.post("/api/sim/bulk", async (request) => {
    const body = bulkSchema.parse(request.body);
    const coinIds = body.coinIds ?? DEFAULT_COINS.map((c) => c.id);
    const priceByCoin: Record<string, Decimal> = {};
    for (const coinId of coinIds) {
      const override = body.priceByCoin?.[coinId];
      priceByCoin[coinId] = override ? new Decimal(override) : new Decimal(1_000_000);
    }
    return bulkGenerate(prisma, clock, {
      count: body.count,
      hours: body.hours,
      buyBias: body.buyBias,
      userId: body.userId,
      coinIds,
      priceByCoin,
      idrAmountRange: [body.idrAmountMin, body.idrAmountMax],
    });
  });

  app.post("/api/sim/time/advance", async (request) => {
    const body = timeAdvanceSchema.parse(request.body);
    clock.advance(body.ms);
    await afterMutation();
    notifyBufferStateChanged();
    return { now: clock.now() };
  });

  app.post("/api/sim/time/set", async (request) => {
    const body = timeSetSchema.parse(request.body);
    clock.setTime(new Date(body.timestamp));
    await afterMutation();
    notifyBufferStateChanged();
    return { now: clock.now() };
  });

  app.post("/api/sim/period/close", async (_request, reply) => {
    try {
      const snapshot = await closePeriod(prisma, clock);
      // The new snapshot governs the *next* period (§1.3) — without also
      // advancing "now" into it, /api/buffers would keep reporting no
      // active snapshot (still inside the period that was just closed).
      // "Close period now" is meant to skip the wait entirely, so it jumps
      // the clock to the boundary it just created.
      clock.setTime(snapshot.effectiveFrom);
      await afterMutation();
      notifyBufferStateChanged();
      return snapshot;
    } catch (err) {
      if (err instanceof PeriodAlreadyClosedError) {
        return reply.conflict(err.message);
      }
      throw err;
    }
  });

  app.post("/api/sim/fx", async (request) => {
    const body = fxSchema.parse(request.body);
    return setFxRate(prisma, new Decimal(body.rateIdrPerUsd), clock.now());
  });

  app.post("/api/sim/lp", async (request) => {
    const body = lpSchema.parse(request.body);
    return setLpState(prisma, {
      id: body.id,
      name: body.name,
      usdtHeld: new Decimal(body.usdtHeld),
      usdtAllocated: new Decimal(body.usdtAllocated),
      coverage: body.coverage,
    });
  });

  // Actual observed balance at the LP/custody gate — a manual override for
  // testing reconciliation, not derived from any trade. In production this
  // would come from a real custody/wallet feed instead of a form.
  app.post("/api/sim/gate-assets", async (request) => {
    const body = gateAssetSchema.parse(request.body);
    return setGateBalance(prisma, body.coinId, new Decimal(body.amount));
  });

  // Manual override for the IDR-side counterpart of gate assets — same
  // testing purpose: deliberately create (or clear) a mismatch against the
  // computed FF_idr, independent of the real deposit/withdraw/rebalance
  // mechanics.
  app.post("/api/sim/withdrawal-vault", async (request) => {
    const body = withdrawalVaultSchema.parse(request.body);
    await setWithdrawalVault(prisma, new Decimal(body.amount));
    return { withdrawalVault: body.amount };
  });

  app.post<{ Params: { name: string } }>("/api/sim/scenario/:name", async (request) => {
    const params = scenarioParamsSchema.parse(request.params);
    await seedScenario(prisma, clock, params.name as ScenarioName, clock.now());
    await afterMutation();
    return { scenario: params.name, now: clock.now() };
  });

  app.post("/api/sim/reset", async () => {
    await resetAll(prisma, clock, new Date());
    await afterMutation();
    return { now: clock.now() };
  });
}
