import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../../apps/cli/src/config";
import { resolveDatabasePath } from "./src/config";

const settings = loadConfig(resolve(import.meta.dirname, "../../apps/cli"));
const databasePath = process.env.DATABASE_URL
  ? resolveDatabasePath(process.env.DATABASE_URL, process.cwd())
  : settings.databasePath;
mkdirSync(dirname(databasePath), { recursive: true });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: { url: databasePath },
});
