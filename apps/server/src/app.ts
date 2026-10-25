import type { Auth } from "@do-better/auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { createRequireAuth } from "./middleware/auth";

export function createApp({ auth, corsOrigin }: { auth: Auth; corsOrigin: string }) {
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

  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/me", createRequireAuth(auth), (_req, res) => {
    res.json({ user: res.locals.user });
  });

  return app;
}
