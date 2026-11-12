import type { IncomingMessage, ServerResponse } from "node:http";
import { AccountError, type AccountService } from "./account.ts";
import { engineParamsSchema, MAX_RUN_PAYLOAD_BYTES } from "./constants.ts";
import { getLocalRun, getRunnerStatus, RunnerBusyError, startLocalRun } from "./runner.ts";
import { fetchSavedRun, fetchSavedRuns, fetchSavedRunsSummary } from "./saved-runs.ts";
import type { RunStore } from "./run-store.ts";
import type { UploadService } from "./uploads.ts";

const MAX_BODY_BYTES = MAX_RUN_PAYLOAD_BYTES;

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
    readonly allow?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface LocalApiServices {
  account: AccountService;
  uploads: UploadService;
  store: RunStore;
}

/**
 * Handles the local API. Returns true when the request belonged to /api and a
 * response was sent, so the static UI handler never sees API requests.
 */
export async function handleLocalApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  expectedOrigin: string,
  services: LocalApiServices,
): Promise<boolean> {
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return false;

  try {
    await route(req, res, url, expectedOrigin, services);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.allow) res.setHeader("Allow", error.allow);
      sendJson(res, error.status, { error: error.message, ...(error.issues ? { issues: error.issues } : {}) });
    } else if (error instanceof AccountError) {
      sendJson(res, error.status >= 400 ? error.status : 502, { error: error.message });
    } else {
      console.error(
        `do-better: local API request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      sendJson(res, 500, { error: "The local server could not complete the request." });
    }
  }
  return true;
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  expectedOrigin: string,
  { account, uploads, store }: LocalApiServices,
) {
  if (req.method === "POST") requireOrigin(req, expectedOrigin);
  const publicPaths = ["/api/account", "/api/account/setup", "/api/account/sign-in", "/api/account/sign-out"];
  if (!publicPaths.includes(url.pathname)) await account.requireUser();
  if (url.pathname === "/api/runner") {
    requireMethod(req, "GET");
    sendJson(res, 200, getRunnerStatus());
    return;
  }

  if (url.pathname === "/api/runs") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    if (account.getStatus().state !== "signed_in") {
      throw new ApiError(401, "Sign in before starting a run.");
    }
    const params = engineParamsSchema.safeParse(await readJsonPayload(req));
    if (!params.success) {
      throw new ApiError(400, "The run configuration is invalid.", params.error.issues);
    }
    if (account.getStatus().state !== "signed_in") {
      throw new ApiError(401, "Sign in before starting a run.");
    }

    try {
      const run = await startLocalRun(params.data);
      const upload = await uploads.uploadCompletedRun(run);
      sendJson(res, 200, { run, upload });
    } catch (error) {
      if (error instanceof RunnerBusyError) {
        throw new ApiError(409, error.message);
      }
      throw error;
    }
    return;
  }

  const uploadRunId = runUploadIdFromPath(url.pathname);
  if (uploadRunId !== null) {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const run = getLocalRun(uploadRunId);
    if (!run) throw new ApiError(404, "Run not found.");
    sendJson(res, 200, { upload: await uploads.uploadCompletedRun(run) });
    return;
  }

  const runId = runIdFromPath(url.pathname);
  if (runId !== null) {
    requireMethod(req, "GET");
    const run = getLocalRun(runId);
    if (!run) throw new ApiError(404, "Run not found.");
    sendJson(res, 200, { run, upload: uploads.getUploadState(runId) });
    return;
  }

  if (url.pathname === "/api/account") {
    requireMethod(req, "GET");
    sendJson(res, 200, await accountSnapshot(account, uploads));
    return;
  }

  if (url.pathname === "/api/account/sign-in") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const payload = await readJsonPayload(req);
    const { username, password } = readSignInPayload(payload);
    const accountState = await account.signIn(username, password);
    const retry = await uploads.retryPending();
    sendJson(res, 200, { account: await accountSnapshot(account, uploads), retry, state: accountState.state });
    return;
  }

  if (url.pathname === "/api/account/setup") {
    if (req.method === "GET") {
      sendJson(res, 200, await account.getSetupStatus());
      return;
    }
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const { username, password } = readSignInPayload(await readJsonPayload(req));
    await account.setup(username, password);
    const retry = await uploads.retryPending();
    sendJson(res, 200, { account: await accountSnapshot(account, uploads), retry });
    return;
  }

  if (url.pathname === "/api/account/sign-out") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const result = await account.signOut();
    sendJson(res, 200, { account: await accountSnapshot(account, uploads), ...result });
    return;
  }

  if (url.pathname === "/api/saved-runs") {
    requireMethod(req, "GET");
    sendJson(res, 200, await fetchSavedRuns(account, store, url.searchParams));
    return;
  }

  if (url.pathname === "/api/saved-runs/summary") {
    requireMethod(req, "GET");
    sendJson(res, 200, await fetchSavedRunsSummary(account, store));
    return;
  }

  const savedRunId = savedRunIdFromPath(url.pathname);
  if (savedRunId !== null) {
    requireMethod(req, "GET");
    sendJson(res, 200, await fetchSavedRun(account, store, savedRunId));
    return;
  }

  if (url.pathname === "/api/uploads") {
    requireMethod(req, "GET");
    const status = account.getStatus();
    const userId = status.state === "signed_in" ? status.user.id : undefined;
    sendJson(res, 200, await uploads.getPendingSummary(userId));
    return;
  }

  if (url.pathname === "/api/uploads/retry") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    sendJson(res, 200, await uploads.retryPending());
    return;
  }

  throw new ApiError(404, "Not found.");
}

async function accountSnapshot(account: AccountService, uploads: UploadService) {
  const status = await account.refreshSession();
  if (status.state !== "signed_in") return { ...status, projectId: null };
  const projectId = await uploads.getProjectId(status.user.id);
  return { ...status, projectId };
}

function readSignInPayload(payload: unknown) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "Send a username and password.");
  }
  const { username, password } = payload as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/.test(username.trim())) {
    throw new ApiError(400, "Use a username of 1–64 letters, numbers, dots, underscores, or hyphens.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new ApiError(400, "Use a password between 8 and 128 characters.");
  }
  return { username: username.trim(), password };
}

async function readJsonPayload(req: IncomingMessage) {
  const mediaType = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new ApiError(415, "Send the request body as application/json.");
  }

  const declaredLength = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "The request body is too large.");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, "The request body is too large.");
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, "The request body must be valid JSON.");
  }
}

// Browsers send Origin for cross-origin fetches. Mismatches are rejected so
// another website cannot drive the local runner through the user's browser.
function requireOrigin(req: IncomingMessage, expectedOrigin: string) {
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== expectedOrigin) {
    throw new ApiError(403, "Cross-origin requests are not allowed.");
  }
}

function requireMethod(req: IncomingMessage, method: string) {
  if (req.method !== method) {
    throw new ApiError(405, "Method not allowed.", undefined, method);
  }
}

function savedRunIdFromPath(pathname: string) {
  const match = /^\/api\/saved-runs\/([^/]+)$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function runIdFromPath(pathname: string) {
  const match = /^\/api\/runs\/([^/]+)$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function runUploadIdFromPath(pathname: string) {
  const match = /^\/api\/runs\/([^/]+)\/upload$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.byteLength,
    "Cache-Control": "no-store",
  });
  res.end(body);
}
