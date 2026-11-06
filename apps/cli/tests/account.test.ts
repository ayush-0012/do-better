import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { AccountError, AccountService } from "../src/account";
import { handleLocalApi } from "../src/api";
import type { UploadService } from "../src/uploads";

describe("email account creation", () => {
  test("creates an account, persists only session data, and restores the session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "do-better-account-"));
    const user = { id: "test-user", name: "Test User", email: "test@example.com" };
    const requests: { path: string; body: unknown }[] = [];
    const fetchMock = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (path === "/api/auth/sign-up/email") {
        expect(new Headers(init?.headers).get("Origin")).toBe("http://localhost:3000");
        return Response.json({ user }, { headers: { "Set-Cookie": "session=test-session; HttpOnly" } });
      }
      expect(new Headers(init?.headers).get("Cookie")).toBe("session=test-session");
      return Response.json({ user });
    }, { preconnect: fetch.preconnect });
    const options = { backendUrl: "http://localhost:3000", stateDirectory: directory, launchBrowser: async () => {}, fetch: fetchMock };
    try {
      const account = new AccountService(options);
      await account.initialize();
      await account.signUp(user.name, user.email, "test-password");
      expect(requests[0]).toEqual({ path: "/api/auth/sign-up/email", body: { name: user.name, email: user.email, password: "test-password" } });
      expect(account.getStatus()).toMatchObject({ state: "signed_in", user });
      const source = await readFile(join(directory, "session.json"), "utf8");
      expect(source).not.toContain("test-password");
      expect(source).not.toContain(user.email);
      expect((await stat(join(directory, "session.json"))).mode & 0o777).toBe(0o600);
      const restored = new AccountService(options);
      await restored.initialize();
      expect(restored.getStatus()).toMatchObject({ state: "signed_in", user });
    } finally {
      await rm(directory, { recursive: true, force: true });
      expect(await stat(directory).catch(() => null)).toBeNull();
    }
  });

  test("reports backend rejection and missing sessions without signing in", async () => {
    for (const response of [
      Response.json({ message: "Account already exists" }, { status: 422 }),
      Response.json({ user: { id: "test-user" } }),
    ]) {
      const directory = await mkdtemp(join(tmpdir(), "do-better-account-"));
      try {
        const account = new AccountService({
          backendUrl: "http://localhost:3000", stateDirectory: directory,
          launchBrowser: async () => {},
          fetch: Object.assign(async () => response, { preconnect: fetch.preconnect }),
        });
        await account.initialize();
        await expect(account.signUp("Test", "test@example.com", "test-password")).rejects.toBeInstanceOf(AccountError);
        expect(account.getStatus().state).toBe("signed_out");
        expect(await stat(join(directory, "session.json")).catch(() => null)).toBeNull();
      } finally {
        await rm(directory, { recursive: true, force: true });
        expect(await stat(directory).catch(() => null)).toBeNull();
      }
    }
  });
});

test("signup validates input and unlocks the local run API", async () => {
  const calls: unknown[] = [];
  let signedIn = false;
  const account = {
    signUp: async (...credentials: string[]) => { calls.push(credentials); signedIn = true; },
    getStatus: () => signedIn
      ? { state: "signed_in", user: { id: "test-user" } }
      : { state: "signed_out" },
  } as unknown as AccountService;
  const uploads = {
    retryPending: async () => { calls.push("retry"); return { uploaded: 0, remaining: 0 }; },
    getProjectId: async () => null,
  } as unknown as UploadService;
  let origin: string;
  const server = createServer((req, res) => {
    void handleLocalApi(req, res, new URL(req.url!, origin), origin, { account, uploads });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
  const valid = { name: " Test User ", email: " test@example.com ", password: "test-password" };
  const request = (body: unknown, overrides: RequestInit = {}) => fetch(`${origin}/api/account/sign-up`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body), ...overrides,
  });
  const requestRun = () => fetch(`${origin}/api/runs`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  try {
    const unauthorized = await requestRun();
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "Sign in before starting a run." });
    for (const body of [null, [], {}, { ...valid, name: " " }, { ...valid, name: "a".repeat(101) },
      { ...valid, password: "short" }, { ...valid, password: "a".repeat(129) }]) {
      expect((await request(body)).status).toBe(400);
    }
    expect((await request(valid, { headers: { Origin: "https://other.example", "Content-Type": "application/json" } })).status).toBe(403);
    expect((await request(valid, { headers: { "Content-Type": "text/plain" } })).status).toBe(415);
    expect((await request(undefined, { method: "GET", body: undefined })).status).toBe(405);
    expect(calls).toEqual([]);
    const response = await request(valid);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ account: { state: "signed_in" }, retry: { uploaded: 0, remaining: 0 } });
    expect(calls).toEqual([["Test User", "test@example.com", "test-password"], "retry"]);
    expect((await requestRun()).status).toBe(400);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});
