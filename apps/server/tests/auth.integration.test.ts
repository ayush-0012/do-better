import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { startTestApi, type TestApi } from "./support/api";

let api: TestApi;
beforeEach(async () => { api = await startTestApi(); });
afterEach(async () => { if (api) await api.close(); });

describe("database-backed sessions", () => {
  test("requires a valid session for /api/me", async () => {
    const response = await new api.Client().request("/api/me");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("returns only the user, with persistent HttpOnly cookies", async () => {
    const { client, user } = await api.setupOwner();
    const response = await client.request("/api/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user });
    expect(Object.keys(await (await client.request("/api/me")).json() as object)).toEqual(["user"]);
    expect(client.cookies.has("do_better_session")).toBe(true);
    const stored = api.db.$client.query('SELECT id FROM "session" WHERE user_id = ?').all(user.id);
    expect(stored.length).toBe(1);
  });

  test("rejects incorrect passwords and revokes the session at logout", async () => {
    const { user, password } = await api.setupOwner();
    const client = new api.Client();
    const invalid = await client.post("/api/auth/sign-in", { username: user.username, password: "wrong-password" });
    expect(invalid.status).toBe(401);
    const login = await client.post("/api/auth/sign-in", { username: user.username, password });
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie().find((value) => value.startsWith("do_better_session="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("; Secure");
    const oldCookies = new Map(client.cookies);
    expect((await client.post("/api/auth/sign-out")).status).toBe(200);
    for (const [key, value] of oldCookies) client.cookies.set(key, value);
    expect((await client.request("/api/me")).status).toBe(401);
  });

  test("forwards refreshed cookies and rejects expired sessions", async () => {
    const { client, user } = await api.setupOwner();
    api.db.$client.query('UPDATE "session" SET expires_at = ? WHERE user_id = ?').run(Date.now() + 5 * 24 * 60 * 60 * 1000, user.id);
    const refreshed = await client.request("/api/me");
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.getSetCookie().some((cookie) => cookie.startsWith("do_better_session="))).toBe(true);
    api.db.$client.query('UPDATE "session" SET expires_at = ? WHERE user_id = ?').run(Date.now() - 60 * 1000, user.id);
    expect((await client.request("/api/me")).status).toBe(401);
  });
});
