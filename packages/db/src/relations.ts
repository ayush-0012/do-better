import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = {
  ...defineRelations(schema),
  ...schema.authRelations,
  ...schema.applicationRelations,
  user: {
    ...schema.authRelations.user,
    ...schema.applicationRelations.user,
  },
};
