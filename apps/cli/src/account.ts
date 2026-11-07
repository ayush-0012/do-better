import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  readJsonFile,
  removeJsonFile,
  resolveStateDirectory,
  writeJsonFile,
} from "./local-state.ts";

const SESSION_FILENAME = "session.json";
const REQUEST_TIMEOUT_MS = 5_000;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
const OAUTH_STATES = new Set(["google", "github"]);

export interface AccountUser {
  id: string;
  name?: string;
  email?: string;
}

export type AccountStatus =
  | { state: "checking"; backendUrl: string }
  | { state: "signed_out"; backendUrl: string }
  | { state: "signed_in"; backendUrl: string; user: AccountUser }
  | { state: "unavailable"; backendUrl: string; error: string };

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

interface JsonRequestInit extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export interface AccountServiceOptions {
  backendUrl: string;
  stateDirectory?: string;
  launchBrowser: (url: string) => Promise<void>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface StoredSession {
  cookies: Record<string, string>;
  savedAt?: string;
}

export class AccountService {
  private readonly backendUrl: string;
  private readonly sessionPath: string;
  private readonly launchBrowser: (url: string) => Promise<void>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly cookies = new Map<string, string>();
  private readonly pendingOAuthStates = new Map<string, number>();
  private status: AccountStatus;
  private initialization: Promise<void> | null = null;

  constructor(options: AccountServiceOptions) {
    this.backendUrl = options.backendUrl;
    this.sessionPath = join(
      resolveStateDirectory(options.stateDirectory),
      SESSION_FILENAME,
    );
    this.launchBrowser = options.launchBrowser;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.status = { state: "checking", backendUrl: this.backendUrl };
  }

  initialize() {
    this.initialization ??= this.loadSavedSession();
    return this.initialization;
  }

  getStatus(): AccountStatus {
    return this.status;
  }

  get backendOrigin() {
    return this.backendUrl;
  }

  async signIn(email: string, password: string) {
    return this.authenticateEmail("sign-in", { email, password });
  }

  async signUp(name: string, email: string, password: string) {
    return this.authenticateEmail("sign-up", { name, email, password });
  }

  private async authenticateEmail(action: "sign-in" | "sign-up", credentials: { name?: string; email: string; password: string }) {
    const response = await this.request(`/api/auth/${action}/email`, {
      method: "POST",
      body: credentials,
    });
    const payload = await readResponse<{ user?: unknown }>(response);
    const startedSession = this.captureCookies(response.headers);
    const user = toAccountUser(payload.user);
    if (!user || !startedSession) {
      throw new AccountError("The master server did not start a session.", 502);
    }
    this.status = { state: "signed_in", backendUrl: this.backendUrl, user };
    await this.persistSession();
    return this.getStatus();
  }

  async signOut(): Promise<{ warning?: string }> {
    let warning: string | undefined;
    if (this.cookies.size > 0) {
      try {
        const response = await this.request("/api/auth/sign-out", {
          method: "POST",
          body: {},
        });
        this.captureCookies(response.headers);
      } catch (error) {
        warning =
          error instanceof Error
            ? `Signed out locally, but the master server could not be reached: ${error.message}`
            : "Signed out locally, but the master server could not be reached.";
      }
    }
    this.cookies.clear();
    await removeJsonFile(this.sessionPath);
    this.status = { state: "signed_out", backendUrl: this.backendUrl };
    return warning ? { warning } : {};
  }

  async startOAuth(provider: string): Promise<{ provider: string }> {
    if (!OAUTH_STATES.has(provider)) {
      throw new AccountError("Choose Google or GitHub to sign in.", 400);
    }

    this.pruneOAuthStates();
    if (!this.localPortValue) {
      throw new AccountError("The local server is not ready for browser sign-in.", 500);
    }
    const state = randomBytes(32).toString("base64url");
    this.pendingOAuthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);

    let url: string;
    try {
      const response = await this.request("/api/auth/sign-in/social", {
        method: "POST",
        body: {
          provider,
          callbackURL: `/api/desktop/handoff?port=${this.localPortValue}&state=${state}`,
          disableRedirect: true,
        },
      });
      const payload = await readResponse<{ url?: unknown }>(response);
      if (typeof payload.url !== "string" || !payload.url) {
        throw new AccountError("The master server did not return a sign-in URL.", 502);
      }
      url = payload.url;
    } catch (error) {
      this.pendingOAuthStates.delete(state);
      throw error;
    }

    try {
      await this.launchBrowser(url);
    } catch (error) {
      this.pendingOAuthStates.delete(state);
      throw new AccountError(
        `Could not open the browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { provider };
  }

  async completeOAuth(token: string, state: string) {
    this.pruneOAuthStates();
    if (!this.pendingOAuthStates.has(state)) {
      throw new AccountError("This sign-in link is invalid or has expired.", 400);
    }
    this.pendingOAuthStates.delete(state);

    const response = await this.request("/api/auth/one-time-token/verify", {
      method: "POST",
      body: { token },
    });
    const payload = await readResponse<{ user?: unknown }>(response);
    const startedSession = this.captureCookies(response.headers);
    const user = toAccountUser(payload.user);
    if (!user || !startedSession) {
      throw new AccountError("The master server did not start a session.", 502);
    }
    this.status = { state: "signed_in", backendUrl: this.backendUrl, user };
    await this.persistSession();
    void this.refreshSession();
    return this.getStatus();
  }

  /**
   * Sends an authenticated request to the master. Callers must check the
   * account state first; a missing session is treated as an authentication
   * failure rather than silently sending an anonymous request.
   */
  async fetchWithSession(path: string, init: JsonRequestInit = {}) {
    if (this.cookies.size === 0) {
      throw new AccountError("Sign in to the master server first.", 401);
    }
    const response = await this.request(path, init);
    if (this.captureCookies(response.headers)) await this.persistSession();
    return response;
  }

  invalidate() {
    this.cookies.clear();
    this.status = { state: "signed_out", backendUrl: this.backendUrl };
    return removeJsonFile(this.sessionPath).catch(() => undefined);
  }

  setLocalPort(port: number) {
    this.localPortValue = port;
  }

  private localPortValue: number | null = null;

  private async loadSavedSession() {
    let stored: unknown;
    try {
      stored = await readJsonFile(this.sessionPath);
    } catch (error) {
      this.status = {
        state: "unavailable",
        backendUrl: this.backendUrl,
        error:
          error instanceof Error
            ? `The saved session could not be read: ${error.message}`
            : "The saved session could not be read.",
      };
      return;
    }

    if (stored === null) {
      this.status = { state: "signed_out", backendUrl: this.backendUrl };
      return;
    }
    if (!isStoredSession(stored)) {
      this.status = {
        state: "unavailable",
        backendUrl: this.backendUrl,
        error: "The saved session file is invalid. Sign in again to replace it.",
      };
      return;
    }

    for (const [name, value] of Object.entries(stored.cookies)) {
      this.cookies.set(name, value);
    }
    if (this.cookies.size === 0) {
      await removeJsonFile(this.sessionPath);
      this.status = { state: "signed_out", backendUrl: this.backendUrl };
      return;
    }
    await this.refreshSession();
  }

  private async refreshSession() {
    if (this.cookies.size === 0) {
      this.status = { state: "signed_out", backendUrl: this.backendUrl };
      return this.status;
    }

    let response: Response;
    try {
      response = await this.request("/api/auth/get-session", { method: "GET" });
    } catch (error) {
      if (error instanceof AccountError && (error.status === 401 || error.status === 403)) {
        await this.invalidate();
        return this.status;
      }
      this.status = {
        state: "unavailable",
        backendUrl: this.backendUrl,
        error:
          error instanceof Error
            ? error.message
            : "The master server could not be reached.",
      };
      return this.status;
    }

    let payload: { user?: unknown };
    try {
      payload = await readResponse<{ user?: unknown }>(response);
    } catch (error) {
      this.status = {
        state: "unavailable",
        backendUrl: this.backendUrl,
        error:
          error instanceof Error
            ? error.message
            : "The master server returned an invalid response.",
      };
      return this.status;
    }
    this.captureCookies(response.headers);
    const user = toAccountUser(payload.user);
    if (!user) {
      await this.invalidate();
      return this.status;
    }

    this.status = { state: "signed_in", backendUrl: this.backendUrl, user };
    await this.persistSession();
    return this.status;
  }

  private async request(path: string, init: JsonRequestInit = {}) {
    const { body: requestBody, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("Origin", this.backendUrl);
    if (requestBody !== undefined) headers.set("Content-Type", "application/json");
    if (this.cookies.size > 0) headers.set("Cookie", this.cookieHeader());
    const body = requestBody === undefined ? undefined : JSON.stringify(requestBody);

    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.backendUrl), {
        ...rest,
        body,
        headers,
        signal: rest.signal ?? AbortSignal.timeout(this.timeoutMs),
        redirect: "manual",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? "The master server did not respond in time."
          : "Could not reach the account service. Please try again.";
      throw new AccountError(message);
    }

    if (!response.ok) {
      const payload = await readResponse<{ message?: unknown; error?: unknown }>(response);
      const message =
        typeof payload.message === "string"
          ? payload.message
          : typeof payload.error === "string"
            ? payload.error
            : `The master server returned HTTP ${response.status}.`;
      throw new AccountError(message, response.status);
    }
    return response;
  }

  private captureCookies(headers: Headers) {
    let changed = false;
    for (const cookie of headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      if (!pair) continue;
      const equals = pair.indexOf("=");
      if (equals <= 0) continue;
      const name = pair.slice(0, equals).trim();
      const value = pair.slice(equals + 1).trim();
      const expired = /max-age=0(?:;|$)/i.test(cookie) || !value;
      if (expired) {
        if (this.cookies.delete(name)) changed = true;
      } else {
        this.cookies.set(name, value);
        changed = true;
      }
    }
    return changed;
  }

  private cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  private async persistSession() {
    if (this.cookies.size === 0) {
      await removeJsonFile(this.sessionPath);
      return;
    }
    const stored: StoredSession = {
      cookies: Object.fromEntries(this.cookies),
      savedAt: new Date().toISOString(),
    };
    await writeJsonFile(this.sessionPath, stored);
  }

  private pruneOAuthStates() {
    const now = Date.now();
    for (const [state, expiresAt] of this.pendingOAuthStates) {
      if (expiresAt <= now) this.pendingOAuthStates.delete(state);
    }
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const cookies = (value as { cookies?: unknown }).cookies;
  return (
    cookies !== null &&
    typeof cookies === "object" &&
    !Array.isArray(cookies) &&
    Object.values(cookies).every((cookie) => typeof cookie === "string")
  );
}

function toAccountUser(value: unknown): AccountUser | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const user = value as { id?: unknown; name?: unknown; email?: unknown };
  if (typeof user.id !== "string" || !user.id) return null;
  return {
    id: user.id,
    ...(typeof user.name === "string" ? { name: user.name } : {}),
    ...(typeof user.email === "string" ? { email: user.email } : {}),
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new AccountError("The master server returned an invalid response.", response.status);
  }
}
