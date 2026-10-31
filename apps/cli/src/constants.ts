import { z } from "zod";

// it will be converted into seconds later on (incoming time types)
export enum RequestRateUnit {
  PerSecond = "per_second",
  PerMinute = "per_minute",
}

export enum RequestPattern {
  Constant = "constant",
  Ramp = "ramp",
  Burst = "burst",
  Randomized = "randomized",
}

// defining burst pattern (can be tweaked by user in future)
export const REQUEST_PATTERN_DEFAULTS = {
  initialRateRatio: 0.1,
  burstRateRatio: 0.9,
  burstAfterSeconds: 5,
  randomizedChangeSeconds: 1,
} as const; // ready only

export const ENGINE_TICK_MS = 10; // 10ms for engine req scheduling time

export type RequestRateFunction = (elapsedSeconds: number) => number;

export const engineParamsSchema = z.object({
  url: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Target must be an absolute HTTP(S) URL without embedded credentials"),
  requestData: z
    .object({
      headers: z.record(z.string(), z.string()).optional(),
      body: z.json().optional(),
    })
    .optional(),
  requestPattern: z.enum(RequestPattern),
  duration: z
    .object({
      minutes: z.number().nonnegative(),
      seconds: z.number().nonnegative(),
    })
    .refine(
      ({ minutes, seconds }) => {
        const totalSeconds = minutes * 60 + seconds;
        return Number.isFinite(totalSeconds) && totalSeconds > 0;
      },
      {
        message:
          "Duration must be a finite number of seconds greater than zero",
      },
    ),
  requestRate: z.number().positive(),
  requestRateUnit: z.enum(RequestRateUnit),
  concurrencyLimit: z.number().int().positive(),
});

export type EngineParams = z.infer<typeof engineParamsSchema>;

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const latency = z.number().nonnegative().nullable();

export const engineResultSchema = z.object({
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  elapsedSeconds: z.number().nonnegative(),
  stopReason: z.enum(["duration_elapsed", "http_500", "request_error"]),
  error: z.string().max(1000).nullable(),
  metrics: z.object({
    requestsStarted: count,
    requestsCompleted: count,
    requestsSucceeded: count,
    requestsFailed: count,
    requestsAborted: count,
    requestsSkipped: count,
    statusCounts: z.record(z.string().regex(/^[1-5]\d{2}$/), count),
    latencyMs: z.object({ min: latency, max: latency, average: latency }),
  }),
}).superRefine((result, context) => {
  const metrics = result.metrics;
  if (metrics.requestsStarted !== metrics.requestsSucceeded + metrics.requestsFailed + metrics.requestsAborted) {
    context.addIssue({ code: "custom", path: ["metrics"], message: "Every started request must have a final outcome" });
  }
  if (metrics.requestsCompleted > metrics.requestsStarted) {
    context.addIssue({ code: "custom", path: ["metrics", "requestsCompleted"], message: "Completed requests cannot exceed started requests" });
  }
  if (Date.parse(result.finishedAt) < Date.parse(result.startedAt)) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "A run cannot finish before it starts" });
  }
});

export type EngineResult = z.infer<typeof engineResultSchema>;

// Payloads and target authorization headers stay on the user's machine.
export const testRunUploadSchema = z.object({
  projectId: z.uuid(),
  params: engineParamsSchema.omit({ requestData: true }),
  result: engineResultSchema,
});
