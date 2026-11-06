import { defineRelations } from "drizzle-orm";

import * as authSchema from "./auth";

export * from "./application";
export * from "./auth";

export const relations = defineRelations(authSchema);
