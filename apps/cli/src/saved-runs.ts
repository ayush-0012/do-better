import { AccountError, type AccountService } from "./account.ts";

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["all", "completed", "stopped"]);
const SORTS = new Set(["newest", "oldest"]);

/**
 * Read-only proxies for saved runs. The master session stays in the CLI; the
 * local UI receives only run data.
 */
export async function fetchSavedRuns(account: AccountService, params: URLSearchParams) {
  return requestJson(account, `/api/saved-runs?${listQuery(params).toString()}`);
}

export function fetchSavedRunsSummary(account: AccountService) {
  return requestJson(account, "/api/saved-runs/summary");
}

export function fetchSavedRun(account: AccountService, runId: string) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AccountError("Enter a valid run ID.", 400);
  }
  return requestJson(account, `/api/saved-runs/${encodeURIComponent(runId)}`);
}

function listQuery(params: URLSearchParams) {
  const limit = readInteger(params.get("limit"), 20, 1, 100, "limit");
  const offset = readInteger(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER, "offset");
  const outcome = params.get("outcome") ?? "all";
  const sort = params.get("sort") ?? "newest";
  if (!OUTCOMES.has(outcome)) throw new AccountError("Choose a valid run outcome.", 400);
  if (!SORTS.has(sort)) throw new AccountError("Choose a valid run order.", 400);

  const search = (params.get("search") ?? "").trim();
  if (search.length > 200) {
    throw new AccountError("Keep the history search under 200 characters.", 400);
  }

  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    outcome,
    sort,
  });
  if (search) query.set("search", search);
  return query;
}

function readInteger(value: string | null, fallback: number, min: number, max: number, label: string) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AccountError(`The ${label} value is out of range.`, 400);
  }
  return parsed;
}

async function requestJson(account: AccountService, path: string) {
  let response: Response;
  try {
    response = await account.fetchWithSession(path);
  } catch (error) {
    if (error instanceof AccountError && error.status === 401) await account.invalidate();
    throw error;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AccountError("The master server returned an invalid response.", 502);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AccountError("The master server returned an invalid response.", 502);
  }
  return payload as Record<string, unknown>;
}
