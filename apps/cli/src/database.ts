import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb, migrate } from "../../../packages/db/src/index.ts";

export { and, count, countDistinct, desc, eq, isNotNull, sql, testRuns, userProject } from "../../../packages/db/src/index.ts";
export type { Database } from "../../../packages/db/src/index.ts";

export function openDatabase(path: string) {
  const db = createDb({ DATABASE_URL: path });
  try {
    const bundled = fileURLToPath(new URL("./migrations", import.meta.url));
    const source = fileURLToPath(new URL("../../../packages/db/src/migrations", import.meta.url));
    const migrationsFolder = existsSync(bundled) ? bundled : source;
    const result = migrate(db, { migrationsFolder });
    if (result) throw new Error(`SQLite migrations could not be applied: ${JSON.stringify(result)}`);
    return db;
  } catch (error) { db.$client.close(); throw error; }
}
