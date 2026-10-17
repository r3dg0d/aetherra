import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/client";
import path from "node:path";

export async function memoryDb(): Promise<Db> {
  const db = drizzle(new PGlite("memory://"), { schema });
  await migrate(db, { migrationsFolder: path.join(import.meta.dirname, "..", "..", "drizzle") });
  return db as unknown as Db;
}
