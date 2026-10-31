import { useState } from "react";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HeaderEntry } from "@/features/playground/draft-provider";

export function HeaderEditor({ headers, onChange, error }: { headers: HeaderEntry[]; onChange: (headers: HeaderEntry[]) => void; error?: string }) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  function update(id: string, changes: Partial<HeaderEntry>) {
    onChange(headers.map((header) => header.id === id ? { ...header, ...changes } : header));
  }
  return <div id="header-editor" className="header-editor" tabIndex={-1} role="group" aria-label="Request headers" aria-invalid={Boolean(error) || undefined} aria-describedby={error ? "headers-error" : undefined}><div className="header-editor-labels"><span>Header</span><span>Value</span></div>
    {headers.length === 0 && <p className="subtle">No custom headers. Add one below.</p>}
    {headers.map((header, index) => {
      const sensitive = /authorization|cookie|token|secret|key/i.test(header.name);
      return <div className="header-entry" key={header.id}>
        <input aria-label={`Header ${index + 1} name`} placeholder="Content-Type" value={header.name} onChange={(event) => update(header.id, { name: event.target.value })} />
        <div className="header-value"><input aria-label={`Header ${index + 1} value`} type={sensitive && !revealed.has(header.id) ? "password" : "text"}
          autoComplete="off" value={header.value} placeholder="Value" onChange={(event) => update(header.id, { value: event.target.value })} />
          {sensitive && <Button type="button" variant="ghost" size="icon" aria-label={`${revealed.has(header.id) ? "Hide" : "Reveal"} header ${index + 1} value`}
            onClick={() => setRevealed((current) => { const next = new Set(current); if (next.has(header.id)) next.delete(header.id); else next.add(header.id); return next; })}>
            {revealed.has(header.id) ? <EyeOff /> : <Eye />}</Button>}</div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove header ${index + 1}`} onClick={() => onChange(headers.filter((entry) => entry.id !== header.id))}><X /></Button>
      </div>;
    })}
    <Button variant="outline" size="sm" type="button" onClick={() => onChange([...headers, { id: crypto.randomUUID(), name: "", value: "" }])}><Plus />Add header</Button>
  </div>;
}
