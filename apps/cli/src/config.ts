import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DEFAULT_PORT = 4310;
export const DEFAULT_API_URL = "http://localhost:47381";
export const CONFIG_FILENAME = "do-better.config.json";

export interface CliConfig {
  port: number;
  apiUrl: string;
}

export async function loadConfig(directory = process.cwd()): Promise<CliConfig> {
  const path = resolve(directory, CONFIG_FILENAME);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { port: DEFAULT_PORT, apiUrl: DEFAULT_API_URL };
    }
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
  if (Object.keys(values).some((key) => key !== "port" && key !== "apiUrl")) {
    throw new Error(`${path} only supports the "port" and "apiUrl" settings`);
  }
  const port = values.port === undefined ? DEFAULT_PORT : values.port;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`The port in ${path} must be an integer from 1 to 65535`);
  }
  const apiUrl = values.apiUrl === undefined ? DEFAULT_API_URL : validateApiUrl(values.apiUrl, path);
  return { port, apiUrl };
}

function validateApiUrl(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The apiUrl in ${path} must be an absolute HTTP(S) URL`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`The apiUrl in ${path} must be an absolute HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`The apiUrl in ${path} must be an absolute HTTP(S) URL without credentials`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`The apiUrl in ${path} must be the server origin without a path, query, or hash`);
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new Error(`The apiUrl in ${path} must use HTTPS unless it points to localhost`);
  }
  return url.origin;
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}
