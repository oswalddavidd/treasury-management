import { describe, expect, it } from "vitest";
import { nextPeriod, periodFor } from "../period.js";

// Asia/Jakarta is UTC+7 year-round (no DST), so 00:00 local == 17:00 UTC the
// previous day, and 12:00 local == 05:00 UTC same day.

describe("periodFor", () => {
  it("places 00:00:01 Jakarta (Period A start) in the period starting at that instant", () => {
    const instant = new Date("2026-08-26T17:00:01.000Z"); // 2026-08-27T00:00:01 +07:00
    const period = periodFor(instant);
    expect(period.start.toISOString()).toBe("2026-08-26T17:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-27T05:00:00.000Z"); // 12:00 Jakarta
  });

  it("places 11:59:59 Jakarta in Period A, not the next period", () => {
    const instant = new Date("2026-08-27T04:59:59.000Z"); // 11:59:59 +07:00
    const period = periodFor(instant);
    expect(period.start.toISOString()).toBe("2026-08-26T17:00:00.000Z");
  });

  it("places exactly 12:00:00 Jakarta in Period B, the boundary instant belongs to the new period", () => {
    const instant = new Date("2026-08-27T05:00:00.000Z"); // 12:00:00 +07:00 exactly
    const period = periodFor(instant);
    expect(period.start.toISOString()).toBe("2026-08-27T05:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-27T17:00:00.000Z");
  });

  it("places 23:59:59 Jakarta in Period B", () => {
    const instant = new Date("2026-08-27T16:59:59.000Z");
    const period = periodFor(instant);
    expect(period.start.toISOString()).toBe("2026-08-27T05:00:00.000Z");
  });

  it("rolls over midnight Jakarta correctly", () => {
    const instant = new Date("2026-08-27T16:59:59.999Z"); // 23:59:59.999 +07:00
    const period = periodFor(instant);
    expect(period.end.toISOString()).toBe("2026-08-27T17:00:00.000Z"); // next day 00:00 Jakarta
  });
});

describe("nextPeriod", () => {
  it("chains directly off the previous period's end with no gap", () => {
    const first = periodFor(new Date("2026-08-26T17:00:00.000Z"));
    const second = nextPeriod(first);
    expect(second.start.getTime()).toBe(first.end.getTime());
    expect(second.end.getTime() - second.start.getTime()).toBe(12 * 60 * 60 * 1000);
  });
});
