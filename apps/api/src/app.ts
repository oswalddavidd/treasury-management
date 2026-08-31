import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { prisma } from "./db.js";
import { RealClock } from "./clock/realClock.js";
import { loadSimClock, type SimClock } from "./clock/simClock.js";
import { registerBuffersRoutes } from "./routes/buffers.js";
import { registerSimRoutes } from "./routes/sim.js";
import { registerAlertMonitor } from "./alerts/index.js";
import type { Clock } from "./clock/types.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(sensible);

  const simEnabled = process.env.SIM_ENABLED === "true";
  const clock: Clock = simEnabled ? await loadSimClock(prisma) : new RealClock();

  registerBuffersRoutes(app, { prisma, clock });
  registerAlertMonitor(prisma, clock);

  // Gated purely on the env flag — no route, no link, no reference to /sim
  // exists anywhere else in the app when this is off.
  if (simEnabled) {
    registerSimRoutes(app, { prisma, clock: clock as SimClock });
  }

  return app;
}
