import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Play, RotateCcw } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/features/playground/code-editor";
import { HeaderEditor } from "@/features/playground/header-editor";
import { LoadProfile } from "@/features/playground/load-profile";
import { useRequestDraft } from "@/features/playground/draft-provider";
import { validateDraft } from "@/features/playground/validate-draft";

export function PlaygroundPage() {
  const { draft, updateDraft, resetDraft } = useRequestDraft();
  const [tab, setTab] = useState<"body" | "headers">("body");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const issue = validateDraft(draft);
    setError(issue); setNotice(issue ? "" : "Configuration is valid. Local execution is not connected yet; no requests were sent.");
  }
  return <div className="page-container"><PageHeading eyebrow="Local API testing" title="Playground" description="Shape the request. Set the load. See what holds." />
    <form onSubmit={submit} noValidate className="playground-form">
      <div className="workbench-grid"><section className="request-panel panel" aria-label="Request configuration">
        <div className="request-bar"><span className="method-badge">POST</span><label htmlFor="target-url" className="sr-only">Target URL</label>
          <input id="target-url" type="url" value={draft.url} onChange={(event) => updateDraft({ url: event.target.value })} placeholder="http://localhost:8080/api/orders" required /></div>
        <div className="editor-tabs" role="group" aria-label="Request editor section">
          <button type="button" aria-pressed={tab === "body"} onClick={() => setTab("body")}>Request body</button>
          <button type="button" aria-pressed={tab === "headers"} onClick={() => setTab("headers")}>Headers <span className="count-label">{draft.headers.length}</span></button>
          <span className="editor-format">{tab === "body" ? "JSON" : "Key / Value"}</span></div>
        {tab === "body" ? <CodeEditor value={draft.body} onChange={(body) => updateDraft({ body })} /> : <HeaderEditor headers={draft.headers} onChange={(headers) => updateDraft({ headers })} />}
        <div className="editor-footer"><LockKeyhole size={14} aria-hidden="true" />Your payload stays on this machine.</div>
      </section><LoadProfile draft={draft} onChange={updateDraft} /></div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="execution-tray"><div className="execution-message"><span className="play-tile"><Play size={22} aria-hidden="true" /></span><div><h2>Ready when you are.</h2><p>Configure locally. Execution wiring is coming next.</p></div></div>
        <div className="execution-actions"><Button variant="ghost" type="button" onClick={() => { resetDraft(); setError(null); setNotice(""); }}><RotateCcw />Reset</Button><Button size="lg" type="submit">Run test<ArrowRight /></Button></div></div>
      <p className="help-text run-footnote">No requests have been sent. Configuration stays in memory for this browser session.</p>
    </form>
  </div>;
}
