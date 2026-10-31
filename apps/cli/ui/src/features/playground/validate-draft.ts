import type { RequestDraft } from "@/features/playground/draft-provider";

export type DraftField = "url" | "body" | "rate" | "durationSeconds" | "concurrency" | "headers";
export type DraftErrors = Partial<Record<DraftField, string>>;

export function getDraftErrors(draft: RequestDraft): DraftErrors {
  const errors: DraftErrors = {};
  try {
    const url = new URL(draft.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) errors.url = "Use an absolute HTTP(S) URL without embedded credentials.";
  } catch { errors.url = "Enter a valid absolute HTTP(S) target URL."; }
  if (draft.body.trim()) {
    try { JSON.parse(draft.body); } catch { errors.body = "The request body must be valid JSON. Your input has been preserved."; }
  }
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
