import Decimal from "decimal.js";
import type { PrismaClient } from "../../prisma/generated/client/index.js";
import { notifyBufferStateChanged } from "../events.js";

/** Latest FX rate (IDR per USD), or null if none has ever been set. */
export async function getLatestFxRate(prisma: PrismaClient): Promise<Decimal | null> {
  const event = await prisma.fxRateEvent.findFirst({ orderBy: { seq: "desc" } });
  return event ? new Decimal(event.rateIdrPerUsd.toString()) : null;
}

/** Append-only, same ordering discipline as the ledger. */
export async function setFxRate(
  prisma: PrismaClient,
  rateIdrPerUsd: Decimal,
  occurredAt: Date,
) {
  const event = await prisma.fxRateEvent.create({
    data: { rateIdrPerUsd: rateIdrPerUsd.toString(), occurredAt },
  });
  notifyBufferStateChanged();
  return event;
}
