import type { EngineResult } from "./constants.ts";
import { engineResultSchema } from "./constants.ts";

const REQUEST_PATTERNS = new Set(["constant", "ramp", "burst", "randomized"]);

export interface SavedRunConfiguration {
  url: string;
  pattern: "constant" | "ramp" | "burst" | "randomized";
  rate: number;
  rateUnit: "per_second";
  durationSeconds: number;
  concurrency: number;
}

export interface SavedRun {
  projectId: string;
  configuration: SavedRunConfiguration;
  result: EngineResult;
  createdAt: string;
}

export interface SavedRunRow {
  projectId: string;
  url: string | null;
  requestPattern: string;
  duration: number;
  requestRate: number;
  concurrencyLimit: number;
  result: unknown;
  createdAt: Date;
}

/**
 * Rebuilds the local run shape from stored columns. Uploads normalize rates to
 * requests per second, so saved runs report `per_second` even when the original
 * configuration used per-minute values.
 */
export function toSavedRun(row: SavedRunRow): SavedRun | null {
  if (!row.url || !REQUEST_PATTERNS.has(row.requestPattern)) return null;
  const result = engineResultSchema.safeParse(row.result);
  if (!result.success) return null;

  return {
    projectId: row.projectId,
    configuration: {
      url: row.url,
      pattern: row.requestPattern as SavedRunConfiguration["pattern"],
      rate: row.requestRate,
      rateUnit: "per_second",
      durationSeconds: row.duration,
      concurrency: row.concurrencyLimit,
    },
    result: result.data,
    createdAt: row.createdAt.toISOString(),
  };
}
