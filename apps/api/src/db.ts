import "dotenv/config";
import { PrismaClient } from "../prisma/generated/client/index.js";

// `seq` (ledger events, FX rate events) and `seqBoundary` (period snapshots)
// are BigInt columns, and JSON.stringify throws on bigint natively. Routes
// return raw Prisma rows containing these in several places (buy/sell/
// deposit/withdraw/period-close/fx) — patching serialization once here,
// rather than at each call site, is the standard fix for this so a future
// route can't silently reintroduce it.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient();
export type { PrismaClient } from "../prisma/generated/client/index.js";
