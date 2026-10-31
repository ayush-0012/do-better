import type { ReactNode } from "react";

// Render tokens as text nodes so an untrusted payload can never become HTML.
export function JsonHighlights({ value }: { value: string }) {
  const tokens: ReactNode[] = [];
  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  let previousEnd = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index;
    if (start > previousEnd) tokens.push(value.slice(previousEnd, start));
    const className = match[2] ? "syntax-key" : match[1] ? "syntax-string" : "syntax-literal";
    tokens.push(<span className={className} key={start}>{match[0]}</span>);
    previousEnd = start + match[0].length;
  }
  tokens.push(value.slice(previousEnd));
  return <>{tokens}</>;
}
