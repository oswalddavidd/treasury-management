import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "../../db.js";
import { checkCoinAlerts } from "../monitor.js";

vi.mock("../telegram.js", () => ({
  sendTelegramMessage: vi.fn(async () => true),
}));
import { sendTelegramMessage } from "../telegram.js";
const sendMock = vi.mocked(sendTelegramMessage);

async function resetDb() {
  await prisma.coinAlertState.deleteMany();
  await prisma.coin.deleteMany();
}

beforeEach(async () => {
  await resetDb();
  await prisma.coin.create({ data: { id: "BTC", displayName: "Bitcoin", decimals: 8 } });
  sendMock.mockClear();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const periodA = new Date("2026-08-27T05:00:00.000Z");
const periodB = new Date("2026-08-27T17:00:00.000Z");

describe("checkCoinAlerts", () => {
  it("never alerts a NORMAL band", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "NORMAL", consumed: new Decimal(0.1) }], periodA);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("alerts on first crossing into WATCH", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toContain("BTC");
    expect(sendMock.mock.calls[0][0]).toContain("WATCH");
  });

  it("does not re-alert the same band within the same period (the flapping case: 30% -> 29% -> 30%)", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.29) }], periodA);
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("alerts again on escalation to a worse band within the same period", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "ALERT", consumed: new Decimal(0.55) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0]).toContain("ALERT");
  });

  it("does not re-alert a de-escalation (band is peak-derived and monotonic, but guard anyway)", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "CRITICAL", consumed: new Decimal(0.85) }], periodA);
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(1); // only the CRITICAL alert
  });

  it("resets the dedupe when a new period starts, even at the same band", async () => {
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodB);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("does not record dedup state for a delivery that failed — a failed send must not permanently block future real alerts", async () => {
    sendMock.mockResolvedValueOnce(false); // simulates missing credentials / a failed Telegram call
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "HALTED", consumed: new Decimal(1.4) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const state = await prisma.coinAlertState.findUnique({ where: { coinId: "BTC" } });
    expect(state).toBeNull(); // nothing recorded — the failed send left no trace

    // a later, lower-severity band must still be able to alert for real
    await checkCoinAlerts(prisma, [{ coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) }], periodA);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("tracks multiple coins independently", async () => {
    await prisma.coin.create({ data: { id: "ETH", displayName: "Ethereum", decimals: 18 } });
    await checkCoinAlerts(
      prisma,
      [
        { coinId: "BTC", band: "WATCH", consumed: new Decimal(0.3) },
        { coinId: "ETH", band: "NORMAL", consumed: new Decimal(0.1) },
      ],
      periodA,
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toContain("BTC");
  });
});
