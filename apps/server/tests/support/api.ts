import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createAuth } from "@do-better/auth";
import { createDb } from "@do-better/db";

import { createApp } from "../../src/app";

export async function startTestApi() {
  const db = createDb({ DATABASE_URL: ":memory:" });
  migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../../packages/db/src/migrations", import.meta.url)) });
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server port");
  const baseURL = `http://127.0.0.1:${address.port}`;
  const auth = createAuth({ secureCookies: false }, db);
  server.on("request", createApp({ auth, db, corsOrigin: baseURL, serverOrigin: baseURL }));

  class Client {
    readonly cookies = new Map<string, string>();

    async request(path: string, options: RequestInit = {}) {
      const headers = new Headers(options.headers);
      headers.set("Origin", baseURL);
      headers.set("Content-Type", "application/json");
      if (this.cookies.size) {
        headers.set("Cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
      }
      const response = await fetch(`${baseURL}${path}`, { ...options, headers, redirect: "manual" });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0]!;
        const equals = pair.indexOf("=");
        const name = pair.slice(0, equals);
        if (/max-age=0(?:;|$)/i.test(cookie)) this.cookies.delete(name);
        else this.cookies.set(name, pair.slice(equals + 1));
      }
      return response;
    }

    post(path: string, body: unknown = {}) {
      return this.request(path, { method: "POST", body: JSON.stringify(body) });
    }
  }

  async function setupOwner() {
    const client = new Client();
    const username = `verify-${crypto.randomUUID()}`;
    const password = "a-long-integration-test-password";
    const response = await client.post("/api/auth/setup", { username, password });
    if (response.status !== 200) throw new Error(`Test owner setup failed: HTTP ${response.status}`);
    const { user } = await response.json() as { user: { id: string; username: string } };
    return { client, user, password };
  }

  // Seed a second identity only in tests to retain ownership-isolation coverage.
  async function createUserFixture() {
    const client = new Client();
    const user = { id: crypto.randomUUID(), username: `fixture-${crypto.randomUUID()}` };
    const password = "a-long-integration-test-password";
    db.$client.query('INSERT INTO "user" (id, username, password_hash) VALUES (?, ?, ?)')
      .run(user.id, user.username, await Bun.password.hash(password));
    const response = await client.post("/api/auth/sign-in", { username: user.username, password });
    if (response.status !== 200) throw new Error(`Fixture login failed: HTTP ${response.status}`);
    return { client, user, password };
  }

  async function close() {
    try {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    } finally {
      db.$client.close();
    }
  }

  return { db, auth, baseURL, Client, setupOwner, createUserFixture, close };
}

export type TestApi = Awaited<ReturnType<typeof startTestApi>>;
