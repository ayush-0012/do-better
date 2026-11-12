import { isDeepStrictEqual } from "node:util";
import { and, count, countDistinct, desc, eq, isNotNull, sql, testRuns, userProject, type Database } from "./database.ts";
import { RequestRateUnit, testRunUploadSchema } from "./constants.ts";
import { AccountError } from "./errors.ts";
import { toSavedRun } from "./saved-run-model.ts";
import { z } from "zod";

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  search: z.string().trim().max(200).optional(),
  outcome: z.enum(["all", "completed", "stopped"]).default("all"),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export class RunStore {
  constructor(private readonly db: Database) {}

  async getProjectId(userId: string) {
    const [project] = await this.db.select({ id: userProject.id }).from(userProject)
      .where(eq(userProject.userId, userId)).orderBy(userProject.createdAt).limit(1);
    return project?.id ?? null;
  }

  createProject(userId: string) {
    return this.db.$client.transaction(() => {
      const existing = this.db.$client.query('SELECT id FROM user_project WHERE user_id = ? ORDER BY created_at LIMIT 1').get(userId) as { id: string } | null;
      if (existing) return existing.id;
      const id = crypto.randomUUID();
      this.db.$client.query('INSERT INTO user_project (id, user_id) VALUES (?, ?)').run(id, userId);
      return id;
    }).immediate();
  }

  async save(userId: string, input: unknown) {
    const parsed = testRunUploadSchema.safeParse(input);
    if (!parsed.success) throw new AccountError("Invalid test run data.", 400);
    const { projectId, params, result } = parsed.data;
    const [project] = await this.db.select({ id: userProject.id }).from(userProject)
      .where(and(eq(userProject.id, projectId), eq(userProject.userId, userId)));
    if (!project) throw new AccountError("Project not found.", 404);
    const values = {
      id: result.id, projectId, url: params.url, requestPattern: params.requestPattern,
      duration: params.duration.minutes * 60 + params.duration.seconds,
      requestRate: params.requestRateUnit === RequestRateUnit.PerMinute ? params.requestRate / 60 : params.requestRate,
      concurrencyLimit: params.concurrencyLimit, reqHandled: result.metrics.requestsCompleted,
      result, finishedAt: new Date(result.finishedAt),
    };
    const [inserted] = await this.db.insert(testRuns).values(values).onConflictDoNothing({ target: testRuns.id }).returning();
    if (inserted) return;
    const [existing] = await this.db.select().from(testRuns).where(and(eq(testRuns.id, result.id), eq(testRuns.projectId, projectId)));
    if (existing && existing.url === values.url && existing.requestPattern === values.requestPattern
      && existing.duration === values.duration && existing.requestRate === values.requestRate
      && existing.concurrencyLimit === values.concurrencyLimit && isDeepStrictEqual(existing.result, result)) return;
    throw new AccountError("Run ID already used for a different result.", 409);
  }

  async list(userId: string, params: URLSearchParams) {
    const parsed = listQuery.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new AccountError("Invalid history query.", 400);
    const { limit, offset, search, outcome, sort } = parsed.data;
    const conditions = [eq(userProject.userId, userId), isNotNull(testRuns.result)];
    if (search) {
      const pattern = `%${search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      conditions.push(sql`${testRuns.url} like ${pattern} escape '\\'`);
    }
    if (outcome === "completed") conditions.push(sql`json_extract(${testRuns.result}, '$.stopReason') = 'duration_elapsed'`);
    if (outcome === "stopped") conditions.push(sql`json_extract(${testRuns.result}, '$.stopReason') <> 'duration_elapsed'`);
    const where = and(...conditions);
    const rows = await this.db.select({ run: testRuns }).from(testRuns).innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(where).orderBy(sort === "oldest" ? sql`${testRuns.createdAt} asc` : desc(testRuns.createdAt)).limit(limit).offset(offset);
    const [totals] = await this.db.select({ total: count() }).from(testRuns).innerJoin(userProject, eq(testRuns.projectId, userProject.id)).where(where);
    return { runs: rows.map(({ run }) => toSavedRun(run)).filter(run => run !== null), total: totals?.total ?? 0, limit, offset };
  }

  async summary(userId: string) {
    const where = and(eq(userProject.userId, userId), isNotNull(testRuns.result));
    const [aggregate] = await this.db.select({
      totalRuns: count(), endpointCount: countDistinct(testRuns.url),
      completed: sql<number>`count(*) filter (where json_extract(${testRuns.result}, '$.stopReason') = 'duration_elapsed')`,
      requestsStarted: sql<number>`coalesce(sum(cast(json_extract(${testRuns.result}, '$.metrics.requestsStarted') as integer)), 0)`,
      requestsSucceeded: sql<number>`coalesce(sum(cast(json_extract(${testRuns.result}, '$.metrics.requestsSucceeded') as integer)), 0)`,
    }).from(testRuns).innerJoin(userProject, eq(testRuns.projectId, userProject.id)).where(where);
    const [latest] = await this.db.select({ run: testRuns }).from(testRuns).innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(where).orderBy(desc(testRuns.createdAt)).limit(1);
    const totalRuns = Number(aggregate?.totalRuns ?? 0), completed = Number(aggregate?.completed ?? 0);
    const requestsStarted = Number(aggregate?.requestsStarted ?? 0), requestsSucceeded = Number(aggregate?.requestsSucceeded ?? 0);
    return { totalRuns, endpointCount: Number(aggregate?.endpointCount ?? 0), completed, stoppedEarly: totalRuns - completed,
      requestsStarted, requestsSucceeded, successRate: requestsStarted ? requestsSucceeded / requestsStarted * 100 : null,
      latestRun: latest ? toSavedRun(latest.run) : null };
  }

  async get(userId: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw new AccountError("Invalid run ID.", 400);
    const [row] = await this.db.select({ run: testRuns }).from(testRuns).innerJoin(userProject, eq(testRuns.projectId, userProject.id))
      .where(and(eq(testRuns.id, id), eq(userProject.userId, userId)));
    if (!row) throw new AccountError("Test run not found.", 404);
    const run = toSavedRun(row.run);
    if (!run) throw new AccountError("Test run data is incomplete.", 422);
    return run;
  }
}
