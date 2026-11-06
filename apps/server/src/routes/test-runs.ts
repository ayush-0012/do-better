import { isDeepStrictEqual } from "node:util";
import type { Auth } from "@do-better/auth";
import type { Database } from "@do-better/db";
import { testRuns, userProject } from "@do-better/db/schema/application";
import { and, count, countDistinct, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { RequestRateUnit, testRunUploadSchema } from "../../../cli/src/constants";
import { createRequireAuth } from "../middleware/auth";
import { toSavedRun } from "../saved-runs";

const savedRunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().max(200).optional(),
  outcome: z.enum(["all", "completed", "stopped"]).default("all"),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

function savedRunColumns() {
  return {
    projectId: testRuns.projectId,
    url: testRuns.url,
    requestPattern: testRuns.requestPattern,
    duration: testRuns.duration,
    requestRate: testRuns.requestRate,
    concurrencyLimit: testRuns.concurrencyLimit,
    result: testRuns.result,
    createdAt: testRuns.createdAt,
  };
}

export function createTestRunRoutes(auth: Auth, db: Database) {
  const router = Router();
  const requireAuth = createRequireAuth(auth);

  router.post("/projects", requireAuth, async (_req, res) => {
    const [project] = await db.insert(userProject)
      .values({ userId: res.locals.user.id })
      .returning();
    res.status(201).json({ project });
  });

  router.post("/test-runs", requireAuth, async (req, res) => {
    const parsed = testRunUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid test run", issues: parsed.error.issues });
      return;
    }

    const { projectId, params, result } = parsed.data;
    const [project] = await db.select({ id: userProject.id }).from(userProject)
      .where(and(eq(userProject.id, projectId), eq(userProject.userId, res.locals.user.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const requestRate = params.requestRateUnit === RequestRateUnit.PerMinute
      ? params.requestRate / 60
      : params.requestRate;
    const duration = params.duration.minutes * 60 + params.duration.seconds;
    const [inserted] = await db.insert(testRuns).values({
      id: result.id,
      projectId,
      url: params.url,
      requestPattern: params.requestPattern,
      duration,
      requestRate,
      concurrencyLimit: params.concurrencyLimit,
      reqHandled: result.metrics.requestsCompleted,
      result,
      finishedAt: new Date(result.finishedAt),
    }).onConflictDoNothing({ target: testRuns.id }).returning();

    if (inserted) {
      res.status(201).json({ run: inserted });
      return;
    }

    // A lost upload response can be retried without rerunning the target or duplicating history.
    const [existing] = await db.select().from(testRuns)
      .where(and(eq(testRuns.id, result.id), eq(testRuns.projectId, projectId)));
    if (existing && existing.url === params.url && existing.requestPattern === params.requestPattern
      && existing.duration === duration && existing.requestRate === requestRate
      && existing.concurrencyLimit === params.concurrencyLimit
      && isDeepStrictEqual(existing.result, result)) {
      res.json({ run: existing });
      return;
    }
    res.status(409).json({ error: "Run ID already used for a different upload" });
  });

  router.get("/saved-runs", requireAuth, async (req, res) => {
    const parsed = savedRunListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid history query", issues: parsed.error.issues });
      return;
    }

    const { limit, offset, search, outcome, sort } = parsed.data;
    const conditions = [
      eq(userProject.userId, res.locals.user.id),
      isNotNull(testRuns.result),
    ];
    if (search) conditions.push(ilike(testRuns.url, `%${escapeLike(search)}%`));
    if (outcome === "completed") {
      conditions.push(sql`${testRuns.result}->>'stopReason' = 'duration_elapsed'`);
    } else if (outcome === "stopped") {
      conditions.push(sql`${testRuns.result}->>'stopReason' <> 'duration_elapsed'`);
    }
    const where = and(...conditions);

    const [rows, totals] = await Promise.all([
      db.select(savedRunColumns()).from(testRuns)
        .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
        .where(where)
        .orderBy(sort === "oldest" ? sql`${testRuns.createdAt} asc` : desc(testRuns.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(testRuns)
        .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
        .where(where),
    ]);

    res.json({
      runs: rows.map(toSavedRun).filter((run) => run !== null),
      total: Number(totals[0]?.total ?? 0),
      limit,
      offset,
    });
  });

  router.get("/saved-runs/summary", requireAuth, async (_req, res) => {
    const where = and(
      eq(userProject.userId, res.locals.user.id),
      isNotNull(testRuns.result),
    );

    const [aggregate] = await db.select({
      totalRuns: count(),
      endpointCount: countDistinct(testRuns.url),
      completed: sql<string>`count(*) filter (where ${testRuns.result}->>'stopReason' = 'duration_elapsed')`,
      requestsStarted: sql<string>`coalesce(sum((${testRuns.result}->'metrics'->>'requestsStarted')::bigint), 0)`,
      requestsSucceeded: sql<string>`coalesce(sum((${testRuns.result}->'metrics'->>'requestsSucceeded')::bigint), 0)`,
    }).from(testRuns)
      .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(where);

    const [latestRow] = await db.select(savedRunColumns()).from(testRuns)
      .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(where)
      .orderBy(desc(testRuns.createdAt))
      .limit(1);

    const totalRuns = Number(aggregate?.totalRuns ?? 0);
    const completed = Number(aggregate?.completed ?? 0);
    const requestsStarted = Number(aggregate?.requestsStarted ?? 0);
    const requestsSucceeded = Number(aggregate?.requestsSucceeded ?? 0);

    res.json({
      summary: {
        totalRuns,
        endpointCount: Number(aggregate?.endpointCount ?? 0),
        completed,
        stoppedEarly: totalRuns - completed,
        requestsStarted,
        requestsSucceeded,
        successRate: requestsStarted > 0 ? (requestsSucceeded / requestsStarted) * 100 : null,
        latestRun: latestRow ? toSavedRun(latestRow) : null,
      },
    });
  });

  router.get("/saved-runs/:id", requireAuth, async (req, res) => {
    const parsed = z.uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid run ID" });
      return;
    }
    const [row] = await db.select(savedRunColumns()).from(testRuns)
      .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(and(eq(testRuns.id, parsed.data), eq(userProject.userId, res.locals.user.id)));
    if (!row) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    const run = toSavedRun(row);
    if (!run) {
      res.status(422).json({ error: "Test run data is incomplete" });
      return;
    }
    res.json({ run });
  });

  router.get("/test-runs/:id", requireAuth, async (req, res) => {
    const parsed = z.uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid run ID" });
      return;
    }
    const [row] = await db.select({ run: testRuns }).from(testRuns)
      .innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(and(eq(testRuns.id, parsed.data), eq(userProject.userId, res.locals.user.id)));
    if (!row) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    res.json(row);
  });

  return router;
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
