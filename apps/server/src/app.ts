import type { Auth } from "@do-better/auth";
import type { Database } from "@do-better/db";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import cors from "cors";
import express from "express";

import { createRequireAuth } from "./middleware/auth";
import { createTestRunRoutes } from "./routes/test-runs";

export function createApp({ auth, db, corsOrigin }: { auth: Auth; db: Database; corsOrigin: string }) {
  const app = express();

  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  // Better Auth reads the request body itself.
  app.all("/api/auth{/*path}", toNodeHandler(auth));

  app.use(express.json());
  const requireAuth = createRequireAuth(auth);

  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/me", requireAuth, (_req, res) => {
    res.json({ user: res.locals.user });
  });

  // The hosted OAuth callback lands here with a session cookie. A short-lived
  // single-use token lets the local CLI take over the session without exposing
  // the backend cookie to the browser UI.
  app.get("/api/desktop/handoff", requireAuth, async (req, res) => {
    const port = Number(req.query.port);
    const state = req.query.state;
    if (!Number.isInteger(port) || port < 1 || port > 65535
      || typeof state !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(state)) {
      res.status(400).json({ error: "Invalid desktop handoff" });
      return;
    }

    try {
      const { token } = await auth.api.generateOneTimeToken({
        headers: fromNodeHeaders(req.headers),
      });
      const target = new URL(`http://127.0.0.1:${port}/api/account/oauth/complete`);
      target.searchParams.set("token", token);
      target.searchParams.set("state", state);
      res.redirect(302, target.toString());
    } catch (error) {
      console.error(
        `Handoff failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(500).json({ error: "Could not complete desktop sign-in" });
    }
  });

  app.use("/api", createTestRunRoutes(auth, db));

  return app;
}
