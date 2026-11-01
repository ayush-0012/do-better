import type { RequestDraft } from "@/features/playground/draft-provider";
import type { EngineParams } from "@/lib/run-types";

export function draftToEngineParams(draft: RequestDraft): EngineParams {
  const minutes = Math.floor(draft.durationSeconds / 60);
  const seconds = draft.durationSeconds - minutes * 60;

  const headers = draft.headers
    .filter((header) => header.name.trim())
    .map((header) => [header.name, header.value] as const);
  const requestData: NonNullable<EngineParams["requestData"]> = {};
  if (headers.length > 0) requestData.headers = Object.fromEntries(headers);
  if (draft.body.trim()) requestData.body = JSON.parse(draft.body);

  return {
    url: draft.url,
    // The UI stores the enum values as string literals for serialization.
    requestPattern: draft.pattern as EngineParams["requestPattern"],
    requestRate: draft.rate,
    requestRateUnit: draft.rateUnit as EngineParams["requestRateUnit"],
    duration: { minutes, seconds },
    concurrencyLimit: draft.concurrency,
    requestData: Object.keys(requestData).length > 0 ? requestData : undefined,
  };
}
