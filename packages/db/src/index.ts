import { Database as SQLite } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { resolveDatabasePath, type DatabaseConfig } from "./config";
import { relations } from "./schema";

export function createDb(env: DatabaseConfig) {
  const path = resolveDatabasePath(env.DATABASE_URL, process.cwd());
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const client = new SQLite(path, { create: true });
  try {
    client.exec("PRAGMA foreign_keys = ON");
    client.exec("PRAGMA busy_timeout = 5000");
    client.exec("PRAGMA journal_mode = WAL");
    return drizzle({ client, relations });
  } catch (error) {
    client.close();
    throw error;
  }
}

export type Database = ReturnType<typeof createDb>;
