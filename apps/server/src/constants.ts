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
  url: z.string(),
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
