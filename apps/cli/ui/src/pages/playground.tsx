import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FlaskConical, LockKeyhole, RotateCcw, ScanLine } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { FieldError } from "@/components/ui/field-error";
import { Button } from "@/components/ui/button";
import { BodyEditor } from "@/features/playground/body-editor";
import { QueryEditor } from "@/features/playground/field-editor";
import { HeaderEditor } from "@/features/playground/header-editor";
import { LoadProfile } from "@/features/playground/load-profile";
import { useRequestDraft, type RequestDraft } from "@/features/playground/draft-provider";
import { getDraftErrors, type DraftErrors, type DraftField } from "@/features/playground/validate-draft";
import { draftToEngineParams } from "@/features/playground/map-draft";
import { useRunnerStatus, useStartRun } from "@/features/playground/use-runner";
import { LocalApiError } from "@/lib/local-api";

const fieldIds: Record<DraftField, string> = {
  url: "target-url", body: "request-body", rate: "request-rate",
  durationSeconds: "duration", concurrency: "concurrency", headers: "header-editor",
};

function formatRunError(error: Error) {
  if (error instanceof LocalApiError) {
    const [issue] = error.issues;
    if (issue) return `${error.message} ${issue.path ? `(${issue.path}) ` : ""}${issue.message}`;
  }
  return error.message;
}

export function PlaygroundPage() {
  const { draft, updateDraft, resetDraft } = useRequestDraft();
  const navigate = useNavigate();
  const runnerStatus = useRunnerStatus();
  const startRun = useStartRun();
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<"body" | "headers" | "query">("body");
  const [isPreparing, setIsPreparing] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [focusField, setFocusField] = useState<DraftField | null>(null);
  const [runError, setRunError] = useState("");
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const errorCount = Object.keys(errors).length;

  const activeStatus = runnerStatus.data?.state === "running" ? runnerStatus.data : null;
  const isRunning = isPreparing || startRun.isPending || activeStatus !== null;
  const startedAt = activeStatus?.startedAt ?? runStartedAt;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
  const runningTarget = activeStatus?.target ?? draft.url;
  const plannedSeconds = activeStatus?.plannedSeconds ?? draft.durationSeconds;
  const lastRunId = runnerStatus.data?.lastRunId ?? null;

  useEffect(() => {
    if (!focusField) return;
    const field = formRef.current?.querySelector<HTMLElement>(`#${fieldIds[focusField]}`);
    field?.focus();
    field?.scrollIntoView({ block: "center", behavior: "instant" });
    setFocusField(null);
  }, [focusField, tab]);

  useEffect(() => {
    if (!isRunning) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  function changeDraft(changes: Partial<RequestDraft>) {
    updateDraft(changes);
    setRunError("");
    if (hasSubmitted) setErrors(getDraftErrors({ ...draft, ...changes }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isRunning) return;

    const nextErrors = getDraftErrors(draft);
    const firstField = Object.keys(nextErrors)[0] as DraftField | undefined;
    setHasSubmitted(true);
    setErrors(nextErrors);
    if (firstField) {
      setRunError("");
      if (firstField === "body" || firstField === "headers") setTab(firstField);
      setFocusField(firstField);
      return;
    }

    let params: Awaited<ReturnType<typeof draftToEngineParams>>;
    setIsPreparing(true);
    try {
      params = await draftToEngineParams(draft);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The request body could not be prepared.");
      return;
    } finally {
      setIsPreparing(false);
    }

    setRunError("");
    setRunStartedAt(new Date().toISOString());
    startRun.mutate(params, {
      onSuccess: (payload) => {
        void navigate({ to: "/runs/$runId", params: { runId: payload.run.result.id } });
      },
      onError: (error) => {
        setRunStartedAt(null);
        setRunError(formatRunError(error));
      },
    });
  }

  function reset() {
    if (isRunning) return;
    resetDraft();
    setErrors({});
    setHasSubmitted(false);
    setRunError("");
    setRunStartedAt(null);
  }

  return (
    <div className="page-container">
      <PageHeading eyebrow="Local API testing" title="Playground"
        description="Shape the request. Set the load. See what holds."
        actions={<span className="workspace-mode"><FlaskConical size={15} aria-hidden="true" />Local runner</span>} />
      <form ref={formRef} onSubmit={submit} noValidate aria-busy={isRunning} className="playground-form">
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
              <button type="button" aria-pressed={tab === "query"} onClick={() => setTab("query")}>Params <span className="count-label">{draft.queryParams.filter(field => field.name || field.value).length}</span></button>
              <button type="button" aria-pressed={tab === "body"} onClick={() => setTab("body")}>Request body{errors.body && <span className="tab-error" aria-label="has an error">!</span>}</button>
              <button type="button" aria-pressed={tab === "headers"} onClick={() => setTab("headers")}>Headers <span className="count-label">{draft.headers.length}</span>{errors.headers && <span className="tab-error" aria-label="has an error">!</span>}</button>
            </div>
            {tab === "query" ? <QueryEditor url={draft.url} entries={draft.queryParams} onChange={(url, queryParams) => changeDraft({ url, queryParams })} /> : tab === "body" ? <>
              <BodyEditor draft={draft} onChange={changeDraft} error={errors.body} />
              <div className="editor-validation"><FieldError id="body-error" message={errors.body} /></div>
            </> : <>
              <HeaderEditor headers={draft.headers} error={errors.headers} onChange={(headers) => changeDraft({ headers })} />
              <div className="editor-validation"><FieldError id="headers-error" message={errors.headers} /></div>
            </>}
            <div className="editor-footer"><LockKeyhole size={14} aria-hidden="true" />Your payload stays on this machine.</div>
          </section>
          <LoadProfile draft={draft} onChange={changeDraft} errors={errors} />
        </div>
        {runError && <div className="notice notice-error" role="alert">{runError}</div>}
        <div className="execution-tray">
          <div className="execution-message">
            <span className="play-tile"><ScanLine size={22} aria-hidden="true" /></span>
            {isRunning
              ? <div>
                <h2>Running locally.</h2>
                <p>{elapsedSeconds}s elapsed · up to {Math.ceil(plannedSeconds)}s planned · Sending from this machine to {runningTarget}</p>
              </div>
              : <div><h2>Ready to run.</h2><p>Requests execute on this machine. Response bodies are discarded.</p></div>}
          </div>
          <div className="execution-actions">
            <Button variant="ghost" type="button" onClick={reset} disabled={isRunning}><RotateCcw />Reset</Button>
            <Button size="lg" type="submit" disabled={isRunning}>{isPreparing ? "Preparing…" : isRunning ? "Running…" : <>Run test<ArrowRight /></>}</Button>
          </div>
        </div>
        <p className="help-text run-footnote">Drafts stay in memory while you navigate. Reloading clears headers and request bodies.</p>
        {!isRunning && lastRunId && <p className="help-text run-footnote"><Link to="/runs/$runId" params={{ runId: lastRunId }}>View the last completed run</Link></p>}
      </form>
    </div>
  );
}
