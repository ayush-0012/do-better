import { createServer } from "node:http";
import { createAuth } from "@do-better/auth";
import { createDb } from "@do-better/db";

import { createApp } from "../../src/app";

export async function startTestApi() {
  const databaseURL = process.env.TEST_DATABASE_URL;
  if (!databaseURL) throw new Error("Set TEST_DATABASE_URL to a dedicated test database with the project schema applied.");

  const db = createDb({ DATABASE_URL: databaseURL });
  await db.$client.query("SELECT 1");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server port");
  const baseURL = `http://127.0.0.1:${address.port}`;
  const auth = createAuth({
    BETTER_AUTH_URL: baseURL,
    CORS_ORIGIN: baseURL,
    BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    GOOGLE_CLIENT_ID: "test-google-client",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
    GITHUB_CLIENT_ID: "test-github-client",
    GITHUB_CLIENT_SECRET: "test-github-secret",
  }, db);
  server.on("request", createApp({ auth, db, corsOrigin: baseURL }));
  const userIds: string[] = [];

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

  async function signup() {
    const client = new Client();
    const email = `verify-${crypto.randomUUID()}@example.com`;
    const password = "a-long-integration-test-password";
    const response = await client.post("/api/auth/sign-up/email", { name: "Test User", email, password });
    if (response.status !== 200) throw new Error(`Test signup failed: HTTP ${response.status}`);
    const { user } = await response.json() as { user: { id: string; email: string } };
    userIds.push(user.id);
    return { client, user, password };
  }

  async function close() {
    try {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
      if (userIds.length) {
        const ids = [userIds];
        await db.$client.query('DELETE FROM "test_runs" WHERE project_id IN (SELECT id FROM "user_project" WHERE user_id = ANY($1::text[]))', ids);
        await db.$client.query('DELETE FROM "user_project" WHERE user_id = ANY($1::text[])', ids);
        await db.$client.query('DELETE FROM "session" WHERE user_id = ANY($1::text[])', ids);
        await db.$client.query('DELETE FROM "account" WHERE user_id = ANY($1::text[])', ids);
        await db.$client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', ids);
      }
    } finally {
      await db.$client.end();
    }
  }

  return { db, auth, baseURL, Client, signup, close };
}

export type TestApi = Awaited<ReturnType<typeof startTestApi>>;
