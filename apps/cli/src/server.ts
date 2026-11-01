import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { handleLocalApi } from "./api.ts";
import { contentTypeFor, DEFAULT_UI_DIRECTORY, resolveUiRequest } from "./ui-assets.ts";

const HOST = "127.0.0.1";

// The built UI needs its own scripts, styles, fonts, and images. Inline style
// attributes are still used by a few components, so style-src allows them.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export interface LocalServerOptions {
  /** Overrides the UI build directory; tests use a fixture. */
  uiDirectory?: string;
}

export async function startLocalServer(port: number, options: LocalServerOptions = {}): Promise<Server> {
  const uiDirectory = resolve(options.uiDirectory ?? DEFAULT_UI_DIRECTORY);
  await assertUiBuild(uiDirectory);

  const server = createServer((req, res) => {
    serveRequest(req, res, server, uiDirectory).catch((error: unknown) => {
      console.error(
        `do-better: local UI request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendText(res, 500, "Internal server error");
    });
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  return server;
}

async function assertUiBuild(uiDirectory: string) {
  const entryPoint = join(uiDirectory, "index.html");
  const message =
    `The local UI build was not found at ${uiDirectory}. Run "bun run build:cli" from the repository root, then start do-better again.`;
  try {
    const entry = await stat(entryPoint);
    if (entry.isFile()) return;
  } catch (error) {
    throw new Error(message, { cause: error });
  }
  throw new Error(message);
}

async function serveRequest(
  req: IncomingMessage,
  res: ServerResponse,
  server: Server,
  uiDirectory: string,
) {
  // Keep the local service inaccessible through attacker-controlled DNS names.
  const address = server.address();
  const expectedHost = typeof address === "object" && address ? `${HOST}:${address.port}` : "";
  if (req.headers.host !== expectedHost) {
    sendText(res, 403, "Forbidden");
    return;
  }

  setSecurityHeaders(res);

  let url: URL;
  try {
    url = new URL(req.url ?? "/", `http://${HOST}`);
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }

  if (await handleLocalApi(req, res, url, `http://${expectedHost}`)) return;

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendText(res, 405, "Method not allowed");
    return;
  }

  const request = resolveUiRequest(uiDirectory, url.pathname);
  if (request.kind === "not-found") {
    sendText(res, 404, "Not found");
    return;
  }

  const filePath = request.kind === "file" ? request.filePath : join(uiDirectory, "index.html");
  const body = await readFile(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "EISDIR") return null;
    throw error;
  });
  if (!body) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": body.byteLength,
    "Cache-Control": request.kind === "file" && request.immutable
      ? "public, max-age=31536000, immutable"
      : "no-store",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function sendText(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(message);
}
