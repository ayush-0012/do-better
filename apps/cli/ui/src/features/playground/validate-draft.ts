import type { RequestDraft } from "@/features/playground/draft-provider";

export function validateDraft(draft: RequestDraft): string | null {
  try {
    const url = new URL(draft.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "Use an absolute HTTP(S) URL without embedded credentials.";
  } catch { return "Enter a valid absolute HTTP(S) target URL."; }
  if (draft.body.trim()) {
    try { JSON.parse(draft.body); } catch { return "The request body must be valid JSON. Your input has been preserved."; }
  }
  if (!Number.isFinite(draft.rate) || draft.rate <= 0) return "Request rate must be a positive, finite number.";
  if (!Number.isFinite(draft.durationSeconds) || draft.durationSeconds <= 0) return "Duration must be a positive, finite number of seconds.";
  if (!Number.isInteger(draft.concurrency) || draft.concurrency <= 0) return "Concurrency must be a positive integer.";
  const names = new Set<string>();
  for (const header of draft.headers) {
    if (!header.name.trim() && !header.value) continue;
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.name)) return "Header names must be valid HTTP tokens without whitespace.";
    if (/[\r\n\0]/.test(header.value)) return "Header values cannot contain newlines or null characters.";
    const name = header.name.toLowerCase();
    if (names.has(name)) return `Remove the duplicate ${header.name} header.`;
    names.add(name);
  }
  return null;
}
