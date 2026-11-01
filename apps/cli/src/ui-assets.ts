import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Works from both src/ during development and dist/ after `build:cli`.
export const DEFAULT_UI_DIRECTORY = fileURLToPath(new URL("../ui/dist", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export type UiRequest =
  | { kind: "file"; filePath: string; immutable: boolean }
  | { kind: "index" }
  | { kind: "not-found" };

export function contentTypeFor(filePath: string) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolves a URL pathname to a file inside the UI build. Extension-less paths
 * are client-side routes, so they fall back to index.html; asset-like paths
 * that do not exist must 404 instead of returning HTML.
 */
export function resolveUiRequest(uiDirectory: string, pathname: string): UiRequest {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { kind: "not-found" };
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return { kind: "not-found" };

  const root = resolve(uiDirectory);
  const filePath = resolve(root, `.${decoded}`);
  if (filePath !== root && !filePath.startsWith(root + sep)) return { kind: "not-found" };

  if (decoded === "/" || decoded.endsWith("/")) return { kind: "index" };
  if (decoded === "/api" || decoded.startsWith("/api/")) return { kind: "not-found" };
  if (decoded === "/assets" || decoded.startsWith("/assets/") || extname(decoded) !== "") {
    return { kind: "file", filePath, immutable: decoded.startsWith("/assets/") };
  }
  return { kind: "index" };
}
