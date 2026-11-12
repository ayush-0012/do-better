import type { RequestDraft } from "@/features/playground/draft-provider";
import { MAX_REQUEST_FILE_BYTES } from "@/lib/run-types";

export type DraftField = "url" | "body" | "rate" | "durationSeconds" | "concurrency" | "headers";
export type DraftErrors = Partial<Record<DraftField, string>>;

export function getDraftErrors(draft: RequestDraft): DraftErrors {
  const errors: DraftErrors = {};
  try {
    const url = new URL(draft.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) errors.url = "Use an absolute HTTP(S) URL without embedded credentials.";
  } catch { errors.url = "Enter a valid absolute HTTP(S) target URL."; }
  if (draft.bodyType === "json" && draft.body.trim()) {
    try { JSON.parse(draft.body); } catch { errors.body = "The request body must be valid JSON. Your input has been preserved."; }
  }
  if (draft.bodyType === "binary" && !draft.binaryFile) errors.body = "Choose a file for the binary body.";
  const files = draft.bodyType === "binary" ? [draft.binaryFile]
    : draft.bodyType === "multipart" ? draft.formFields.filter(field => field.kind === "file").map(field => field.file) : [];
  if (files.reduce((sum, file) => sum + (file?.size ?? 0), 0) > MAX_REQUEST_FILE_BYTES) errors.body = "Selected files must total at most 512 KiB.";
  if (draft.bodyType === "multipart" && draft.formFields.some(field => field.kind === "file" && !field.file)) errors.body = "Choose a file for each file field, or remove the unused row.";
  if (draft.bodyType === "multipart" && draft.headers.some(header => header.name.toLowerCase() === "content-type")) errors.headers = "Remove Content-Type for multipart. The runner generates the boundary automatically.";
  if (!Number.isFinite(draft.rate) || draft.rate <= 0) errors.rate = "Request rate must be a positive, finite number.";
  if (!Number.isFinite(draft.durationSeconds) || draft.durationSeconds <= 0) errors.durationSeconds = "Duration must be a positive, finite number of seconds.";
  if (!Number.isInteger(draft.concurrency) || draft.concurrency <= 0) errors.concurrency = "Concurrency must be a positive integer.";
  const names = new Set<string>();
  for (const header of draft.headers) {
    if (!header.name.trim() && !header.value) continue;
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.name)) { errors.headers = "Header names must be valid HTTP tokens without whitespace."; break; }
    if (/[\r\n\0]/.test(header.value)) { errors.headers = "Header values cannot contain newlines or null characters."; break; }
    const name = header.name.toLowerCase();
    if (names.has(name)) { errors.headers = `Remove the duplicate ${header.name} header.`; break; }
    names.add(name);
  }
  return errors;
}

export function validateDraft(draft: RequestDraft): string | null {
  return Object.values(getDraftErrors(draft))[0] ?? null;
}
