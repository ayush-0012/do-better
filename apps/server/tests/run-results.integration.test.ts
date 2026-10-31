import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  RequestPattern,
  RequestRateUnit,
  type EngineResult,
} from "../src/constants";
import { startTestApi, type TestApi } from "./support/api";

let api: TestApi;
let owner: Awaited<ReturnType<TestApi["signup"]>>;
let other: Awaited<ReturnType<TestApi["signup"]>>;

beforeAll(async () => {
  api = await startTestApi();
  owner = await api.signup();
  other = await api.signup();
});
afterAll(async () => { if (api) await api.close(); });

function result(): EngineResult {
  return {
    id: crypto.randomUUID(),
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:10.000Z",
    elapsedSeconds: 10,
    stopReason: "duration_elapsed",
    error: null,
    metrics: {
      requestsStarted: 4,
      requestsCompleted: 3,
      requestsSucceeded: 2,
      requestsFailed: 1,
      requestsAborted: 1,
      requestsSkipped: 1,
      statusCounts: { "200": 2, "503": 1 },
      latencyMs: { min: 2, max: 10, average: 6 },
    },
  };
}

async function uploadBody() {
  const response = await owner.client.post("/api/projects", { userId: other.user.id });
  expect(response.status).toBe(201);
  const { project } = await response.json() as { project: { id: string; userId: string } };
  expect(project.userId).toBe(owner.user.id);
  return {
    projectId: project.id,
    params: {
      // The master API must not contact even an unreachable local target.
      url: "http://127.0.0.1:1/private-api",
      requestPattern: RequestPattern.Constant,
      requestRate: 30,
      requestRateUnit: RequestRateUnit.PerMinute,
      concurrencyLimit: 2,
      duration: { minutes: 0, seconds: 10 },
    },
    result: result(),
  };
}

describe("master result storage", () => {
  test("requires authentication before project creation, upload, and retrieval", async () => {
    const client = new api.Client();
    expect((await client.post("/api/projects")).status).toBe(401);
    expect((await client.post("/api/test-runs")).status).toBe(401);
    expect((await client.request(`/api/test-runs/${crypto.randomUUID()}`)).status).toBe(401);
  });

  test("stores metrics, preserves fractional rates, and returns the persisted run", async () => {
    const body = await uploadBody();
    const response = await owner.client.post("/api/test-runs", body);
    expect(response.status).toBe(201);
    const { run } = await response.json() as { run: Record<string, unknown> };
    expect(run).toMatchObject({
      id: body.result.id,
      projectId: body.projectId,
      requestRate: 0.5,
      duration: 10,
      reqHandled: 3,
      maxRequests: null,
      result: body.result,
    });
    const restored = await owner.client.request(`/api/test-runs/${body.result.id}`);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ run });
    const stored = await api.db.$client.query<{ result: EngineResult }>(
      'SELECT result FROM "test_runs" WHERE id = $1', [body.result.id],
    );
    expect(stored.rows[0]!.result).toEqual(body.result);
  });

  test("does not persist payloads, target authorization headers, or response bodies", async () => {
    const body = await uploadBody();
    const response = await owner.client.post("/api/test-runs", {
      ...body,
      params: {
        ...body.params,
        requestData: {
          headers: { Authorization: "target-authorization-not-for-master" },
          body: { privatePayload: "payload-not-for-master" },
        },
      },
      result: {
        ...body.result,
        sampleResponse: { body: "response-not-for-master" },
      },
    });
    expect(response.status).toBe(201);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("target-authorization-not-for-master");
    expect(serialized).not.toContain("payload-not-for-master");
    expect(serialized).not.toContain("response-not-for-master");
    const stored = await api.db.$client.query<{ result: EngineResult }>(
      'SELECT result FROM "test_runs" WHERE id = $1', [body.result.id],
    );
    expect(stored.rows[0]!.result).toEqual(body.result);
  });

  test("prevents another user from uploading to a project or reading its runs", async () => {
    const body = await uploadBody();
    expect((await other.client.post("/api/test-runs", body)).status).toBe(404);
    expect((await owner.client.post("/api/test-runs", body)).status).toBe(201);
    expect((await other.client.request(`/api/test-runs/${body.result.id}`)).status).toBe(404);
    expect((await owner.client.request(`/api/test-runs/${crypto.randomUUID()}`)).status).toBe(404);
  });

  test("validates IDs, target URLs, and metric accounting before saving", async () => {
    const body = await uploadBody();
    expect((await owner.client.post("/api/test-runs", {})).status).toBe(400);
    expect((await owner.client.post("/api/test-runs", { ...body, projectId: "bad-id" })).status).toBe(400);
    expect((await owner.client.post("/api/test-runs", {
      ...body, params: { ...body.params, url: "file:///tmp/target" },
    })).status).toBe(400);
    expect((await owner.client.post("/api/test-runs", {
      ...body,
      result: { ...body.result, metrics: { ...body.result.metrics, requestsFailed: 99 } },
    })).status).toBe(400);
    expect((await owner.client.request("/api/test-runs/bad-id")).status).toBe(400);
    const stored = await api.db.$client.query('SELECT id FROM "test_runs" WHERE id = $1', [body.result.id]);
    expect(stored.rowCount).toBe(0);
  });

  test("handles concurrent upload retries without duplicate records", async () => {
    const body = await uploadBody();
    const responses = await Promise.all([
      owner.client.post("/api/test-runs", body),
      owner.client.post("/api/test-runs", body),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const stored = await api.db.$client.query('SELECT id FROM "test_runs" WHERE id = $1', [body.result.id]);
    expect(stored.rowCount).toBe(1);
    const conflict = await owner.client.post("/api/test-runs", {
      ...body, result: { ...body.result, elapsedSeconds: 11 },
    });
    expect(conflict.status).toBe(409);
  });

  test("does not report success on a failed write and allows a later retry", async () => {
    const body = await uploadBody();
    // This constraint affects only this generated run ID in the isolated test database.
    await api.db.$client.query(
      `ALTER TABLE "test_runs" ADD CONSTRAINT test_write_failure CHECK (id <> '${body.result.id}')`,
    );
    try {
      expect((await owner.client.post("/api/test-runs", body)).status).toBe(500);
      const stored = await api.db.$client.query('SELECT id FROM "test_runs" WHERE id = $1', [body.result.id]);
      expect(stored.rowCount).toBe(0);
    } finally {
      await api.db.$client.query('ALTER TABLE "test_runs" DROP CONSTRAINT test_write_failure');
    }
    expect((await owner.client.post("/api/test-runs", body)).status).toBe(201);
  });
});
