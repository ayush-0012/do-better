import { createAuth } from "@do-better/auth";
import { createDb } from "@do-better/db";
import { resolveDatabasePath } from "@do-better/db/config";
import { fileURLToPath } from "node:url";

import { ENV } from "./env.server";

export const db = createDb({
  DATABASE_URL: resolveDatabasePath(ENV.DATABASE_URL, fileURLToPath(new URL("../", import.meta.url))),
});
export const auth = createAuth({ secureCookies: ENV.NODE_ENV === "production" }, db);
