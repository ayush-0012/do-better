import type { EngineParams, EngineResult, RequestRateFunction } from "../constants";
import {
  ENGINE_TICK_MS,
  REQUEST_PATTERN_DEFAULTS,
  RequestRateUnit,
  engineParamsSchema,
} from "../constants";

// preparing the params for passing in the api calls
export function prepareEngineParams(input: EngineParams) {
  const params = engineParamsSchema.parse(input);

  return {
    ...params,
    duration: params.duration.minutes * 60 + params.duration.seconds,
    requestRate:
      params.requestRateUnit === RequestRateUnit.PerMinute
        ? params.requestRate / 60
        : params.requestRate,
    requestRateUnit: RequestRateUnit.PerSecond,
    requestData:
      params.requestData === undefined
        ? undefined
        : {
            headers: params.requestData.headers,
            body:
              params.requestData.body === undefined
                ? undefined
                : JSON.stringify(params.requestData.body),
          },
  };
}

// helper for calculating request rates based on their request patterns
export function getRampRequestRate(
  requestRate: number,
  duration: number,
  elapsedSeconds: number,
): number {
  const progress = Math.min(elapsedSeconds / duration, 1);
  const { initialRateRatio } = REQUEST_PATTERN_DEFAULTS;

  return requestRate * (initialRateRatio + (1 - initialRateRatio) * progress);
}

export function getBurstRequestRate(
  requestRate: number,
  elapsedSeconds: number,
): number {
  const { initialRateRatio, burstRateRatio, burstAfterSeconds } =
    REQUEST_PATTERN_DEFAULTS;

  return (
    requestRate *
    (elapsedSeconds < burstAfterSeconds ? initialRateRatio : burstRateRatio)
  );
}

export function createRandomizedRequestRate(
  requestRate: number,
): RequestRateFunction {
  let previousPeriod = -1;
  let currentRate = 0;

  return (elapsedSeconds) => {
    const { initialRateRatio, randomizedChangeSeconds } =
      REQUEST_PATTERN_DEFAULTS;
    const period = Math.floor(elapsedSeconds / randomizedChangeSeconds);

    if (period !== previousPeriod) {
      currentRate =
        requestRate *
        (initialRateRatio + Math.random() * (1 - initialRateRatio));
      previousPeriod = period;
    }

    return currentRate;
  };
}

export async function makeApiCalls(
  params: ReturnType<typeof prepareEngineParams>,
  getRequestRate: RequestRateFunction,
): Promise<EngineResult> {
  const headers = new Headers(params.requestData?.headers);
  const body = params.requestData?.body;

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const activeRequests = new Set<Promise<void>>();
  const startedAt = performance.now();
  const startedAtDate = new Date().toISOString();
  const metrics: EngineResult["metrics"] = {
    requestsStarted: 0,
    requestsCompleted: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    requestsAborted: 0,
    requestsSkipped: 0,
    statusCounts: {},
    latencyMs: { min: null, max: null, average: null },
  };
  let stopReason: EngineResult["stopReason"] = "duration_elapsed";
  let errorMessage: string | null = null;
  let latencyTotal = 0;
  let latencyCount = 0;
  let previousElapsed = 0;
  let requestBudget = 0;
  let stopped = false;

  const recordLatency = (requestStartedAt: number) => {
    const elapsed = performance.now() - requestStartedAt;
    latencyTotal += elapsed;
    latencyCount++;
    metrics.latencyMs.min = Math.min(metrics.latencyMs.min ?? elapsed, elapsed);
    metrics.latencyMs.max = Math.max(metrics.latencyMs.max ?? elapsed, elapsed);
    metrics.latencyMs.average = latencyTotal / latencyCount;
  };

  try {
    await new Promise<void>((resolve) => {
      const stop = (reason: EngineResult["stopReason"], error?: unknown) => {
        if (stopped) return;
        stopped = true;
        stopReason = reason;
        if (error !== undefined) {
          errorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
        }
        clearInterval(interval);
        clearTimeout(timeout);
        controller.abort();
        resolve();
      };

      const interval = setInterval(() => {
        const elapsedSeconds = (performance.now() - startedAt) / 1000;

        if (elapsedSeconds >= params.duration) {
          stop("duration_elapsed");
          return;
        }

        const sampleTime = (previousElapsed + elapsedSeconds) / 2;
        requestBudget +=
          getRequestRate(sampleTime) * (elapsedSeconds - previousElapsed);
        previousElapsed = elapsedSeconds;

        const requestsToStart = Math.floor(requestBudget);
        requestBudget -= requestsToStart;
        const availableSlots = Math.max(0, params.concurrencyLimit - activeRequests.size);
        const count = Math.min(requestsToStart, availableSlots);
        metrics.requestsSkipped += requestsToStart - count;

        for (let i = 0; i < count && !stopped; i++) {
          metrics.requestsStarted++;
          const requestStartedAt = performance.now();
          let status: number | undefined;
          const request = fetch(params.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })
            .then(async (response) => {
              status = response.status;
              metrics.statusCounts[status] = (metrics.statusCounts[status] ?? 0) + 1;
              if (response.status === 500) {
                stop("http_500");
              }

              // Drain without retaining the body; a slot stays occupied until the response finishes.
              await response.body?.pipeTo(new WritableStream());
              metrics.requestsCompleted++;
              if (response.ok) metrics.requestsSucceeded++;
              else metrics.requestsFailed++;
              recordLatency(requestStartedAt);
            })
            .catch((error: unknown) => {
              if (status !== 500 && controller.signal.aborted) {
                metrics.requestsAborted++;
              } else {
                metrics.requestsFailed++;
                recordLatency(requestStartedAt);
                if (!stopped) stop("request_error", error);
              }
            })
            .finally(() => {
              activeRequests.delete(request);
            });

          activeRequests.add(request);
        }
      }, ENGINE_TICK_MS);

      const timeout = setTimeout(() => stop("duration_elapsed"), params.duration * 1000);
    });
  } finally {
    controller.abort();
    await Promise.allSettled(activeRequests);
  }

  return {
    id: crypto.randomUUID(),
    startedAt: startedAtDate,
    finishedAt: new Date().toISOString(),
    elapsedSeconds: (performance.now() - startedAt) / 1000,
    stopReason,
    error: errorMessage,
    metrics,
  };
}
