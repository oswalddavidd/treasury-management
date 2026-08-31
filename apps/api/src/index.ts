import { buildApp } from "./app.js";

// Safety net, not a substitute for fixing the real bug — an unhandled
// rejection anywhere (a transient DB blip after the host sleeps, a missed
// .catch() on a background listener) crashed this whole process once
// already. Every real call site should still handle its own errors; this
// just stops a future oversight from taking the server down entirely.
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const port = Number(process.env.PORT ?? 4000);

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
