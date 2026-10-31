import type { EngineParams, EngineResult } from "../../../src/constants";

export type RequestPattern = `${EngineParams["requestPattern"]}`;
export type RateUnit = `${EngineParams["requestRateUnit"]}`;

export interface RunConfiguration {
  url: string;
  pattern: RequestPattern;
  rate: number;
  rateUnit: RateUnit;
  durationSeconds: number;
  concurrency: number;
}

export interface RunRecord {
  configuration: RunConfiguration;
  result: EngineResult;
}

export const patternLabels: Record<RequestPattern, string> = {
  constant: "Constant", ramp: "Ramp", burst: "Burst", randomized: "Random",
};

export const stopReasonLabels: Record<EngineResult["stopReason"], string> = {
  duration_elapsed: "Duration elapsed", http_500: "HTTP 500 stop", request_error: "Network error",
};

export function requestsPerSecond(configuration: RunConfiguration) {
  return configuration.rateUnit === "per_minute" ? configuration.rate / 60 : configuration.rate;
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function formatLatency(value: number | null) {
  return value === null ? "Unavailable" : `${formatNumber(value, 1)} ms`;
}
