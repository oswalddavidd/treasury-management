import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeLaunchMode } from "../launchMode.js";

const d = (n: number) => new Decimal(n);

describe("computeLaunchMode", () => {
  it("is launch mode with no trailing period history at all (true launch)", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(0), ETH: d(0) },
      trailingAvgNetSellUsd: null,
      totalListedCoins: 2,
    });
    expect(result.launchMode).toBe(true);
    expect(result.reserveCoverage).toBeNull();
  });

  it("is launch mode when reserve coverage is below 1.0x", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(500) },
      trailingAvgNetSellUsd: d(1000), // coverage = 0.5x
      totalListedCoins: 1,
    });
    expect(result.reserveCoverage?.toString()).toBe("0.5");
    expect(result.launchMode).toBe(true);
  });

  it("is launch mode when more than half of listed coins have zero free float, even with healthy coverage elsewhere", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(0), ETH: d(0), SOL: d(10_000) },
      trailingAvgNetSellUsd: d(1), // coverage would be huge and healthy on its own
      totalListedCoins: 3,
    });
    expect(result.launchMode).toBe(true);
  });

  it("exits launch mode once coverage clears 1.0x and most coins have free float", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(5000), ETH: d(5000) },
      trailingAvgNetSellUsd: d(1000), // coverage = 10x
      totalListedCoins: 2,
    });
    expect(result.reserveCoverage?.toString()).toBe("10");
    expect(result.launchMode).toBe(false);
  });

  it("treats a real zero average (history exists, nobody sold) as infinite coverage, not launch mode", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(5000) },
      trailingAvgNetSellUsd: d(0),
      totalListedCoins: 1,
    });
    expect(result.reserveCoverage?.toString()).toBe("Infinity");
    expect(result.launchMode).toBe(false);
  });

  it("treats a negative average (net buying in the trailing window) as infinite coverage, not a negative ratio below 1.0x", () => {
    const result = computeLaunchMode({
      freeFloatUsd: { BTC: d(5000) },
      trailingAvgNetSellUsd: d(-1000), // trailing window was net buying, not net selling
      totalListedCoins: 1,
    });
    expect(result.reserveCoverage?.toString()).toBe("Infinity");
    expect(result.launchMode).toBe(false);
  });
});
