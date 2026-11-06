import { describe, expect, test } from "bun:test";

import type { EngineResult } from "../../cli/src/constants";
import { toSavedRun, type SavedRunRow } from "../src/saved-runs";

function result(): EngineResult {
  return {
    id: crypto.randomUUID(),
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:10.000Z",
    elapsedSeconds: 10,
    stopReason: "duration_elapsed",
    error: null,
    metrics: {
      requestsStarted: 4,
      requestsCompleted: 4,
      requestsSucceeded: 4,
      requestsFailed: 0,
      requestsAborted: 0,
      requestsSkipped: 0,
      statusCounts: { "200": 4 },
      latencyMs: { min: 1, max: 4, average: 2 },
    },
  };
}

function row(overrides: Partial<SavedRunRow> = {}): SavedRunRow {
  return {
    projectId: crypto.randomUUID(),
    url: "http://localhost:8080/orders",
    requestPattern: "constant",
    duration: 30,
    requestRate: 12.5,
    concurrencyLimit: 8,
    result: result(),
    createdAt: new Date("2026-01-01T00:00:10.000Z"),
    ...overrides,
  };
}

describe("toSavedRun", () => {
  test("maps stored columns and normalized rates to a run", () => {
    const input = row();
    const saved = toSavedRun(input);
    expect(saved).not.toBeNull();
    expect(saved).toMatchObject({
      projectId: expect.any(String),
      configuration: {
        url: "http://localhost:8080/orders",
        pattern: "constant",
        rate: 12.5,
        rateUnit: "per_second",
        durationSeconds: 30,
        concurrency: 8,
      },
      createdAt: "2026-01-01T00:00:10.000Z",
    });
    expect(saved?.result).toEqual(input.result as EngineResult);
  });

  test("rejects incomplete or legacy rows", () => {
    expect(toSavedRun(row({ url: null }))).toBeNull();
    expect(toSavedRun(row({ requestPattern: "unknown" }))).toBeNull();
    expect(toSavedRun(row({ result: null }))).toBeNull();
    expect(toSavedRun(row({ result: { id: "not-a-run" } }))).toBeNull();
  });
});
