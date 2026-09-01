import Decimal from "decimal.js";
import {
  computeBuySideState,
  computeCoinBufferState,
  computeCoinCapacity,
  computeCoinFreeFloat,
  computeIdrFreeFloat,
  computeLaunchMode,
  computeLpBufferState,
  computeSellSideRollup,
  type BuySideState,
  type CoinBufferState,
  type CoinCapacityState,
  type LpBufferState,
  type SellSideRollup,
} from "@coinbit/shared";
import type { PrismaClient } from "../db.js";
import type { Clock } from "../clock/types.js";
import {
  getCoinNetSellTrajectory,
  getIdrBuySideTrajectory,
  getIdrNetBuyForWindow,
  getLastTradePrice,
} from "../ledger/store.js";
import { getLatestFxRate } from "../fx/store.js";
import { listLps } from "../lp/store.js";
import { getIdrVaultState } from "../idrVault/store.js";
import { getActiveSnapshot, getRecentClosedPeriodWindows } from "../snapshot/periodClose.js";

/**
 * CoinBufferState plus the gate-asset reconciliation check. freeFloat is
 * purely ledger-computed ("what the books say should be available");
 * gateBalance is an independently, manually-set figure representing what's
 * actually observed at the LP/custody gate. This lives at the API layer,
 * not in packages/shared/calc — it's not part of any tested formula, just
 * a reconciliation display value laid alongside the real math.
 */
export interface CoinBufferStateWithGate extends CoinBufferState {
  gateBalance: Decimal;
  gateMismatch: boolean;
}

export interface BufferSnapshotResult {
  now: Date;
  launchMode: true;
  period: null;
  coinStates: [];
  rollup: SellSideRollup;
  buySide: null;
  coinCapacities: [];
  lpStates: LpBufferState[];
  reserveCoverage: null;
  reason: "no-snapshot-yet";
  depositVault: Decimal;
  withdrawalVault: Decimal;
  withdrawalVaultMismatch: null;
}

export interface BufferComputedResult {
  now: Date;
  launchMode: boolean;
  period: { start: Date; end: Date };
  coinStates: CoinBufferStateWithGate[];
  rollup: SellSideRollup;
  buySide: BuySideState;
  coinCapacities: CoinCapacityState[];
  lpStates: LpBufferState[];
  reserveCoverage: Decimal | null;
  fxRate: Decimal | null;
  // Deposit Vault: real-time, this period's raw deposits, purely
  // observational. Withdrawal Vault: the IDR counterpart of Gate Assets —
  // reset to FF_idr at every rebalancing, drawn down in real time only by
  // withdrawals. Mismatch flags when it's drifted from Ceiling_idr (=
  // FF_idr), same reconciliation idea as gateMismatch.
  depositVault: Decimal;
  withdrawalVault: Decimal;
  withdrawalVaultMismatch: boolean;
}

/**
 * Orchestration only: pulls DB state, hands it to the pure calc functions,
 * returns the combined result. No formulas live here.
 */
export async function computeCurrentBufferState(
  prisma: PrismaClient,
  clock: Clock,
): Promise<BufferSnapshotResult | BufferComputedResult> {
  const now = clock.now();
  const activeSnapshot = await getActiveSnapshot(prisma, now);
  const lps = await listLps(prisma);
  const idrVaults = await getIdrVaultState(prisma);
  const lpStates = lps.map((lp) =>
    computeLpBufferState({
      lpId: lp.id,
      name: lp.name,
      usdtHeld: lp.usdtHeld,
      usdtAllocated: lp.usdtAllocated,
      coinCount: lp.coverage.length,
    }),
  );

  if (!activeSnapshot) {
    // True cold start — no period has ever closed. Nothing to compute
    // percentages against; §1.7 launch mode, no absolute figures either
    // since there is no snapshot-bounded window to measure from yet.
    return {
      now,
      launchMode: true,
      period: null,
      coinStates: [],
      rollup: computeSellSideRollup([]),
      buySide: null,
      coinCapacities: [],
      lpStates,
      reserveCoverage: null,
      reason: "no-snapshot-yet",
      depositVault: idrVaults.depositVault,
      withdrawalVault: idrVaults.withdrawalVault,
      withdrawalVaultMismatch: null,
    };
  }

  const coins = await prisma.coin.findMany({ where: { isActive: true } });
  const fxRate = await getLatestFxRate(prisma);

  const coinStates: CoinBufferStateWithGate[] = [];
  const coinCapacities: CoinCapacityState[] = [];
  const freeFloatIdr: Record<string, Decimal> = {};

  for (const coin of coins) {
    const bbRow = activeSnapshot.coinBalances.find((b) => b.coinId === coin.id);
    const bb = bbRow ? new Decimal(bbRow.bbAmount.toString()) : new Decimal(0);
    const freeFloat = computeCoinFreeFloat(bb);

    const trajectory = await getCoinNetSellTrajectory(prisma, coin.id, activeSnapshot.seqBoundary);
    const priorPeak = freeFloat.isZero() ? new Decimal(0) : trajectory.peak.div(freeFloat);

    const gateBalance = new Decimal(coin.gateBalance.toString());

    coinStates.push({
      ...computeCoinBufferState({
        coinId: coin.id,
        freeFloat,
        netSell: trajectory.current,
        priorPeak,
      }),
      gateBalance,
      gateMismatch: !gateBalance.equals(freeFloat),
    });

    const coveringLps = lps
      .filter((lp) => lp.coverage.includes(coin.id))
      .map((lp) => ({ usdtHeld: lp.usdtHeld, usdtAllocated: lp.usdtAllocated }));
    coinCapacities.push(computeCoinCapacity({ coinId: coin.id, coveringLps }));

    // Launch-mode USD/reference-currency conversion has no defined price
    // feed in the spec (see flagged assumption) — proxied here by the most
    // recent trade price for the coin, in IDR terms (see computeLaunchMode
    // call below for why IDR instead of USD).
    const lastPrice = await getLastTradePrice(prisma, coin.id);
    freeFloatIdr[coin.id] = lastPrice ? freeFloat.times(lastPrice) : new Decimal(0);
  }

  const rollup = computeSellSideRollup(coinStates);

  const bbIdr = new Decimal(activeSnapshot.bbIdr.toString());
  const ceilingIdr = computeIdrFreeFloat(bbIdr);
  // Combined trajectory: withdrawals draw on the same frozen IDR permission
  // as buying (§ buy-side formula, per the worked example), so peak has to
  // be tracked on the combined figure, not netBuy alone — see
  // getIdrBuySideTrajectory for why this can't just be two separate peaks
  // added together.
  const buyTrajectory = await getIdrBuySideTrajectory(prisma, activeSnapshot.seqBoundary);
  const usdtAvail = lps.reduce(
    (sum, lp) => sum.plus(lp.usdtHeld.minus(lp.usdtAllocated)),
    new Decimal(0),
  );
  const ceilingUsdt = fxRate ? usdtAvail.times(fxRate) : new Decimal(0);
  const buyPriorPeak = ceilingIdr.isZero() ? new Decimal(0) : buyTrajectory.peak.div(ceilingIdr);

  const buySide = computeBuySideState({
    netBuy: buyTrajectory.netBuy,
    withdrawalVolume: buyTrajectory.withdrawalVolume,
    ceilingIdr,
    ceilingUsdt,
    priorPeak: buyPriorPeak,
  });

  // §1.7 — reserve coverage. The ratio is currency-invariant, so this is
  // computed in IDR terms throughout rather than USD: there is no per-coin
  // USD price feed in the spec, and the trailing net-sell average can be
  // read directly off ledger idrAmount (sell IDR − buy IDR per closed
  // period) with no price conversion needed at all. See flagged assumption
  // on the per-coin FF-to-IDR conversion above, which does still rely on
  // last-trade-price as a proxy for "current price".
  const windows = await getRecentClosedPeriodWindows(prisma);
  let trailingAvgNetSellIdr: Decimal | null = null;
  if (windows.length > 0) {
    let total = new Decimal(0);
    for (const window of windows) {
      const netBuy = await getIdrNetBuyForWindow(prisma, window.sinceSeq, window.uptoSeq);
      total = total.plus(netBuy.negated()); // net sell = -net buy
    }
    trailingAvgNetSellIdr = total.div(windows.length);
  }

  const launch = computeLaunchMode({
    freeFloatUsd: freeFloatIdr,
    trailingAvgNetSellUsd: trailingAvgNetSellIdr,
    totalListedCoins: coins.length,
  });

  return {
    now,
    launchMode: launch.launchMode,
    period: { start: activeSnapshot.effectiveFrom, end: activeSnapshot.effectiveTo },
    coinStates,
    rollup,
    buySide,
    coinCapacities,
    lpStates,
    reserveCoverage: launch.reserveCoverage,
    fxRate,
    depositVault: idrVaults.depositVault,
    withdrawalVault: idrVaults.withdrawalVault,
    withdrawalVaultMismatch: !idrVaults.withdrawalVault.equals(ceilingIdr),
  };
}
