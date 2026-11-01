import type { EngineParams, RunRecord } from "@/lib/run-types";

export type RunnerStatus =
  | { state: "idle"; lastRunId: string | null }
  | {
      state: "running";
      lastRunId: string | null;
      startedAt: string;
      target: string;
      plannedSeconds: number;
    };

export interface LocalApiIssue {
  path: string;
  message: string;
}

export class LocalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: LocalApiIssue[] = [],
  ) {
    super(message);
    this.name = "LocalApiError";
  }
}

export const runnerQueryKey = ["runner"] as const;
export const runQueryKey = (runId: string) => ["run", runId] as const;

export async function getRunnerStatus(): Promise<RunnerStatus> {
  const response = await request("/api/runner");
  return readJson<RunnerStatus>(response);
}

export async function startRun(params: EngineParams): Promise<RunRecord> {
  const response = await request("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await readJson<{ run: RunRecord }>(response);
  return payload.run;
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const response = await request(`/api/runs/${encodeURIComponent(runId)}`);
  if (response.status === 404) return null;
  const payload = await readJson<{ run: RunRecord }>(response);
  return payload.run;
}

async function request(path: string, init?: RequestInit) {
  try {
    return await fetch(path, init);
  } catch {
    throw new LocalApiError(
      "Could not reach the local server. Check that do-better is still running.",
      0,
    );
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Reported as an invalid response below.
  }

  if (!response.ok) {
    const error = payload as { error?: unknown; issues?: unknown } | null;
    throw new LocalApiError(
      typeof error?.error === "string" ? error.error : `The local server returned HTTP ${response.status}.`,
      response.status,
      Array.isArray(error?.issues) ? (error.issues as LocalApiIssue[]) : [],
    );
  }

  if (payload === null || typeof payload !== "object") {
    throw new LocalApiError("The local server returned an invalid response.", response.status);
  }
  return payload as T;
}
