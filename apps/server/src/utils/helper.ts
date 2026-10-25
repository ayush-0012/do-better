import type { EngineParams, RequestRateFunction } from "../constants";
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
): Promise<void> {
  const headers = new Headers(params.requestData?.headers);
  const body = params.requestData?.body;

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // for controlling the api calls
  const controller = new AbortController();
  const activeRequests = new Set<Promise<void>>(); // putting active requests in a set (set avoids redundancy)
  const startedAt = performance.now();
  let previousElapsed = 0;
  let requestBudget = 0; // how many requests will be made
  let stopped = false;

  try {
    await new Promise<void>((resolve, reject) => {
      const stop = (error?: unknown) => {
        if (stopped) return;
        stopped = true;
        clearInterval(interval);
        clearTimeout(timeout);
        controller.abort();

        if (error === undefined) resolve();
        else reject(error);
      };

      const interval = setInterval(() => {
        const elapsedSeconds = (performance.now() - startedAt) / 1000;

        if (elapsedSeconds >= params.duration) {
          stop();
          return;
        }

        const sampleTime = (previousElapsed + elapsedSeconds) / 2;
        requestBudget +=
          getRequestRate(sampleTime) * (elapsedSeconds - previousElapsed);
        previousElapsed = elapsedSeconds;

        const requestsToStart = Math.floor(requestBudget);
        requestBudget -= requestsToStart;

        for (
          let i = 0;
          i < requestsToStart && activeRequests.size < params.concurrencyLimit;
          i++
        ) {
          const request = fetch(params.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })
            .then(async (response) => {
              if (response.status === 500) {
                stop();
                return;
              }

              await response.body?.pipeTo(new WritableStream()); // whats the need for this
            })
            .catch((error: unknown) => {
              if (!stopped) stop(error);
            })
            .finally(() => {
              activeRequests.delete(request); // emptying the set at the end
            });

          activeRequests.add(request);
        }
      }, ENGINE_TICK_MS);

      const timeout = setTimeout(() => stop(), params.duration * 1000);
    });
  } finally {
    controller.abort();
    await Promise.allSettled(activeRequests);
  }
}
