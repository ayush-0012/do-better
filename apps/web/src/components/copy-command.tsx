import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return <div className="command">
    <span aria-hidden="true" className="prompt">$</span>
    <code>{command}</code>
    <button className="copy-button" onClick={copy} aria-label={`Copy ${command}`}>
      {status === "copied" ? <Check size={16} /> : <Copy size={16} />}
      <span>{status === "copied" ? "Copied" : "Copy"}</span>
    </button>
    <span role="status" className={status === "failed" ? "copy-error" : "sr-only"}>
      {status === "failed" ? "Copy unavailable. Select the command to copy it." : status === "copied" ? "Copied to clipboard" : ""}
    </span>
  </div>;
}
