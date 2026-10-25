import type { Auth, Session } from "@do-better/auth";
import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";

export type AuthLocals = {
  user: Session["user"];
  session: Session["session"];
};

export function createRequireAuth(auth: Auth) {
  return async (
    req: Request,
    res: Response<unknown, AuthLocals>,
    next: NextFunction,
  ) => {
    res.set("Cache-Control", "no-store");

    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });

    // Session refresh and invalid-session cleanup can both change cookies.
    for (const cookie of headers.getSetCookie()) {
      res.append("Set-Cookie", cookie);
    }

    if (!response) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.locals.user = response.user;
    res.locals.session = response.session;
    next();
  };
}
