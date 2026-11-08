import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "do_better_session";
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSession() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS) };
}

export function readSessionToken(headers: Headers): string | null {
  const values = (headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0]!.slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_LIFETIME_MS / 1000) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
