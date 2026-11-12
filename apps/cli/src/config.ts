import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_STATE_DIRECTORY } from "./local-state.ts";

export const DEFAULT_PORT = 4310;
export const CONFIG_FILENAME = "do-better.config.json";
export const DEFAULT_DATABASE_PATH = resolve(DEFAULT_STATE_DIRECTORY, "do-better.sqlite");

export interface CliConfig { port: number; databasePath: string }

export function loadConfig(directory = process.cwd()): CliConfig {
  const path = resolve(directory, CONFIG_FILENAME);
  let source: string;
  try { source = readFileSync(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { port: DEFAULT_PORT, databasePath: DEFAULT_DATABASE_PATH };
    throw new Error(`Cannot read ${path}`, { cause: error });
  }
  let config: unknown;
  try { config = JSON.parse(source); }
  catch (error) { throw new Error(`Invalid JSON in ${path}`, { cause: error }); }
  if (config === null || typeof config !== "object" || Array.isArray(config)) throw new Error(`${path} must contain a JSON object`);
  const values = config as Record<string, unknown>;
  if (Object.keys(values).some(key => key !== "port" && key !== "databasePath")) {
    throw new Error(`${path} only supports "port" and "databasePath". Remove the retired "apiUrl" setting; the CLI now opens SQLite directly.`);
  }
  const port = values.port ?? DEFAULT_PORT;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`The port in ${path} must be an integer from 1 to 65535`);
  if (values.databasePath !== undefined && (typeof values.databasePath !== "string" || !values.databasePath.trim() || /^[a-z][a-z\d+.-]*:/i.test(values.databasePath))) {
    throw new Error(`The databasePath in ${path} must be a SQLite file path`);
  }
  return { port, databasePath: typeof values.databasePath === "string" ? resolve(directory, values.databasePath) : DEFAULT_DATABASE_PATH };
}
