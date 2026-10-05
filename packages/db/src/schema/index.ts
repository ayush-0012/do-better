import { defineRelations } from "drizzle-orm";

import * as authSchema from "./auth";

export * from "./auth";
export * from "./application";

export const relations = defineRelations(authSchema);
