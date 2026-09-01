-- CreateTable
CREATE TABLE "idr_vault_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "depositVault" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "withdrawalVault" DECIMAL(30,8) NOT NULL DEFAULT 0,

    CONSTRAINT "idr_vault_state_pkey" PRIMARY KEY ("id")
);
