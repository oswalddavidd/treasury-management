-- CreateTable
CREATE TABLE "coin_alert_state" (
    "coinId" TEXT NOT NULL,
    "lastAlertedBand" TEXT NOT NULL,
    "periodEffectiveFrom" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_alert_state_pkey" PRIMARY KEY ("coinId")
);
