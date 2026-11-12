import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormEntry, HeaderEntry } from "./draft-provider";

export function FieldEditor({ entries, onChange, multipart = false, label }: {
  entries: FormEntry[]; onChange: (entries: FormEntry[]) => void; multipart?: boolean; label: string;
}) {
  function update(id: string, changes: Partial<FormEntry>) {
    onChange(entries.map(entry => entry.id === id ? { ...entry, ...changes } : entry));
  }
  return <div className="field-editor" role="group" aria-label={label}>
    {entries.length === 0 && <p className="subtle">No fields yet. Add a field below.</p>}
    {entries.map((entry, index) => <div className={`form-entry${multipart ? " multipart-entry" : ""}`} key={entry.id}>
      <input aria-label={`${label} ${index + 1} name`} placeholder="Name" value={entry.name} onChange={event => update(entry.id, { name: event.target.value })} />
      {multipart && <select aria-label={`Field ${index + 1} type`} value={entry.kind} onChange={event => update(entry.id, { kind: event.target.value as FormEntry["kind"], file: undefined, value: "" })}><option value="text">Text</option><option value="file">File</option></select>}
      {multipart && entry.kind === "file"
        ? <div className="file-field"><input type="file" aria-label={`Field ${index + 1} file`} onChange={event => update(entry.id, { file: event.target.files?.[0] })} />{entry.file && <span className="help-text">{entry.file.name} · {entry.file.size.toLocaleString()} bytes</span>}</div>
        : <input aria-label={`${label} ${index + 1} value`} placeholder="Value" value={entry.value} onChange={event => update(entry.id, { value: event.target.value })} />}
      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => onChange(entries.filter(field => field.id !== entry.id))}><X /></Button>
    </div>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange([...entries, { id: crypto.randomUUID(), name: "", value: "", kind: "text" }])}><Plus />Add field</Button>
    <p className="help-text">Repeated names are supported. Values are encoded automatically.</p>
  </div>;
}

export function QueryEditor({ url, entries, onChange }: {
  url: string; entries: HeaderEntry[]; onChange: (url: string, entries: HeaderEntry[]) => void;
}) {
  let valid = true;
  try { new URL(url); } catch { valid = false; }
  return <div>
    <p className="query-help help-text">Query parameters stay in sync with the target URL. They are included in saved run URLs.</p>
    {valid ? <FieldEditor label="Query parameter" entries={entries.map(entry => ({ ...entry, kind: "text" }))} onChange={fields => {
      const target = new URL(url);
      target.search = new URLSearchParams(fields.filter(field => field.name || field.value).map(field => [field.name, field.value])).toString();
      onChange(target.toString(), fields);
    }} /> : <p className="field-editor subtle">Enter a valid target URL to edit query parameters.</p>}
  </div>;
}
