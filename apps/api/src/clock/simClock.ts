import type { PrismaClient } from "../db.js";
import type { Clock } from "./types.js";

/**
 * In-memory simulated clock, mutated only via the /sim routes. Persisted to
 * a singleton DB row so the simulated time survives an API restart — never
 * read from the DB on every `now()` call, since that must stay synchronous.
 */
export class SimClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  setTime(t: Date): void {
    this.current = t;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

const SIM_CLOCK_ROW_ID = 1;

export async function loadSimClock(prisma: PrismaClient): Promise<SimClock> {
  const row = await prisma.simClockState.findUnique({ where: { id: SIM_CLOCK_ROW_ID } });
  if (row) return new SimClock(row.simulatedNow);

  const initial = new Date();
  await prisma.simClockState.create({
    data: { id: SIM_CLOCK_ROW_ID, simulatedNow: initial },
  });
  return new SimClock(initial);
}

export async function persistSimClock(prisma: PrismaClient, clock: SimClock): Promise<void> {
  await prisma.simClockState.upsert({
    where: { id: SIM_CLOCK_ROW_ID },
    create: { id: SIM_CLOCK_ROW_ID, simulatedNow: clock.now() },
    update: { simulatedNow: clock.now() },
  });
}
