import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeSellSideRollup } from "../rollup.js";
import type { CoinBufferState } from "../../types/bufferState.js";

const d = (n: number) => new Decimal(n);

function state(coinId: string, peak: number, band: CoinBufferState["band"]): CoinBufferState {
  return {
    coinId,
    freeFloat: d(100),
    netSell: d(0),
    netSellClamped: d(0),
    consumed: d(peak),
    peak: d(peak),
    headroom: d(0),
    band,
  };
}

describe("computeSellSideRollup", () => {
  it("never averages — picks the single worst coin by peak", () => {
    const rollup = computeSellSideRollup([
      state("BTC", 0.1, "NORMAL"),
      state("ETH", 0.95, "CRITICAL"),
      state("SOL", 0.3, "WATCH"),
    ]);
    expect(rollup.worstCoin).toBe("ETH");
  });

  it("tallies band counts independently per coin", () => {
    const rollup = computeSellSideRollup([
      state("A", 1.1, "HALTED"),
      state("B", 1.2, "HALTED"),
      state("C", 0.1, "NORMAL"),
    ]);
    expect(rollup.bandCounts.HALTED).toBe(2);
    expect(rollup.bandCounts.NORMAL).toBe(1);
    expect(rollup.blockedCount).toBe(2);
  });

  it("one broken coin among many healthy ones is not hidden", () => {
    const healthy = Array.from({ length: 51 }, (_, i) => state(`coin-${i}`, 0.05, "NORMAL"));
    const rollup = computeSellSideRollup([...healthy, state("BROKEN", 1.4, "HALTED")]);
    expect(rollup.worstCoin).toBe("BROKEN");
    expect(rollup.blockedCount).toBe(1);
  });

  it("returns null worstCoin and zeroed counts for an empty portfolio", () => {
    const rollup = computeSellSideRollup([]);
    expect(rollup.worstCoin).toBeNull();
    expect(rollup.bandCounts.NORMAL).toBe(0);
    expect(rollup.blockedCount).toBe(0);
  });
});
