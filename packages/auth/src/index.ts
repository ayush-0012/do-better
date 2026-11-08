import type { Database } from "@do-better/db";
import { session, user } from "@do-better/db/schema/auth";
import { eq, lte } from "drizzle-orm";
import { z } from "zod";
import { hashToken, newSession, readSessionToken, sessionCookie, SESSION_LIFETIME_MS, SESSION_REFRESH_MS } from "./sessions";

export const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, dots, underscores, or hyphens."),
  password: z.string().min(8).max(128),
});

export type AuthUser = { id: string; username: string };
export type AuthConfig = { secureCookies: boolean };

export class AuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "AuthError"; }
}

export function createAuth(config: AuthConfig, database: Database) {
  let dummyHash: Promise<string> | undefined;
  const publicUser = { id: user.id, username: user.username };
  const clearCookie = () => sessionCookie("", config.secureCookies, 0);

  async function setupRequired() {
    const rows = await database.select({ id: user.id }).from(user).limit(1);
    return rows.length === 0;
  }

  function startSession(userId: string) {
    const value = newSession();
    database.$client.query('DELETE FROM "session" WHERE expires_at <= ?').run(Date.now());
    database.$client.query('INSERT INTO "session" (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(crypto.randomUUID(), value.tokenHash, userId, value.expiresAt.getTime());
    return sessionCookie(value.token, config.secureCookies);
  }

  async function setup(input: unknown) {
    const credentials = credentialsSchema.parse(input);
    if (!await setupRequired()) throw new AuthError("The owner is already configured. Sign in instead.", 409);
    const passwordHash = await Bun.password.hash(credentials.password, { algorithm: "argon2id" });
    // An immediate transaction rechecks after hashing and serializes competing first-time setup requests.
    return database.$client.transaction(() => {
      if (database.$client.query('SELECT id FROM "user" LIMIT 1').get()) {
        throw new AuthError("The owner is already configured. Sign in instead.", 409);
      }
      const owner: AuthUser = { id: crypto.randomUUID(), username: credentials.username };
      database.$client.query('INSERT INTO "user" (id, username, password_hash) VALUES (?, ?, ?)')
        .run(owner.id, owner.username, passwordHash);
      return { user: owner, cookie: startSession(owner.id) };
    }).immediate();
  }

  async function signIn(input: unknown) {
    const credentials = credentialsSchema.parse(input);
    const [owner] = await database.select().from(user).where(eq(user.username, credentials.username)).limit(1);
    // Unknown usernames still pay the password-verification cost.
    const passwordHash = owner?.passwordHash ?? await (dummyHash ??= Bun.password.hash(crypto.randomUUID(), { algorithm: "argon2id" }));
    const valid = await Bun.password.verify(credentials.password, passwordHash);
    if (!owner || !valid) throw new AuthError("Invalid username or password.", 401);
    return { user: { id: owner.id, username: owner.username }, cookie: startSession(owner.id) };
  }

  async function getSession(headers: Headers) {
    const token = readSessionToken(headers);
    if (!token) return null;
    const [record] = await database.select({ user: publicUser, id: session.id, expiresAt: session.expiresAt })
      .from(session).innerJoin(user, eq(session.userId, user.id)).where(eq(session.tokenHash, hashToken(token))).limit(1);
    if (!record) return null;
    if (record.expiresAt.getTime() <= Date.now()) {
      await database.delete(session).where(eq(session.id, record.id));
      return null;
    }
    let expiresAt = record.expiresAt;
    let cookie: string | undefined;
    if (expiresAt.getTime() <= Date.now() + SESSION_LIFETIME_MS - SESSION_REFRESH_MS) {
      expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
      await database.update(session).set({ expiresAt }).where(eq(session.id, record.id));
      cookie = sessionCookie(token, config.secureCookies);
    }
    return { user: record.user, expiresAt, cookie };
  }

  async function signOut(headers: Headers) {
    const token = readSessionToken(headers);
    if (token) await database.delete(session).where(eq(session.tokenHash, hashToken(token)));
    await database.delete(session).where(lte(session.expiresAt, new Date()));
    return clearCookie();
  }

  return { setupRequired, setup, signIn, getSession, signOut, clearCookie };
}

export type Auth = ReturnType<typeof createAuth>;
