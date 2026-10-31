import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, FlaskConical, LockKeyhole, RotateCcw, ScanLine } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { FieldError } from "@/components/ui/field-error";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/features/playground/code-editor";
import { HeaderEditor } from "@/features/playground/header-editor";
import { LoadProfile } from "@/features/playground/load-profile";
import { useRequestDraft, type RequestDraft } from "@/features/playground/draft-provider";
import { getDraftErrors, type DraftErrors, type DraftField } from "@/features/playground/validate-draft";

const fieldIds: Record<DraftField, string> = {
  url: "target-url", body: "request-body", rate: "request-rate",
  durationSeconds: "duration", concurrency: "concurrency", headers: "header-editor",
};

export function PlaygroundPage() {
  const { draft, updateDraft, resetDraft } = useRequestDraft();
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<"body" | "headers">("body");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [focusField, setFocusField] = useState<DraftField | null>(null);
  const [notice, setNotice] = useState("");
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (!focusField) return;
    const field = formRef.current?.querySelector<HTMLElement>(`#${fieldIds[focusField]}`);
    field?.focus();
    field?.scrollIntoView({ block: "center", behavior: "instant" });
    setFocusField(null);
  }, [focusField, tab]);

  function changeDraft(changes: Partial<RequestDraft>) {
    updateDraft(changes);
    setNotice("");
    if (hasSubmitted) setErrors(getDraftErrors({ ...draft, ...changes }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = getDraftErrors(draft);
    const firstField = Object.keys(nextErrors)[0] as DraftField | undefined;
    setHasSubmitted(true);
    setErrors(nextErrors);
    setNotice(firstField ? "" : "Configuration is valid. No requests were sent — local execution is not connected yet.");
    if (firstField) {
      if (firstField === "body" || firstField === "headers") setTab(firstField);
      setFocusField(firstField);
    }
  }

  function reset() {
    resetDraft();
    setErrors({});
    setHasSubmitted(false);
    setNotice("");
  }

  return (
    <div className="page-container">
      <PageHeading eyebrow="Local API testing" title="Playground"
        description="Shape the request. Set the load. See what holds."
        actions={<span className="workspace-mode"><FlaskConical size={15} aria-hidden="true" />Validation preview</span>} />
      <form ref={formRef} onSubmit={submit} noValidate className="playground-form">
        {errorCount > 0 && <div className="validation-summary" role="alert">
          Check {errorCount === 1 ? "the highlighted field" : `the ${errorCount} highlighted fields`} below. Your configuration has been preserved.
        </div>}
        <div className="workbench-grid">
          <section className="request-panel panel" aria-label="Request configuration">
            <div className="request-bar">
              <span className="method-badge">POST</span>
              <div className="request-url-field">
                <label htmlFor="target-url" className="sr-only">Target URL</label>
                <input id="target-url" type="url" value={draft.url} onChange={(event) => changeDraft({ url: event.target.value })}
                  aria-invalid={Boolean(errors.url) || undefined} aria-describedby={errors.url ? "url-error" : undefined}
                  placeholder="http://localhost:8080/api/orders" required />
                <FieldError id="url-error" message={errors.url} />
              </div>
            </div>
            <div className="editor-tabs" role="group" aria-label="Request editor section">
              <button type="button" aria-pressed={tab === "body"} onClick={() => setTab("body")}>Request body{errors.body && <span className="tab-error" aria-label="has an error">!</span>}</button>
              <button type="button" aria-pressed={tab === "headers"} onClick={() => setTab("headers")}>Headers <span className="count-label">{draft.headers.length}</span>{errors.headers && <span className="tab-error" aria-label="has an error">!</span>}</button>
              <span className="editor-format">{tab === "body" ? "JSON" : "Key / Value"}</span>
            </div>
            {tab === "body" ? <>
              <CodeEditor id="request-body" value={draft.body} onChange={(body) => changeDraft({ body })}
                invalid={Boolean(errors.body)} describedBy={errors.body ? "body-error" : undefined} />
              <div className="editor-validation"><FieldError id="body-error" message={errors.body} /></div>
            </> : <>
              <HeaderEditor headers={draft.headers} error={errors.headers} onChange={(headers) => changeDraft({ headers })} />
              <div className="editor-validation"><FieldError id="headers-error" message={errors.headers} /></div>
            </>}
            <div className="editor-footer"><LockKeyhole size={14} aria-hidden="true" />Your payload stays on this machine.</div>
          </section>
          <LoadProfile draft={draft} onChange={changeDraft} errors={errors} />
        </div>
        {notice && <div className="notice validation-success" role="status">{notice}</div>}
        <div className="execution-tray">
          <div className="execution-message">
            <span className="play-tile"><ScanLine size={22} aria-hidden="true" /></span>
            <div><h2>Check your configuration.</h2><p>Preview only. No requests will be sent.</p></div>
          </div>
          <div className="execution-actions">
            <Button variant="ghost" type="button" onClick={reset}><RotateCcw />Reset</Button>
            <Button size="lg" type="submit">Validate request<ArrowRight /></Button>
          </div>
        </div>
        <p className="help-text run-footnote">Drafts stay in memory while you navigate. Reloading clears headers and request bodies.</p>
      </form>
    </div>
  );
}
