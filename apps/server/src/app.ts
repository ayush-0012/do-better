import type { Auth } from "@do-better/auth";
import type { Database } from "@do-better/db";
import cors from "cors";
import express from "express";

import { createAuthRoutes } from "./routes/auth";
import { createRequireAuth } from "./middleware/auth";
import { createTestRunRoutes } from "./routes/test-runs";

export function createApp({ auth, db, corsOrigin, serverOrigin }: { auth: Auth; db: Database; corsOrigin: string; serverOrigin: string }) {
  const app = express();

  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.use((req, res, next) => {
    if (req.method === "POST" && req.headers.origin && ![corsOrigin, serverOrigin].includes(req.headers.origin)) {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", createAuthRoutes(auth));
  const requireAuth = createRequireAuth(auth);

  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/me", requireAuth, (_req, res) => {
    res.json({ user: res.locals.user });
  });

  app.use("/api", createTestRunRoutes(auth, db));

  return app;
}
