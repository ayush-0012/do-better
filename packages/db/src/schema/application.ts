import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const userProject = sqliteTable(
  "user_project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const testRuns = sqliteTable(
  "test_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => userProject.id),
    requestPattern: text("request_pattern").notNull(),
    duration: real("duration").notNull(),
    requestRate: real("request_rate").notNull(),
    concurrencyLimit: integer("concurrency_limit").notNull(),
    // Not supplied by the current engine; keep legacy values without inventing a limit.
    maxRequests: integer("max_requests"),
    reqHandled: integer("req_handled").default(0).notNull(),
    sustainedAt: text("sustained_at"),
    url: text("url"),
    result: text("result", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
      .notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    planName: text("plan_name").notNull(),
    // Keep decimal amounts as strings so SQLite cannot round them through REAL storage.
    planAmount: text("plan_amount").notNull(),
    currency: text("currency").notNull(),
    expiresOn: integer("expires_on", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
);
