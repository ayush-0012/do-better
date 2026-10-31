import { afterEach, describe, expect, spyOn, test } from "bun:test";

import {
  engineResultSchema,
  RequestPattern,
  RequestRateUnit,
  type EngineParams,
} from "../src/constants";
import { runEngine } from "../src/engine";

const params: EngineParams = {
  url: "http://localhost:9876/target",
  requestPattern: RequestPattern.Constant,
  requestRate: 200,
  requestRateUnit: RequestRateUnit.PerSecond,
  concurrencyLimit: 4,
  duration: { minutes: 0, seconds: 0.12 },
};

let restoreFetch = () => {};

function mockFetch(handler: (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>) {
  const mocked = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(handler, { preconnect: globalThis.fetch.preconnect }),
  );
  restoreFetch = () => mocked.mockRestore();
  return mocked;
}

afterEach(() => restoreFetch());

describe("local engine metrics", () => {
  test("sends POST payloads and headers but returns no response body", async () => {
    let calls = 0;
    mockFetch(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe('{"message":"hello"}');
      const headers = new Headers(init?.headers);
      expect(headers.get("x-target-key")).toBe("target-only");
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.has("cookie")).toBe(false);
      calls++;
      return Response.json({ privateResponse: "must-not-be-returned" });
    });
    const result = await runEngine({
      ...params,
      requestData: { headers: { "X-Target-Key": "target-only" }, body: { message: "hello" } },
    });
    expect(engineResultSchema.safeParse(result).success).toBe(true);
    expect(calls).toBeGreaterThan(0);
    expect(result.metrics.requestsStarted).toBe(calls);
    expect(result.metrics.requestsSucceeded).toBe(calls);
    expect(result.metrics.requestsCompleted).toBe(calls);
    expect(result.metrics.statusCounts[200]).toBe(calls);
    expect(result.metrics.latencyMs.average).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("must-not-be-returned");
    expect(result).not.toHaveProperty("sampleResponse");
    expect(result).not.toHaveProperty("requestData");
  });

  for (const requestPattern of Object.values(RequestPattern)) {
    test(`collects ${requestPattern} results with per-minute rates`, async () => {
      mockFetch(async () => new Response("discarded"));
      const result = await runEngine({
        ...params,
        requestPattern,
        requestRate: 60000,
        requestRateUnit: RequestRateUnit.PerMinute,
      });
      expect(result.metrics.requestsStarted).toBeGreaterThan(0);
      expect(result.metrics.requestsFailed).toBe(0);
      expect(engineResultSchema.safeParse(result).success).toBe(true);
    });
  }

  test("enforces concurrency and accounts for skipped and aborted requests", async () => {
    let active = 0;
    let peak = 0;
    mockFetch((_input, init) => new Promise((_resolve, reject) => {
      active++;
      peak = Math.max(peak, active);
      const onAbort = () => {
        active--;
        reject(new DOMException("Run stopped", "AbortError"));
      };
      init?.signal?.addEventListener("abort", onAbort, { once: true });
    }));
    const result = await runEngine({ ...params, requestRate: 1000, concurrencyLimit: 2 });
    expect(peak).toBeLessThanOrEqual(2);
    expect(active).toBe(0);
    expect(result.metrics.requestsSkipped).toBeGreaterThan(0);
    expect(result.metrics.requestsAborted).toBeGreaterThan(0);
    expect(engineResultSchema.safeParse(result).success).toBe(true);
  });

  test("returns partial metrics on network failure", async () => {
    mockFetch(async () => { throw new Error("Connection refused"); });
    const result = await runEngine(params);
    expect(result.stopReason).toBe("request_error");
    expect(result.error).toBe("Connection refused");
    expect(result.metrics.requestsFailed).toBeGreaterThan(0);
    expect(engineResultSchema.safeParse(result).success).toBe(true);
  });

  test("stops on HTTP 500 and counts the triggering request as failed", async () => {
    mockFetch(async () => new Response("discarded", { status: 500 }));
    const result = await runEngine(params);
    expect(result.stopReason).toBe("http_500");
    expect(result.metrics.statusCounts[500]).toBeGreaterThan(0);
    expect(result.metrics.requestsFailed).toBeGreaterThan(0);
    expect(engineResultSchema.safeParse(result).success).toBe(true);
  });

  test("counts other HTTP errors without treating them as network failures", async () => {
    mockFetch(async () => new Response("discarded", { status: 503 }));
    const result = await runEngine(params);
    expect(result.stopReason).toBe("duration_elapsed");
    expect(result.error).toBeNull();
    expect(result.metrics.requestsFailed).toBeGreaterThan(0);
    expect(result.metrics.requestsSucceeded).toBe(0);
    expect(result.metrics.requestsCompleted).toBe(result.metrics.requestsFailed);
  });

  test("holds a concurrency slot until a streaming response finishes or is aborted", async () => {
    mockFetch(async (_input, init) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("discarded"));
        init?.signal?.addEventListener("abort", () => {
          controller.error(new DOMException("Run stopped", "AbortError"));
        }, { once: true });
      },
    })));
    const result = await runEngine({ ...params, concurrencyLimit: 1 });
    expect(result.metrics.requestsStarted).toBe(1);
    expect(result.metrics.requestsCompleted).toBe(0);
    expect(result.metrics.requestsAborted).toBe(1);
    expect(result.metrics.latencyMs.average).toBeNull();
    expect(engineResultSchema.safeParse(result).success).toBe(true);
  });

  test("returns an empty summary when no whole request is due", async () => {
    const mocked = mockFetch(async () => new Response("unused"));
    const result = await runEngine({ ...params, requestRate: 0.001 });
    expect(mocked).not.toHaveBeenCalled();
    expect(result.metrics.requestsStarted).toBe(0);
    expect(engineResultSchema.safeParse(result).success).toBe(true);
  });

  test("rejects invalid target URLs before making requests", async () => {
    const mocked = mockFetch(async () => new Response("unused"));
    for (const url of ["not a URL", "file:///etc/passwd", "http://user:password@localhost/"]) {
      await expect(runEngine({ ...params, url })).rejects.toThrow();
    }
    expect(mocked).not.toHaveBeenCalled();
  });
});
