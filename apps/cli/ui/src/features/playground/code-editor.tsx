import { useId, useRef } from "react";
import { JsonHighlights } from "@/features/playground/json-highlights";

export function CodeEditor({ value, onChange, readOnly = false, label = "JSON request body", id: inputId, invalid, describedBy, highlightJson = true }: {
  value: string; onChange?: (value: string) => void; readOnly?: boolean; label?: string;
  id?: string; invalid?: boolean; describedBy?: string;
  highlightJson?: boolean;
}) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  return <div className="code-editor"><div className="line-numbers" aria-hidden="true" ref={gutterRef}>
    {Array.from({ length: Math.max(8, value.split("\n").length) }, (_, index) => <span key={index}>{index + 1}</span>)}
  </div><div className="code-input"><pre ref={highlightRef} aria-hidden="true">{highlightJson ? <JsonHighlights value={value} /> : value}</pre><label htmlFor={id} className="sr-only">{label}</label><textarea id={id} value={value} onChange={(event) => onChange?.(event.target.value)}
    aria-invalid={invalid || undefined} aria-describedby={describedBy}
    readOnly={readOnly} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" placeholder={highlightJson ? "Enter a JSON payload…" : "Enter a request body…"}
    onScroll={(event) => {
      if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
      if (highlightRef.current) { highlightRef.current.scrollTop = event.currentTarget.scrollTop; highlightRef.current.scrollLeft = event.currentTarget.scrollLeft; }
    }} /></div>
  </div>;
}
