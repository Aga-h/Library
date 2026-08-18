import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";

// Next's dev server re-evaluates server modules on every hot reload. Without this guard each
// save built a fresh Pool whose sockets were never closed, so a few dozen edits exhausted the
// database's connection slots. On Vercel the module is evaluated once per instance, so the
// guard is a no-op there.
const globalForDb = globalThis as unknown as {
  __libraryPool?: Pool;
  __libraryDb?: PrismaClient;
};

const pool =
  globalForDb.__libraryPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

if (!globalForDb.__libraryPool) {
  // Lets Vercel drain the pool when the instance suspends.
  attachDatabasePool(pool);
}

export const db =
  globalForDb.__libraryDb ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__libraryPool = pool;
  globalForDb.__libraryDb = db;
}
