import { isDeepStrictEqual } from "node:util";
import type { Auth } from "@do-better/auth";
import type { Database } from "@do-better/db";
import { testRuns, userProject } from "@do-better/db/schema/application";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { RequestRateUnit, testRunUploadSchema } from "../../../cli/src/constants";
import { createRequireAuth } from "../middleware/auth";

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
