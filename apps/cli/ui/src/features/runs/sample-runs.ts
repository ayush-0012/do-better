import type { RunRecord } from "@/lib/run-types";

// Design fixtures only. They are never presented as measurements from the local runner.
export const sampleRuns: RunRecord[] = [
  createSampleRun("1", "/api/orders", "constant", 20, 30, 600, 594, 6, 0, "duration_elapsed", 16.4),
  createSampleRun("2", "/api/catalog", "burst", 50, 14, 280, 236, 42, 2, "http_500", 42.8),
  createSampleRun("3", "/api/auth/token", "ramp", 40, 60, 1200, 1194, 6, 0, "duration_elapsed", 24.6),
  createSampleRun("4", "/api/cart/items", "constant", 20, 30, 600, 600, 0, 0, "duration_elapsed", 12.2),
  createSampleRun("5", "/api/health", "constant", 5, 60, 300, 300, 0, 0, "duration_elapsed", 3.1),
  createSampleRun("6", "/api/orders", "randomized", 80, 8, 190, 170, 18, 2, "request_error", 86.2),
];

function createSampleRun(
  suffix: string, path: string, pattern: RunRecord["configuration"]["pattern"],
  rate: number, seconds: number, started: number, succeeded: number, failed: number,
  aborted: number, stopReason: RunRecord["result"]["stopReason"], average: number,
): RunRecord {
  const start = new Date(`2026-10-${31 - Number(suffix) + 1}T14:32:05Z`);
  const networkFailures = stopReason === "request_error" ? 1 : 0;
  const failedResponses = failed - networkFailures;
  const statusCounts: Record<string, number> = { "200": succeeded };
  if (failedResponses) statusCounts[stopReason === "http_500" ? "500" : "504"] = failedResponses;
  return {
    configuration: { url: `http://localhost:8080${path}`, pattern, rate, rateUnit: "per_second", durationSeconds: stopReason === "duration_elapsed" ? seconds : 30, concurrency: 10 },
    result: {
      id: `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`,
      startedAt: start.toISOString(), finishedAt: new Date(start.getTime() + seconds * 1000).toISOString(),
      elapsedSeconds: seconds, stopReason, error: networkFailures ? "Connection reset by target" : null,
      metrics: {
        requestsStarted: started, requestsCompleted: succeeded + failedResponses,
        requestsSucceeded: succeeded, requestsFailed: failed, requestsAborted: aborted,
        requestsSkipped: suffix === "6" ? 4 : 0, statusCounts,
        latencyMs: { min: Math.min(3.2, average / 2), average, max: average * 8.5 },
      },
    },
  };
}
