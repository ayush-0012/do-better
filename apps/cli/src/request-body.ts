import type { EngineParams } from "./constants.ts";

/** Prepare reusable bytes once, so concurrent requests never share a consumed stream. */
export async function prepareRequestData(data: EngineParams["requestData"]) {
  const headers = new Headers(data?.headers);
  let body: string | Uint8Array<ArrayBuffer> | undefined;
  let mediaType: string | undefined;
  const encoded = data?.encodedBody;
  if (encoded?.type === "text") {
    body = encoded.text;
    mediaType = encoded.mediaType;
  } else if (encoded?.type === "urlencoded") {
    body = new URLSearchParams(encoded.fields.map(field => [field.name, field.value] as [string, string])).toString();
    mediaType = "application/x-www-form-urlencoded";
  } else if (encoded?.type === "binary") {
    body = new Uint8Array(Buffer.from(encoded.file.base64, "base64"));
    mediaType = encoded.file.mediaType || "application/octet-stream";
  } else if (encoded?.type === "multipart") {
    const form = new FormData();
    for (const field of encoded.fields) {
      if (field.file) {
        const bytes = new Uint8Array(Buffer.from(field.file.base64, "base64"));
        form.append(field.name, new Blob([bytes], { type: field.file.mediaType }), field.file.name);
      } else form.append(field.name, field.value);
    }
    const request = new Request("http://localhost", { method: "POST", body: form });
    // Bun materializes the multipart header lazily; read it before consuming the body.
    mediaType = request.headers.get("content-type")!;
    body = new Uint8Array(await request.arrayBuffer());
  } else if (data?.body !== undefined) {
    body = JSON.stringify(data.body);
    mediaType = "application/json";
  }
  if (mediaType && !headers.has("content-type")) headers.set("content-type", mediaType);
  return { headers, body };
}
