import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus("copied"); }
    catch { setStatus("failed"); }
  }
  return <span className="copy-control"><Button variant="ghost" size="sm" onClick={copy}>
    {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    {status === "copied" ? "Copied" : "Copy"}
  </Button><span role="status" className={status === "failed" ? "field-error" : "sr-only"}>
    {status === "failed" ? "Copy unavailable. Select the text to copy manually." : status === "copied" ? "Copied to clipboard" : ""}
  </span></span>;
}
