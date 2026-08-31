import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  computeAllCoinFreeFloats,
  computeCoinFreeFloat,
  computeIdrFreeFloat,
} from "../freeFloat.js";

describe("computeCoinFreeFloat", () => {
  it("takes 30% of BB, leaving 70% to ICC", () => {
    expect(computeCoinFreeFloat(new Decimal(100)).toString()).toBe("30");
  });

  it("returns 0 when BB is 0", () => {
    expect(computeCoinFreeFloat(new Decimal(0)).toString()).toBe("0");
  });
});

describe("computeIdrFreeFloat", () => {
  it("takes 20% of BB_idr, leaving 80% to KKI", () => {
    expect(computeIdrFreeFloat(new Decimal(1_000_000)).toString()).toBe("200000");
  });
});

describe("computeAllCoinFreeFloats", () => {
  it("maps every coin independently", () => {
    const result = computeAllCoinFreeFloats({
      BTC: new Decimal(100),
      ETH: new Decimal(50),
    });
    expect(result.BTC.toString()).toBe("30");
    expect(result.ETH.toString()).toBe("15");
  });
});
