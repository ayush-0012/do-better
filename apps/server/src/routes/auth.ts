import { AuthError, credentialsSchema, type Auth } from "@do-better/auth";
import { Router } from "express";

export function createAuthRoutes(auth: Auth) {
  const router = Router();
  let attempts = 0;
  let windowEnd = 0;

  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  router.get("/setup", async (_req, res) => {
    res.json({ setupRequired: await auth.setupRequired() });
  });

  for (const action of ["setup", "sign-in"] as const) {
    router.post(`/${action}`, async (req, res, next) => {
      const parsed = credentialsSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Enter a valid username and a password of 8–128 characters." }); return; }
      if (Date.now() >= windowEnd) { attempts = 0; windowEnd = Date.now() + 60_000; }
      // Bound expensive password hashing across this single-owner server, including concurrent requests.
      if (++attempts > 10) {
        res.set("Retry-After", String(Math.ceil((windowEnd - Date.now()) / 1000)));
        res.status(429).json({ error: "Too many login attempts. Try again in a minute." }); return;
      }
      try {
        const result = await (action === "setup" ? auth.setup(parsed.data) : auth.signIn(parsed.data));
        res.append("Set-Cookie", result.cookie);
        res.json({ user: result.user });
      } catch (error) {
        if (error instanceof AuthError) res.status(error.status).json({ error: error.message });
        else next(error);
      }
    });
  }

  router.get("/get-session", async (req, res) => {
    const value = await auth.getSession(new Headers({ cookie: req.headers.cookie ?? "" }));
    if (value?.cookie) res.append("Set-Cookie", value.cookie);
    if (!value) res.append("Set-Cookie", auth.clearCookie());
    res.json(value ? { user: value.user } : null);
  });

  router.post("/sign-out", async (req, res) => {
    res.append("Set-Cookie", await auth.signOut(new Headers({ cookie: req.headers.cookie ?? "" })));
    res.json({ success: true });
  });
  return router;
}
