import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { startTestApi, type TestApi } from "./support/api";

let api: TestApi;
beforeAll(async () => { api = await startTestApi(); });
afterAll(async () => { if (api) await api.close(); });

describe("database-backed sessions", () => {
  test("requires a valid session for /api/me", async () => {
    const response = await new api.Client().request("/api/me");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("returns only the user, with persistent HttpOnly cookies", async () => {
    const { client, user } = await api.signup();
    const response = await client.request("/api/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user });
    expect(Object.keys(await (await client.request("/api/me")).json() as object)).toEqual(["user"]);
    expect(client.cookies.has("better-auth.session_token")).toBe(true);
    const stored = await api.db.$client.query('SELECT id FROM "session" WHERE user_id = $1', [user.id]);
    expect(stored.rowCount).toBe(1);
  });

  test("rejects incorrect passwords and revokes the session at logout", async () => {
    const { user, password } = await api.signup();
    const client = new api.Client();
    const invalid = await client.post("/api/auth/sign-in/email", { email: user.email, password: "wrong-password" });
    expect(invalid.status).toBe(401);
    const login = await client.post("/api/auth/sign-in/email", { email: user.email, password });
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie().find((value) => value.startsWith("better-auth.session_token="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("; Secure");
    const oldCookies = new Map(client.cookies);
    expect((await client.post("/api/auth/sign-out")).status).toBe(200);
    for (const [key, value] of oldCookies) client.cookies.set(key, value);
    expect((await client.request("/api/me")).status).toBe(401);
  });

  test("forwards refreshed cookies and rejects expired sessions", async () => {
    const { client, user } = await api.signup();
    await api.db.$client.query('UPDATE "session" SET expires_at = NOW() + INTERVAL \'5 days\' WHERE user_id = $1', [user.id]);
    const refreshed = await client.request("/api/me");
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.getSetCookie().some((cookie) => cookie.startsWith("better-auth.session_token="))).toBe(true);
    await api.db.$client.query('UPDATE "session" SET expires_at = NOW() - INTERVAL \'1 minute\' WHERE user_id = $1', [user.id]);
    expect((await client.request("/api/me")).status).toBe(401);
  });
});
