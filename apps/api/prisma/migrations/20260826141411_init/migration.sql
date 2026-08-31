-- CreateEnum
CREATE TYPE "LedgerEventType" AS ENUM ('DEPOSIT_IDR', 'WITHDRAW_IDR', 'DEPOSIT_COIN', 'WITHDRAW_COIN', 'BUY', 'SELL');

-- CreateTable
CREATE TABLE "coins" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_events" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "type" "LedgerEventType" NOT NULL,
    "userId" TEXT NOT NULL,
    "coinId" TEXT,
    "idrAmount" DECIMAL(30,8),
    "coinAmount" DECIMAL(38,18),
    "priceIdrPerCoin" DECIMAL(30,8),
    "lpId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_snapshots" (
    "id" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "seqBoundary" BIGINT NOT NULL,
    "bbIdr" DECIMAL(30,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_coin_balances" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "bbAmount" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "snapshot_coin_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "usdtHeld" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "usdtAllocated" DECIMAL(30,8) NOT NULL DEFAULT 0,

    CONSTRAINT "lp_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_coin_coverage" (
    "id" TEXT NOT NULL,
    "lpId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,

    CONSTRAINT "lp_coin_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rate_events" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "rateIdrPerUsd" DECIMAL(20,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rate_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_clock_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "simulatedNow" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_clock_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_events_seq_key" ON "ledger_events"("seq");

-- CreateIndex
CREATE INDEX "ledger_events_coinId_seq_idx" ON "ledger_events"("coinId", "seq");

-- CreateIndex
CREATE INDEX "ledger_events_type_seq_idx" ON "ledger_events"("type", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "period_snapshots_effectiveFrom_key" ON "period_snapshots"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_coin_balances_snapshotId_coinId_key" ON "snapshot_coin_balances"("snapshotId", "coinId");

-- CreateIndex
CREATE UNIQUE INDEX "lp_providers_name_key" ON "lp_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lp_coin_coverage_lpId_coinId_key" ON "lp_coin_coverage"("lpId", "coinId");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rate_events_seq_key" ON "fx_rate_events"("seq");

-- AddForeignKey
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "coins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_lpId_fkey" FOREIGN KEY ("lpId") REFERENCES "lp_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_coin_balances" ADD CONSTRAINT "snapshot_coin_balances_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "period_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_coin_balances" ADD CONSTRAINT "snapshot_coin_balances_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "coins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_coin_coverage" ADD CONSTRAINT "lp_coin_coverage_lpId_fkey" FOREIGN KEY ("lpId") REFERENCES "lp_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_coin_coverage" ADD CONSTRAINT "lp_coin_coverage_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "coins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
