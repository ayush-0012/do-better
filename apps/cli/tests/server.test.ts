import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { request, type Server } from "node:http";
import { join } from "node:path";
import { startLocalServer } from "../src/server.ts";
import { createUiFixture, removeUiFixture, UI_FIXTURE_INDEX } from "./ui-fixture.ts";

let uiDirectory: string;

beforeAll(async () => {
  uiDirectory = await createUiFixture();
});

afterAll(async () => {
  await removeUiFixture(uiDirectory);
});

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

function portOf(server: Server) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  return address.port;
}

async function withServer(check: (url: string, server: Server) => Promise<void>) {
  const server = await startLocalServer(0, { uiDirectory });
  try {
    await check(`http://127.0.0.1:${portOf(server)}`, server);
  } finally {
    await close(server);
  }
}

describe("local UI server", () => {
  test("serves the index with UI-compatible security headers", async () => {
    await withServer(async (url) => {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      const policy = response.headers.get("content-security-policy") ?? "";
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("font-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(await response.text()).toBe(UI_FIXTURE_INDEX);
    });
  });

  test("serves hashed assets, styles, and fonts with the right types and caching", async () => {
    await withServer(async (url) => {
      const script = await fetch(`${url}/assets/app.js`);
      expect(script.status).toBe(200);
      expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
      expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(await script.text()).toBe("console.log('ui');");

      const stylesheet = await fetch(`${url}/assets/app.css`);
      expect(stylesheet.status).toBe(200);
      expect(stylesheet.headers.get("content-type")).toBe("text/css; charset=utf-8");

      const font = await fetch(`${url}/fonts/manrope-variable.ttf`);
      expect(font.status).toBe(200);
      expect(font.headers.get("content-type")).toBe("font/ttf");
      expect(font.headers.get("cache-control")).toBe("no-store");
      expect(await font.text()).toBe("fixture-font");
    });
  });

  test("supports direct navigation to client-side routes", async () => {
    await withServer(async (url) => {
      for (const path of ["/", "/overview", "/playground", "/history", "/settings", "/runs/abc", "/history/"]) {
        const response = await fetch(`${url}${path}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(await response.text()).toBe(UI_FIXTURE_INDEX);
      }
    });
  });

  test("returns 404 for missing assets, unknown file paths, reserved API paths, and traversal", async () => {
    await withServer(async (url) => {
      for (const path of [
        "/assets/missing.js",
        "/assets",
        "/favicon.ico",
        "/api",
        "/api/me",
        "/assets/..%2f..%2fpackage.json",
        "/..%2fpackage.json",
      ]) {
        const response = await fetch(`${url}${path}`);
        expect(response.status).toBe(404);
      }
    });
  });

  test("answers HEAD requests without a body", async () => {
    await withServer(async (url) => {
      for (const path of ["/", "/playground", "/assets/app.js"]) {
        const response = await fetch(`${url}${path}`, { method: "HEAD" });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("");
      }
    });
  });

  test("rejects writes and foreign host headers", async () => {
    await withServer(async (url) => {
      const post = await fetch(`${url}/playground`, { method: "POST" });
      expect(post.status).toBe(405);
      expect(post.headers.get("allow")).toBe("GET, HEAD");

      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(url, { headers: { Host: "foreign.example" } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on("error", reject);
        req.end();
      });
      expect(status).toBe(403);
    });
  });

  test("fails clearly when the UI build is missing", async () => {
    await expect(startLocalServer(0, { uiDirectory: join(uiDirectory, "missing") }))
      .rejects.toThrow("bun run build:cli");
  });
});
