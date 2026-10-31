import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DEFAULT_PORT = 4310;
export const CONFIG_FILENAME = "do-better.config.json";

export async function loadConfig(directory = process.cwd()): Promise<{ port: number }> {
  const path = resolve(directory, CONFIG_FILENAME);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { port: DEFAULT_PORT };
    throw new Error(`Cannot read ${path}`, { cause: error });
  }

  let config: unknown;
  try {
    config = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}`, { cause: error });
  }
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  const values = config as Record<string, unknown>;
  if (Object.keys(values).some((key) => key !== "port")) {
    throw new Error(`${path} only supports the "port" setting`);
  }
  const port = values.port === undefined ? DEFAULT_PORT : values.port;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`The port in ${path} must be an integer from 1 to 65535`);
  }
  return { port };
}
