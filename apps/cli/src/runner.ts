import type { EngineParams, EngineResult } from "./constants.ts";
import { runEngine } from "./engine.ts";

/** Configuration safe to keep in memory and show in the UI (never headers or payloads). */
export interface RunConfiguration {
  url: string;
  pattern: EngineParams["requestPattern"];
  rate: number;
  rateUnit: EngineParams["requestRateUnit"];
  durationSeconds: number;
  concurrency: number;
}

export interface LocalRun {
  configuration: RunConfiguration;
  result: EngineResult;
}

export type RunnerStatus =
  | { state: "idle"; lastRunId: string | null }
  | {
      state: "running";
      lastRunId: string | null;
      startedAt: string;
      target: string;
      plannedSeconds: number;
    };

export class RunnerBusyError extends Error {
  constructor(readonly startedAt: string) {
    super("A run is already in progress.");
    this.name = "RunnerBusyError";
  }
}

const MAX_COMPLETED_RUNS = 20;
const completedRuns = new Map<string, LocalRun>();
let latestRunId: string | null = null;
let activeRun: { startedAt: string; target: string; plannedSeconds: number } | null = null;

export function getRunnerStatus(): RunnerStatus {
  if (!activeRun) return { state: "idle", lastRunId: latestRunId };
  return { state: "running", lastRunId: latestRunId, ...activeRun };
}

export function getLocalRun(runId: string): LocalRun | null {
  return completedRuns.get(runId) ?? null;
}

export async function startLocalRun(params: EngineParams): Promise<LocalRun> {
  if (activeRun) throw new RunnerBusyError(activeRun.startedAt);

  activeRun = {
    startedAt: new Date().toISOString(),
    target: params.url,
    plannedSeconds: params.duration.minutes * 60 + params.duration.seconds,
  };
  try {
    const result = await runEngine(params);
    const run = { configuration: toRunConfiguration(params), result };
    completedRuns.set(result.id, run);
    latestRunId = result.id;
    while (completedRuns.size > MAX_COMPLETED_RUNS) {
      const oldestRunId = completedRuns.keys().next().value;
      if (oldestRunId === undefined) break;
      completedRuns.delete(oldestRunId);
    }
    return run;
  } finally {
    activeRun = null;
  }
}

function toRunConfiguration(params: EngineParams): RunConfiguration {
  return {
    url: params.url,
    pattern: params.requestPattern,
    rate: params.requestRate,
    rateUnit: params.requestRateUnit,
    durationSeconds: params.duration.minutes * 60 + params.duration.seconds,
    concurrency: params.concurrencyLimit,
  };
}
