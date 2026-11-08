import { defineConfig } from "drizzle-kit";
import "varlock/auto-load";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { resolveDatabasePath } from "./src/config";

const databasePath = resolveDatabasePath(process.env.DATABASE_URL || "./data/do-better.sqlite", resolve(import.meta.dirname, "../../apps/server"));
mkdirSync(dirname(databasePath), { recursive: true });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
});
