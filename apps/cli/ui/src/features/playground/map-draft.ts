import type { RequestDraft } from "@/features/playground/draft-provider";
import type { EngineParams } from "@/lib/run-types";
import { MAX_REQUEST_FILE_BYTES, MAX_RUN_PAYLOAD_BYTES } from "@/lib/run-types";

async function encodeFile(file: File) {
  if (file.size > MAX_REQUEST_FILE_BYTES) throw new Error("Selected files must total at most 512 KiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { name: file.name, mediaType: file.type, base64: btoa(binary) };
}

export async function draftToEngineParams(draft: RequestDraft): Promise<EngineParams> {
  const minutes = Math.floor(draft.durationSeconds / 60);
  const seconds = draft.durationSeconds - minutes * 60;

  const headers = draft.headers
    .filter((header) => header.name.trim())
    .map((header) => [header.name, header.value] as const);
  const requestData: NonNullable<EngineParams["requestData"]> = {};
  if (headers.length > 0) requestData.headers = Object.fromEntries(headers);
  if (draft.bodyType === "json" && draft.body.trim()) requestData.body = JSON.parse(draft.body);
  if (draft.bodyType === "text" || draft.bodyType === "xml") {
    requestData.encodedBody = { type: "text", text: draft.body, mediaType: draft.bodyType === "xml" ? "application/xml" : "text/plain" };
  }
  const fields = draft.formFields.filter(field => field.name || field.value || (field.kind === "file" && field.file));
  if (draft.bodyType === "urlencoded") requestData.encodedBody = { type: "urlencoded", fields: fields.map(({ name, value }) => ({ name, value })) };
  if (draft.bodyType === "multipart") requestData.encodedBody = {
    type: "multipart", fields: await Promise.all(fields.map(async field => ({
      name: field.name, value: field.kind === "text" ? field.value : "",
      ...(field.kind === "file" && field.file ? { file: await encodeFile(field.file) } : {}),
    }))),
  };
  if (draft.bodyType === "binary") {
    if (!draft.binaryFile) throw new Error("Choose a file for the binary body.");
    requestData.encodedBody = { type: "binary", file: await encodeFile(draft.binaryFile) };
  }

  const params: EngineParams = {
    url: draft.url,
    // The UI stores the enum values as string literals for serialization.
    requestPattern: draft.pattern as EngineParams["requestPattern"],
    requestRate: draft.rate,
    requestRateUnit: draft.rateUnit as EngineParams["requestRateUnit"],
    duration: { minutes, seconds },
    concurrencyLimit: draft.concurrency,
    requestData: Object.keys(requestData).length > 0 ? requestData : undefined,
  };
  if (new TextEncoder().encode(JSON.stringify(params)).length > MAX_RUN_PAYLOAD_BYTES) throw new Error("The request configuration exceeds the 1 MiB local API limit. Use smaller files or fields.");
  return params;
}
