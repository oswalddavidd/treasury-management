import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // All test files share one Postgres DB and reset it between tests —
    // running files in parallel causes cross-file interference.
    fileParallelism: false,
    // CRITICAL: a separate database from dev/.env's DATABASE_URL. Test
    // cleanup hooks wipe every table between tests — running them against
    // the same database an interactive `tsx src/index.ts` session or a
    // real user is using silently destroys that session's data. This must
    // never point at the same database .env does. Set before any test file
    // imports db.ts, so dotenv/config (which doesn't override an
    // already-set var) leaves this value in place.
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:55432/coinbit_buffers_test?schema=public",
    },
  },
});
