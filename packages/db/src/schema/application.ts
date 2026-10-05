import { defineRelationsPart } from "drizzle-orm";
import { doublePrecision, index, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userProject = pgTable(
  "user_project",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_project_user_id_idx").on(table.userId)],
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id").notNull().references(() => userProject.id),
    requestPattern: text("request_pattern").notNull(),
    duration: doublePrecision("duration").notNull(),
    requestRate: integer("request_rate").notNull(),
    concurrencyLimit: integer("concurrency_limit").notNull(),
    maxRequests: integer("max_requests").notNull(),
    reqHandled: integer("req_handled").default(0).notNull(),
    sustainedAt: text("sustained_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("test_runs_project_id_idx").on(table.projectId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    planName: text("plan_name").notNull(),
    planAmount: numeric("plan_amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    expiresOn: timestamp("expires_on", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("payments_user_id_idx").on(table.userId)],
);

export const applicationRelations = defineRelationsPart(
  { user, userProject, testRuns, payments },
  (r) => ({
    user: {
      projects: r.many.userProject({ from: r.user.id, to: r.userProject.userId }),
      payments: r.many.payments({ from: r.user.id, to: r.payments.userId }),
    },
    userProject: {
      user: r.one.user({ from: r.userProject.userId, to: r.user.id }),
      testRuns: r.many.testRuns({ from: r.userProject.id, to: r.testRuns.projectId }),
    },
    testRuns: {
      project: r.one.userProject({ from: r.testRuns.projectId, to: r.userProject.id }),
    },
    payments: {
      user: r.one.user({ from: r.payments.userId, to: r.user.id }),
    },
  }),
);
