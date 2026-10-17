import "server-only";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __aetherraDb?: Promise<{ db: Db; driver: "postgres" | "pglite" }> };

async function init(): Promise<{ db: Db; driver: "postgres" | "pglite" }> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, driver: "postgres" };
  }
  // Documented fallback: embedded PGlite (real Postgres compiled to WASM) persisted under .data/.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, driver: "pglite" };
}

export function getDb() {
  g.__aetherraDb ??= init().catch((e) => {
    g.__aetherraDb = undefined;
    throw e;
  });
  return g.__aetherraDb;
}

export { schema };
