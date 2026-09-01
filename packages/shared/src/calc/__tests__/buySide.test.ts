import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeBuySideState, computeCoinCapacity, computeLpBufferState } from "../buySide.js";

const d = (n: number) => new Decimal(n);

describe("computeBuySideState", () => {
  it("binds on IDR when the IDR ceiling is lower", () => {
    const state = computeBuySideState({
      netBuy: d(50_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(200_000),
      priorPeak: d(0),
    });
    expect(state.bindingSource).toBe("IDR");
    expect(state.unreachable.toString()).toBe("0");
    expect(state.headroomEffective.toString()).toBe("50000");
    expect(state.consumed?.toString()).toBe("0.5");
  });

  it("binds on USDT and exposes unreachable as a dead zone when USDT ceiling is lower", () => {
    const state = computeBuySideState({
      netBuy: d(10_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(60_000),
      priorPeak: d(0),
    });
    expect(state.bindingSource).toBe("USDT");
    expect(state.unreachable.toString()).toBe("40000"); // 100k permitted, only 60k reachable
    expect(state.headroomEffective.toString()).toBe("50000"); // min(90k idr headroom, 50k usdt headroom)
  });

  it("flips binding source mid-period as ceilingUsdt moves", () => {
    const before = computeBuySideState({
      netBuy: d(10_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(150_000), // IDR binds
      priorPeak: d(0),
    });
    expect(before.bindingSource).toBe("IDR");

    const after = computeBuySideState({
      netBuy: d(10_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(40_000), // LP liquidity dried up — USDT now binds
      priorPeak: before.peak,
    });
    expect(after.bindingSource).toBe("USDT");
    expect(after.unreachable.toString()).toBe("60000");
  });

  it("all ratios use ceilingIdr as denominator regardless of which side binds", () => {
    const state = computeBuySideState({
      netBuy: d(30_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(40_000), // USDT binds, lower than ceilingIdr
      priorPeak: d(0),
    });
    // consumed must divide by ceilingIdr (100k), not ceilingUsdt (40k)
    expect(state.consumed?.toString()).toBe("0.3");
  });

  it("treats ceilingIdr == 0 as undefined consumption, not 0%", () => {
    const state = computeBuySideState({
      netBuy: d(0),
      withdrawalVolume: d(0),
      ceilingIdr: d(0),
      ceilingUsdt: d(0),
      priorPeak: d(0),
    });
    expect(state.consumed).toBeNull();
    expect(state.peak.toString()).toBe("0");
  });

  it("peak is monotonic across a binding-source flip", () => {
    const first = computeBuySideState({
      netBuy: d(90_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(200_000),
      priorPeak: d(0),
    });
    expect(first.peak.toString()).toBe("0.9");

    const second = computeBuySideState({
      netBuy: d(20_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(100_000),
      ceilingUsdt: d(15_000),
      priorPeak: first.peak,
    });
    expect(second.peak.toString()).toBe("0.9");
    expect(second.bindingSource).toBe("USDT");
  });

  // The exact worked example: ceilingIdr = withdrawal-vault-at-rebalance =
  // 20,000. Buy 10,000 -> 50%. Then withdraw 5,000 -> 75%, because
  // withdrawal volume adds into the same consumption figure as net buy.
  it("adds withdrawal volume into the same consumption figure as net buy — the worked example", () => {
    const afterBuy = computeBuySideState({
      netBuy: d(10_000),
      withdrawalVolume: d(0),
      ceilingIdr: d(20_000),
      ceilingUsdt: d(1_000_000), // not the constraint here
      priorPeak: d(0),
    });
    expect(afterBuy.consumed?.toString()).toBe("0.5");

    const afterWithdrawal = computeBuySideState({
      netBuy: d(10_000), // unchanged — a withdrawal isn't a buy
      withdrawalVolume: d(5_000),
      ceilingIdr: d(20_000),
      ceilingUsdt: d(1_000_000),
      priorPeak: afterBuy.peak,
    });
    expect(afterWithdrawal.consumed?.toString()).toBe("0.75");
    expect(afterWithdrawal.netBuy.toString()).toBe("10000"); // displayed net buy stays honest, unmixed
    expect(afterWithdrawal.withdrawalVolume.toString()).toBe("5000");
  });

  it("headroomIdr accounts for withdrawal volume, but headroomUsdt does not — withdrawals don't consume LP capacity", () => {
    const state = computeBuySideState({
      netBuy: d(10_000),
      withdrawalVolume: d(5_000),
      ceilingIdr: d(20_000),
      ceilingUsdt: d(1_000_000),
      priorPeak: d(0),
    });
    expect(state.headroomIdr.toString()).toBe("5000"); // 20,000 - (10,000 + 5,000)
    expect(state.headroomUsdt.toString()).toBe("990000"); // 1,000,000 - 10,000, no withdrawal subtracted
  });

  it("a withdrawal alone (no buying) can still push consumption past 100%", () => {
    const state = computeBuySideState({
      netBuy: d(0),
      withdrawalVolume: d(25_000),
      ceilingIdr: d(20_000),
      ceilingUsdt: d(1_000_000),
      priorPeak: d(0),
    });
    expect(state.consumed?.toString()).toBe("1.25");
    expect(state.band).toBe("HALTED");
  });
});

describe("computeCoinCapacity", () => {
  it("sums headroom across covering LPs", () => {
    const state = computeCoinCapacity({
      coinId: "SOL",
      coveringLps: [
        { usdtHeld: d(10_000), usdtAllocated: d(4_000) },
        { usdtHeld: d(5_000), usdtAllocated: d(1_000) },
      ],
    });
    expect(state.capacityUsdt.toString()).toBe("10000");
    expect(state.singleSource).toBe(false);
    expect(state.buyBlocked).toBe(false);
  });

  it("flags singleSource when exactly one LP covers the coin", () => {
    const state = computeCoinCapacity({
      coinId: "SOL",
      coveringLps: [{ usdtHeld: d(10_000), usdtAllocated: d(9_000) }],
    });
    expect(state.singleSource).toBe(true);
  });

  it("flags buyBlocked when covering LPs have no headroom left", () => {
    const state = computeCoinCapacity({
      coinId: "SOL",
      coveringLps: [{ usdtHeld: d(10_000), usdtAllocated: d(10_000) }],
    });
    expect(state.capacityUsdt.toString()).toBe("0");
    expect(state.buyBlocked).toBe(true);
  });

  it("is buy-blocked with zero covering LPs", () => {
    const state = computeCoinCapacity({
      coinId: "SOL",
      coveringLps: [],
    });
    expect(state.capacityUsdt.toString()).toBe("0");
    expect(state.coveringLpCount).toBe(0);
    expect(state.singleSource).toBe(false);
    expect(state.buyBlocked).toBe(true);
  });
});

describe("computeLpBufferState", () => {
  it("computes utilisation as allocated/held", () => {
    const state = computeLpBufferState({
      lpId: "lp-1",
      name: "LP A",
      usdtHeld: d(100_000),
      usdtAllocated: d(80_000),
      coinCount: 12,
    });
    expect(state.utilisation?.toString()).toBe("0.8");
    expect(state.headroom.toString()).toBe("20000");
    expect(state.band).toBe("CRITICAL");
  });

  it("treats usdtHeld == 0 as undefined utilisation, not 0%", () => {
    const state = computeLpBufferState({
      lpId: "lp-1",
      name: "LP A",
      usdtHeld: d(0),
      usdtAllocated: d(0),
      coinCount: 0,
    });
    expect(state.utilisation).toBeNull();
    expect(state.band).toBe("NORMAL");
  });
});
