import type { IncomingMessage, ServerResponse } from "node:http";
import { engineParamsSchema } from "./constants.ts";
import { getLocalRun, getRunnerStatus, RunnerBusyError, startLocalRun } from "./runner.ts";

const MAX_BODY_BYTES = 1024 * 1024;

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
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
): Promise<boolean> {
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return false;

  try {
    await route(req, res, url, expectedOrigin);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      sendJson(res, 413, { error: "The request body is too large." });
    } else {
      console.error(
        `do-better: local API request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      sendJson(res, 500, { error: "The local server could not complete the request." });
    }
  }
  return true;
}

async function route(req: IncomingMessage, res: ServerResponse, url: URL, expectedOrigin: string) {
  if (url.pathname === "/api/runner") {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    sendJson(res, 200, getRunnerStatus());
    return;
  }

  if (url.pathname === "/api/runs") {
    if (req.method !== "POST") return methodNotAllowed(res, "POST");
    await createRun(req, res, expectedOrigin);
    return;
  }

  const runId = runIdFromPath(url.pathname);
  if (runId !== null) {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    const run = getLocalRun(runId);
    if (!run) {
      sendJson(res, 404, { error: "Run not found." });
      return;
    }
    sendJson(res, 200, { run });
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

async function createRun(req: IncomingMessage, res: ServerResponse, expectedOrigin: string) {
  // Browsers send Origin for cross-origin fetches. Mismatches are rejected so
  // another website cannot drive the local runner through the user's browser.
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== expectedOrigin) {
    sendJson(res, 403, { error: "Cross-origin requests are not allowed." });
    return;
  }

  const mediaType = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    sendJson(res, 415, { error: "Send the run configuration as application/json." });
    return;
  }

  const body = await readBody(req);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "The request body must be valid JSON." });
    return;
  }

  const parsed = engineParamsSchema.safeParse(payload);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: "The run configuration is invalid.",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const run = await startLocalRun(parsed.data);
    sendJson(res, 200, { run });
  } catch (error) {
    if (error instanceof RunnerBusyError) {
      sendJson(res, 409, { error: error.message, status: getRunnerStatus() });
      return;
    }
    throw error;
  }
}

async function readBody(req: IncomingMessage) {
  const declaredLength = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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

function methodNotAllowed(res: ServerResponse, allow: string) {
  res.setHeader("Allow", allow);
  sendJson(res, 405, { error: "Method not allowed." });
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
