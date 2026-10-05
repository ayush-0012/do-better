import { createAuth } from "@do-better/auth";
import { createDb } from "@do-better/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
