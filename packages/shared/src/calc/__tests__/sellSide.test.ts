import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeCoinBufferState, statusBandFromPeak } from "../sellSide.js";

const d = (n: number) => new Decimal(n);

describe("computeCoinBufferState", () => {
  it("computes consumed as netSell/freeFloat", () => {
    const state = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(100),
      netSell: d(40),
      priorPeak: d(0),
    });
    expect(state.consumed?.toString()).toBe("0.4");
    expect(state.peak.toString()).toBe("0.4");
    expect(state.band).toBe("WATCH");
  });

  it("handles FF == 0 (launch mode) as undefined consumption, not 0%", () => {
    const state = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(0),
      netSell: d(0),
      priorPeak: d(0),
    });
    expect(state.consumed).toBeNull();
    expect(state.peak.toString()).toBe("0"); // carried forward, untouched
  });

  it("carries priorPeak forward unchanged when FF == 0 even with nonzero netSell", () => {
    const state = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(0),
      netSell: d(500),
      priorPeak: d(0.6),
    });
    expect(state.consumed).toBeNull();
    expect(state.peak.toString()).toBe("0.6");
  });

  it("allows negative net sell (users are net buyers) without going negative on peak", () => {
    const state = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(100),
      netSell: d(-40),
      priorPeak: d(0),
    });
    expect(state.consumed?.toString()).toBe("-0.4");
    expect(state.netSellClamped.toString()).toBe("0"); // clamped for display only
    expect(state.peak.toString()).toBe("0"); // max(priorPeak=0, consumed=-0.4) = 0
    expect(state.band).toBe("NORMAL");
  });

  it("allows consumption above 100% and bands it HALTED", () => {
    const state = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(100),
      netSell: d(150),
      priorPeak: d(0),
    });
    expect(state.consumed?.toString()).toBe("1.5");
    expect(state.headroom.toString()).toBe("-50");
    expect(state.band).toBe("HALTED");
  });

  it("peak is monotonic — never decreases even when consumption drops", () => {
    const first = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(100),
      netSell: d(90),
      priorPeak: d(0),
    });
    expect(first.peak.toString()).toBe("0.9");

    // consumption falls back (e.g. users started buying), but peak must hold
    const second = computeCoinBufferState({
      coinId: "BTC",
      freeFloat: d(100),
      netSell: d(20),
      priorPeak: first.peak,
    });
    expect(second.consumed?.toString()).toBe("0.2");
    expect(second.peak.toString()).toBe("0.9");
    expect(second.band).toBe("CRITICAL"); // banded on peak, not current consumption
  });
});

describe("statusBandFromPeak", () => {
  it.each([
    [d(1.5), "HALTED"],
    [d(1.0), "HALTED"],
    [d(0.99), "CRITICAL"],
    [d(0.8), "CRITICAL"],
    [d(0.79), "ALERT"],
    [d(0.5), "ALERT"],
    [d(0.49), "WATCH"],
    [d(0.25), "WATCH"],
    [d(0.24), "NORMAL"],
    [d(0), "NORMAL"],
  ])("bands peak %s as %s", (peak, expected) => {
    expect(statusBandFromPeak(peak)).toBe(expected);
  });
});
