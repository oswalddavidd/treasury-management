import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../db.js";
import type { Clock } from "../clock/types.js";
import { computeCurrentBufferState } from "../engine/index.js";
import { bufferEvents } from "../events.js";

const HEARTBEAT_MS = 5000;

export function registerBuffersRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; clock: Clock },
): void {
  // decimal.js values serialize to plain strings via their own toJSON(),
  // so the computed state is safe to return as-is — no custom serializer.
  app.get("/api/buffers", async () => {
    return computeCurrentBufferState(deps.prisma, deps.clock);
  });

  app.get("/api/buffers/stream", (request, reply) => {
    // Writing directly via reply.raw bypasses Fastify's normal reply
    // pipeline, so @fastify/cors's onSend hook never runs on this response —
    // the CORS header has to be set by hand here or the browser blocks the
    // stream outright.
    const origin = request.headers.origin;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    });

    let closed = false;
    const send = async () => {
      if (closed) return;
      const state = await computeCurrentBufferState(deps.prisma, deps.clock);
      if (closed) return;
      reply.raw.write(`data: ${JSON.stringify(state)}\n\n`);
    };

    // A transient failure here (e.g. the DB briefly unreachable after the
    // host sleeps) must never become an unhandled rejection — that took
    // the whole process down once already. Log and skip the frame; the
    // connection stays open and the next heartbeat/change retries on its
    // own once the DB is back, no client reconnect needed.
    const safeSend = () => {
      send().catch((err) => console.error("[buffers/stream] send failed:", err));
    };

    safeSend();
    bufferEvents.on("changed", safeSend);
    const heartbeat = setInterval(safeSend, HEARTBEAT_MS);

    request.raw.on("close", () => {
      closed = true;
      bufferEvents.off("changed", safeSend);
      clearInterval(heartbeat);
    });
  });
}
