import type { Auth, AuthUser } from "@do-better/auth";
import type { NextFunction, Request, Response } from "express";

export type AuthLocals = { user: AuthUser };

export function createRequireAuth(auth: Auth) {
  return async (req: Request, res: Response<unknown, AuthLocals>, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const value = await auth.getSession(new Headers({ cookie: req.headers.cookie ?? "" }));
    if (!value) {
      res.append("Set-Cookie", auth.clearCookie());
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (value.cookie) res.append("Set-Cookie", value.cookie);
    res.locals.user = value.user;
    next();
  };
}
