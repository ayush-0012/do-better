import type { BodyType, RequestDraft } from "./draft-provider";
import { CodeEditor } from "./code-editor";
import { FieldEditor } from "./field-editor";

export function BodyEditor({ draft, onChange, error }: {
  draft: RequestDraft; onChange: (changes: Partial<RequestDraft>) => void; error?: string;
}) {
  return <div className="body-editor" id="request-body" tabIndex={-1} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? "body-error" : undefined}>
    <div className="body-type-bar"><label htmlFor="body-type">Body type</label><select id="body-type" value={draft.bodyType} onChange={event => onChange({ bodyType: event.target.value as BodyType })}>
      <option value="none">None</option><option value="json">JSON</option><option value="text">Text</option><option value="xml">XML</option><option value="urlencoded">URL-encoded form</option><option value="multipart">Multipart form</option><option value="binary">Binary file</option>
    </select></div>
    {draft.bodyType === "none" && <p className="empty-body subtle">This request will be sent without a body.</p>}
    {(["json", "text", "xml"] as BodyType[]).includes(draft.bodyType) && <CodeEditor key={draft.bodyType} id="body-content" value={draft.body} onChange={body => onChange({ body })} label={`${draft.bodyType.toUpperCase()} request body`} highlightJson={draft.bodyType === "json"} invalid={Boolean(error)} describedBy={error ? "body-error" : undefined} />}
    {(draft.bodyType === "urlencoded" || draft.bodyType === "multipart") && <FieldEditor label="Form field" entries={draft.formFields} multipart={draft.bodyType === "multipart"} onChange={formFields => onChange({ formFields })} />}
    {draft.bodyType === "binary" && <div className="binary-editor"><label htmlFor="binary-file">File to send as the entire request body</label><input id="binary-file" type="file" onChange={event => onChange({ binaryFile: event.target.files?.[0] ?? null })} />{draft.binaryFile && <p>{draft.binaryFile.name} · {draft.binaryFile.size.toLocaleString()} bytes</p>}</div>}
    <p className="body-help help-text">{draft.bodyType === "multipart" ? "Content-Type and its boundary are generated automatically. " : "Content-Type is set automatically unless you supply a custom header. "}{(draft.bodyType === "multipart" || draft.bodyType === "binary") && "Selected files must total at most 512 KiB. Files stay in memory and are reused for every request."}</p>
  </div>;
}
