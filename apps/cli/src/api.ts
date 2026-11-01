import type { IncomingMessage, ServerResponse } from "node:http";
import { AccountError, type AccountService } from "./account.ts";
import { engineParamsSchema } from "./constants.ts";
import { getLocalRun, getRunnerStatus, RunnerBusyError, startLocalRun } from "./runner.ts";
import type { UploadService } from "./uploads.ts";

const MAX_BODY_BYTES = 1024 * 1024;

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
  { account, uploads }: LocalApiServices,
) {
  if (url.pathname === "/api/runner") {
    requireMethod(req, "GET");
    sendJson(res, 200, getRunnerStatus());
    return;
  }

  if (url.pathname === "/api/runs") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const params = engineParamsSchema.safeParse(await readJsonPayload(req));
    if (!params.success) {
      throw new ApiError(400, "The run configuration is invalid.", params.error.issues);
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
    const { email, password } = readSignInPayload(payload);
    const accountState = await account.signIn(email, password);
    const retry = await uploads.retryPending();
    sendJson(res, 200, { account: await accountSnapshot(account, uploads), retry, state: accountState.state });
    return;
  }

  if (url.pathname === "/api/account/sign-out") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const result = await account.signOut();
    sendJson(res, 200, { account: await accountSnapshot(account, uploads), ...result });
    return;
  }

  if (url.pathname === "/api/account/oauth/start") {
    requireMethod(req, "POST");
    requireOrigin(req, expectedOrigin);
    const payload = await readJsonPayload(req);
    const provider = readProvider(payload);
    await account.startOAuth(provider);
    sendJson(res, 200, { started: true, provider });
    return;
  }

  if (url.pathname === "/api/account/oauth/complete") {
    requireMethod(req, "GET");
    await completeOAuth(res, url, account, uploads);
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

async function completeOAuth(
  res: ServerResponse,
  url: URL,
  account: AccountService,
  uploads: UploadService,
) {
  const token = url.searchParams.get("token");
  const state = url.searchParams.get("state");
  if (!token || !state) {
    sendHtml(res, 400, messagePage("Sign-in link is incomplete", "Return to the app and start sign-in again."));
    return;
  }

  try {
    await account.completeOAuth(token, state);
    await uploads.retryPending();
    res.writeHead(303, { Location: "/settings#account", "Cache-Control": "no-store" });
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in could not be completed.";
    sendHtml(res, 400, messagePage("Sign-in could not be completed", message));
  }
}

async function accountSnapshot(account: AccountService, uploads: UploadService) {
  const status = account.getStatus();
  if (status.state !== "signed_in") return { ...status, projectId: null };
  const projectId = await uploads.getProjectId(status.user.id).catch(() => null);
  return { ...status, projectId };
}

function readSignInPayload(payload: unknown) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "Send an email and password.");
  }
  const { email, password } = payload as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !email.trim() || email.length > 320) {
    throw new ApiError(400, "Enter a valid email address.");
  }
  if (typeof password !== "string" || !password || password.length > 1024) {
    throw new ApiError(400, "Enter your password.");
  }
  return { email: email.trim(), password };
}

function readProvider(payload: unknown) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "Choose a sign-in provider.");
  }
  const provider = (payload as { provider?: unknown }).provider;
  if (provider !== "google" && provider !== "github") {
    throw new ApiError(400, "Choose Google or GitHub to sign in.");
  }
  return provider;
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

function sendHtml(res: ServerResponse, status: number, html: string) {
  const body = Buffer.from(html);
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.byteLength,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function messagePage(title: string, message: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px;line-height:1.5"><h1 style="font-size:24px">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/settings#account">Back to settings</a></p></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
