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

export interface AccountUser {
  id: string;
  username: string;
}

export interface AccountSnapshot {
  state: "checking" | "signed_out" | "signed_in" | "unavailable";
  user?: AccountUser;
  error?: string;
  projectId: string | null;
}

export type RunUploadState =
  | { state: "uploaded"; projectId: string }
  | { state: "pending"; error: string; projectId: string | null }
  | { state: "not_signed_in" }
  | { state: "not_uploaded" };

export interface LocalRunPayload {
  run: RunRecord;
  upload: RunUploadState;
}

export interface PendingUploadSummary {
  count: number;
  error?: string;
}

export interface RetrySummary {
  uploaded: number;
  remaining: number;
  error?: string;
}

export interface SavedRun extends RunRecord {
  projectId: string;
  createdAt: string;
}

export interface SavedRunList {
  runs: SavedRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface SavedRunsSummary {
  totalRuns: number;
  endpointCount: number;
  completed: number;
  stoppedEarly: number;
  requestsStarted: number;
  requestsSucceeded: number;
  successRate: number | null;
  latestRun: SavedRun | null;
}

export interface SavedRunQuery {
  limit?: number;
  offset?: number;
  search?: string;
  outcome?: "all" | "completed" | "stopped";
  sort?: "newest" | "oldest";
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
export const accountQueryKey = ["account"] as const;
export const pendingUploadsQueryKey = ["pending-uploads"] as const;
export const savedRunsRootQueryKey = ["saved-runs"] as const;
export const savedRunsQueryKey = (query: SavedRunQuery = {}) => ["saved-runs", "list", query] as const;
export const savedRunsSummaryQueryKey = ["saved-runs", "summary"] as const;
export const savedRunQueryKey = (runId: string) => ["saved-runs", "detail", runId] as const;

export async function getRunnerStatus(): Promise<RunnerStatus> {
  return readJson<RunnerStatus>(await request("/api/runner"));
}

export async function startRun(params: EngineParams): Promise<LocalRunPayload> {
  const payload = await readJson<LocalRunPayload>(
    await request("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),
  );
  return payload;
}

export async function getRun(runId: string): Promise<LocalRunPayload | null> {
  const response = await request(`/api/runs/${encodeURIComponent(runId)}`);
  if (response.status === 404) return null;
  return readJson<LocalRunPayload>(response);
}

export async function retryRunUpload(runId: string): Promise<RunUploadState> {
  const payload = await readJson<{ upload: RunUploadState }>(
    await request(`/api/runs/${encodeURIComponent(runId)}/upload`, { method: "POST" }),
  );
  return payload.upload;
}

export async function getAccount(): Promise<AccountSnapshot> {
  return readJson<AccountSnapshot>(await request("/api/account"));
}

export async function signIn(username: string, password: string) {
  const payload = await readJson<{ account: AccountSnapshot; retry: RetrySummary }>(
    await request("/api/account/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  );
  return payload;
}

export async function setupOwner(username: string, password: string) {
  return readJson<{ account: AccountSnapshot; retry: RetrySummary }>(
    await request("/api/account/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  );
}

export async function signOut() {
  return readJson<{ account: AccountSnapshot; warning?: string }>(
    await request("/api/account/sign-out", { method: "POST" }),
  );
}

export async function getSetupStatus() {
  return readJson<{ setupRequired: boolean }>(await request("/api/account/setup"));
}

export async function getPendingUploads(): Promise<PendingUploadSummary> {
  return readJson<PendingUploadSummary>(await request("/api/uploads"));
}

export async function getSavedRuns(query: SavedRunQuery = {}): Promise<SavedRunList> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.search) params.set("search", query.search);
  if (query.outcome && query.outcome !== "all") params.set("outcome", query.outcome);
  if (query.sort) params.set("sort", query.sort);
  const suffix = params.toString();
  return readJson<SavedRunList>(await request(`/api/saved-runs${suffix ? `?${suffix}` : ""}`));
}

export async function getSavedRunsSummary(): Promise<SavedRunsSummary> {
  const payload = await readJson<{ summary: SavedRunsSummary }>(
    await request("/api/saved-runs/summary"),
  );
  const summary = payload.summary;
  const counts = summary && [
    summary.totalRuns, summary.endpointCount, summary.completed,
    summary.stoppedEarly, summary.requestsStarted, summary.requestsSucceeded,
  ];
  if (!counts || counts.some((value) => !Number.isSafeInteger(value) || value < 0)
    || (summary.successRate !== null
      && (!Number.isFinite(summary.successRate) || summary.successRate < 0 || summary.successRate > 100))) {
    throw new LocalApiError("Saved history summary is incomplete. Try again.", 502);
  }
  return summary;
}

export async function getSavedRun(runId: string): Promise<SavedRun> {
  const payload = await readJson<{ run: SavedRun }>(
    await request(`/api/saved-runs/${encodeURIComponent(runId)}`),
  );
  return payload.run;
}

export async function retryPendingUploads(): Promise<RetrySummary> {
  return readJson<RetrySummary>(await request("/api/uploads/retry", { method: "POST" }));
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
