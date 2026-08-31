import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeCoinBufferState } from "../sellSide.js";

describe("decimal precision", () => {
  it("accumulates 10,000 sequential 0.1-unit trades with zero drift", () => {
    // A classic float trap: 0.1 added 10,000 times in IEEE754 lands on
    // 999.9999999999...something, not exactly 1000. Decimal must not.
    let netSell = new Decimal(0);
    for (let i = 0; i < 10_000; i++) {
      netSell = netSell.plus("0.1");
    }
    expect(netSell.toString()).toBe("1000");
  });

  it("holds exact peak across 10,000 fluctuating ticks, matching a parallel exact computation", () => {
    const freeFloat = new Decimal(10_000);
    let netSell = new Decimal(0);
    let peak = new Decimal(0);
    let expectedPeak = new Decimal(0);

    for (let i = 0; i < 10_000; i++) {
      // alternate net sell up by 0.3, down by 0.1 — irregular decimal deltas
      const delta = i % 2 === 0 ? "0.3" : "-0.1";
      netSell = netSell.plus(delta);

      const state = computeCoinBufferState({
        coinId: "BTC",
        freeFloat,
        netSell,
        priorPeak: peak,
      });
      peak = state.peak;

      const consumed = netSell.div(freeFloat);
      if (consumed.gt(expectedPeak)) expectedPeak = consumed;
    }

    expect(peak.toString()).toBe(expectedPeak.toString());
    // sanity: net of 10,000 alternating +0.3/-0.1 ticks (5000 each) = 1000
    expect(netSell.toString()).toBe("1000");
  });
});
