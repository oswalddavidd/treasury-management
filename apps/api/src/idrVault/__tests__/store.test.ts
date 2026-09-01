import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "../../db.js";
import {
  decrementWithdrawalVault,
  getIdrVaultState,
  incrementDepositVault,
  rebalanceIdrVaults,
  setWithdrawalVault,
} from "../store.js";

async function resetDb() {
  await prisma.idrVaultState.deleteMany();
}

beforeEach(resetDb);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("idrVault/store", () => {
  it("starts at zero for both vaults", async () => {
    const state = await getIdrVaultState(prisma);
    expect(state.depositVault.toString()).toBe("0");
    expect(state.withdrawalVault.toString()).toBe("0");
  });

  it("increments the deposit vault by the full deposit amount, real time", async () => {
    await incrementDepositVault(prisma, new Decimal(100_000));
    await incrementDepositVault(prisma, new Decimal(50_000));
    const state = await getIdrVaultState(prisma);
    expect(state.depositVault.toString()).toBe("150000");
    expect(state.withdrawalVault.toString()).toBe("0"); // untouched by deposits
  });

  it("decrements the withdrawal vault by the full withdrawal amount, real time", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(20_000)); // seed a starting balance
    await decrementWithdrawalVault(prisma, new Decimal(5_000));
    const state = await getIdrVaultState(prisma);
    expect(state.withdrawalVault.toString()).toBe("15000");
    expect(state.depositVault.toString()).toBe("0"); // untouched by withdrawals
  });

  it("allows the withdrawal vault to go negative on an oversized withdrawal — a real deficit, not clamped", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(10_000));
    await decrementWithdrawalVault(prisma, new Decimal(30_000));
    const state = await getIdrVaultState(prisma);
    expect(state.withdrawalVault.toString()).toBe("-20000");
  });

  it("rebalances: withdrawal vault hard-resets to the new FF_idr, deposit vault resets to 0", async () => {
    await incrementDepositVault(prisma, new Decimal(100_000));
    await decrementWithdrawalVault(prisma, new Decimal(3_000));

    await rebalanceIdrVaults(prisma, new Decimal(18_000));

    const state = await getIdrVaultState(prisma);
    expect(state.withdrawalVault.toString()).toBe("18000");
    expect(state.depositVault.toString()).toBe("0");
  });

  it("manual override sets the withdrawal vault directly, independent of the real mechanics", async () => {
    await rebalanceIdrVaults(prisma, new Decimal(10_000));
    await setWithdrawalVault(prisma, new Decimal(999));
    const state = await getIdrVaultState(prisma);
    expect(state.withdrawalVault.toString()).toBe("999");
  });
});
