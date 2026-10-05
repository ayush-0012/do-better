import {
  doublePrecision,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userProject = pgTable(
  "user_project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => userProject.id),
    requestPattern: text("request_pattern").notNull(),
    duration: doublePrecision("duration").notNull(),
    requestRate: integer("request_rate").notNull(),
    concurrencyLimit: integer("concurrency_limit").notNull(),
    maxRequests: integer("max_requests").notNull(),
    reqHandled: integer("req_handled").default(0).notNull(),
    sustainedAt: text("sustained_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
);

export const payments = pgTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    planName: text("plan_name").notNull(),
    planAmount: numeric("plan_amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    expiresOn: timestamp("expires_on", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);
