import { join } from "node:path";
import { createAuth, AuthError, type AuthUser } from "../../../packages/auth/src/index.ts";
import type { Database } from "./database.ts";
import { AccountError } from "./errors.ts";
import { readJsonFile, removeJsonFile, resolveStateDirectory, writeJsonFile } from "./local-state.ts";

export { AccountError } from "./errors.ts";
export type AccountUser = AuthUser;
export type AccountStatus =
  | { state: "checking" }
  | { state: "signed_out" }
  | { state: "signed_in"; user: AccountUser }
  | { state: "unavailable"; error: string };

export class AccountService {
  private readonly auth: ReturnType<typeof createAuth>;
  private readonly sessionPath: string;
  private cookies: Record<string, string> = {};
  private status: AccountStatus = { state: "checking" };
  private attempts = 0;
  private windowEnd = 0;

  constructor(database: Database, stateDirectory?: string) {
    this.auth = createAuth({ secureCookies: false }, database);
    this.sessionPath = join(resolveStateDirectory(stateDirectory), "session.json");
  }

  async initialize() {
    const stored = await readJsonFile(this.sessionPath);
    if (stored !== null) {
      if (typeof stored !== "object" || Array.isArray(stored) || !("cookies" in stored)
        || !stored.cookies || typeof stored.cookies !== "object" || Array.isArray(stored.cookies)
        || !Object.values(stored.cookies).every(value => typeof value === "string")) {
        throw new Error(`Invalid saved session at ${this.sessionPath}.`);
      }
      this.cookies = stored.cookies as Record<string, string>;
    }
    await this.refreshSession();
  }

  getStatus() { return this.status; }
  async getSetupStatus() { return { setupRequired: await this.auth.setupRequired() }; }
  async setup(username: string, password: string) { return this.authenticate("setup", username, password); }
  async signIn(username: string, password: string) { return this.authenticate("signIn", username, password); }

  private async authenticate(action: "setup" | "signIn", username: string, password: string) {
    if (Date.now() >= this.windowEnd) { this.attempts = 0; this.windowEnd = Date.now() + 60_000; }
    if (++this.attempts > 10) throw new AccountError("Too many login attempts. Try again in a minute.", 429);
    try {
      const result = await this.auth[action]({ username, password });
      this.captureCookie(result.cookie);
      await this.persist();
      this.status = { state: "signed_in", user: result.user };
      return this.status;
    } catch (error) {
      if (error instanceof AuthError) throw new AccountError(error.message, error.status);
      throw error;
    }
  }

  async refreshSession() {
    const value = await this.auth.getSession(this.headers());
    if (!value) { await this.invalidate(); return this.status; }
    if (value.cookie) { this.captureCookie(value.cookie); await this.persist(); }
    this.status = { state: "signed_in", user: value.user };
    return this.status;
  }

  async requireUser() {
    await this.refreshSession();
    if (this.status.state !== "signed_in") throw new AccountError("Sign in to access your workspace.", 401);
    return this.status.user;
  }

  async signOut() {
    await this.auth.signOut(this.headers());
    await this.invalidate();
    return {};
  }

  async invalidate() {
    this.cookies = {};
    this.status = { state: "signed_out" };
    await removeJsonFile(this.sessionPath);
  }

  private headers() {
    return new Headers({ cookie: Object.entries(this.cookies).map(([name, value]) => `${name}=${value}`).join("; ") });
  }
  private captureCookie(cookie: string) {
    const pair = cookie.split(";")[0]!;
    const index = pair.indexOf("=");
    this.cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }
  private async persist() { await writeJsonFile(this.sessionPath, { cookies: this.cookies, savedAt: new Date().toISOString() }); }
}
