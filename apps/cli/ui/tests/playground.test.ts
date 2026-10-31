import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { getDraftErrors, validateDraft } from "../src/features/playground/validate-draft";
import { JsonHighlights } from "../src/features/playground/json-highlights";
import { sampleRuns } from "../src/features/runs/sample-runs";
import { engineResultSchema } from "../../src/constants";
import type { RequestDraft } from "../src/features/playground/draft-provider";

const draft: RequestDraft = {
  url: "http://localhost:8080/orders", pattern: "constant", rate: 20, rateUnit: "per_second",
  durationSeconds: 30, concurrency: 10, body: '{"quantity":2}', headers: [],
};

describe("playground configuration boundary", () => {
  test("reports errors by field and clears them as input is corrected", () => {
    const invalid = { ...draft, url: "wrong", body: "{", rate: 0 };
    expect(Object.keys(getDraftErrors(invalid))).toEqual(["url", "body", "rate"]);
    expect(getDraftErrors({ ...invalid, url: draft.url })).not.toHaveProperty("url");
    expect(getDraftErrors({ ...invalid, url: draft.url, body: "{}", rate: 20 })).toEqual({});
  });
  test("accepts JSON primitives, objects, and an omitted body", () => {
    for (const body of ["", " ", "null", "true", "0", '"hello"', "[]", '{"quantity":2}']) {
      expect(validateDraft({ ...draft, body })).toBeNull();
    }
  });
  test("rejects malformed JSON without modifying the draft", () => {
    const invalid = { ...draft, body: '{"quantity":' };
    expect(validateDraft(invalid)).toContain("valid JSON");
    expect(invalid.body).toBe('{"quantity":');
  });
  test("rejects unsupported URLs and embedded credentials", () => {
    for (const url of ["not-a-url", "/relative", "file:///tmp/data", "ftp://example.com", "http://user:secret@localhost/"]) {
      expect(validateDraft({ ...draft, url })).not.toBeNull();
    }
  });
  test("rejects invalid rate, duration, and concurrency boundaries", () => {
    for (const changes of [{ rate: 0 }, { rate: Infinity }, { rate: NaN }, { durationSeconds: -1 },
      { durationSeconds: NaN }, { concurrency: 0 }, { concurrency: 1.5 }, { concurrency: Infinity }]) {
      expect(validateDraft({ ...draft, ...changes })).not.toBeNull();
    }
    expect(validateDraft({ ...draft, rate: 0.5, durationSeconds: 0.25, concurrency: 1 })).toBeNull();
  });
  test("checks header tokens, duplicate names, and unsafe values", () => {
    const header = { id: "1", name: "Authorization", value: "Bearer test-only" };
    expect(validateDraft({ ...draft, headers: [header] })).toBeNull();
    expect(validateDraft({ ...draft, headers: [header, { ...header, id: "2", name: "authorization" }] })).toContain("duplicate");
    expect(validateDraft({ ...draft, headers: [{ ...header, name: "Bad name" }] })).toContain("Header names");
    expect(validateDraft({ ...draft, headers: [{ ...header, value: "hello\r\nX-Injected: true" }] })).toContain("newlines");
  });
  test("syntax highlighting escapes HTML inside payloads", () => {
    const markup = renderToStaticMarkup(createElement(JsonHighlights, { value: '{"message":"<img src=x onerror=alert(1)>"}' }));
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;img");
  });
});

describe("sample reports", () => {
  test("match the engine result schema and maintain coherent metrics", () => {
    for (const { result } of sampleRuns) {
      expect(engineResultSchema.safeParse(result).success).toBe(true);
      expect(result.metrics.latencyMs.min!).toBeLessThanOrEqual(result.metrics.latencyMs.average!);
      expect(result.metrics.latencyMs.average!).toBeLessThanOrEqual(result.metrics.latencyMs.max!);
      expect(Object.values(result.metrics.statusCounts).reduce((total, count) => total + count, 0)).toBe(result.metrics.requestsCompleted);
    }
  });
});
