import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Download, LockKeyhole, SlidersHorizontal, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { RunSummary } from "@/features/runs/run-summary";
import { StatusDistribution } from "@/features/runs/status-distribution";
import { PatternPreview } from "@/features/playground/pattern-preview";
import { useRequestDraft } from "@/features/playground/draft-provider";
import { useRetryRunUpload, useAccount } from "@/features/account/use-account";
import { useSavedRun } from "@/features/history/use-saved-runs";
import { formatLatency, patternLabels, stopReasonLabels } from "@/lib/run-types";
import { getRun, runQueryKey, type RunUploadState } from "@/lib/local-api";
import { downloadJson } from "@/lib/download-json";

export function RunResultsPage({ runId }: { runId: string }) {
  const localRun = useQuery({ queryKey: runQueryKey(runId), queryFn: () => getRun(runId), retry: false });
  const retryUpload = useRetryRunUpload(runId);
  const account = useAccount();
  const canLoadSavedRun = account.data?.state === "signed_in" && localRun.isSuccess && localRun.data === null;
  const savedRun = useSavedRun(runId, canLoadSavedRun);
  const { loadConfiguration } = useRequestDraft();
  const navigate = useNavigate();
  const run = localRun.data?.run ?? savedRun.data;
  const upload = localRun.data?.upload;
  const isLocalRun = localRun.data?.run != null;
  const savedIsLoading = canLoadSavedRun && savedRun.isPending;
  const accountIsChecking = localRun.isSuccess && localRun.data === null && account.isPending;
  const loadError = localRun.isError ? localRun.error : savedRun.error;

  if (!run && (localRun.isPending || savedIsLoading || accountIsChecking)) {
    return <div className="page-container"><section className="panel" role="status"><p>Loading this run…</p></section></div>;
  }
  if (!run && loadError) {
    return <div className="page-container"><EmptyState title="Run unavailable"
      description={loadError instanceof Error ? loadError.message : "The run could not be loaded."}
      action={<Button onClick={() => { void localRun.refetch(); void savedRun.refetch(); }}>Try again</Button>} /></div>;
  }
  if (!run) {
    return <div className="page-container"><EmptyState title="Run not found"
      description="Runs are kept in memory for this session. Sign in to open saved runs from your account."
      action={<Button asChild><Link to="/history">Back to history</Link></Button>} /></div>;
  }

  const { result, configuration } = run;
  const loadInPlayground = () => { loadConfiguration(configuration); void navigate({ to: "/playground" }); };
  return <div className="page-container"><Link to="/history" className="back-link"><ArrowLeft size={18} />Back to history</Link>
    <PageHeading eyebrow="Execution report" title={`Run results: ${new URL(configuration.url).pathname}`}
      description={isLocalRun ? "A clear view of what this local run returned." : "A clear view of what this saved run returned."} actions={<>
      <Button variant="outline" onClick={() => downloadJson(run, `do-better-${isLocalRun ? "local" : "saved"}-${result.id}.json`)}><Download />Export JSON</Button>
      <Button onClick={loadInPlayground}>Run again in Playground<ArrowRight /></Button></>} />
    <div className="panel run-context"><div><div className="target-line"><span className="method-badge">POST</span><code>{configuration.url}</code></div><p className={result.stopReason === "duration_elapsed" ? "text-success" : "text-danger"}>{stopReasonLabels[result.stopReason]} · {result.elapsedSeconds}s elapsed</p></div>
      <div className="run-context-actions">
        <span className={`quiet-tag ${isLocalRun && upload?.state === "uploaded" ? "text-success" : !isLocalRun ? "text-success" : ""}`}>{isLocalRun ? uploadLabel(upload) : "Saved to account"}</span>
        {isLocalRun && upload?.state === "pending" && <Button size="sm" variant="outline" onClick={() => retryUpload.mutate()} disabled={retryUpload.isPending}>{retryUpload.isPending ? "Saving…" : "Retry save"}</Button>}
        {isLocalRun && upload?.state === "not_signed_in" && (account.data?.state === "signed_in"
          ? <Button size="sm" variant="outline" onClick={() => retryUpload.mutate()} disabled={retryUpload.isPending}>{retryUpload.isPending ? "Saving…" : "Save now"}</Button>
          : <Button size="sm" variant="outline" asChild><Link to="/settings" hash="account">Sign in to save</Link></Button>)}
      </div></div>
    {isLocalRun && upload?.state === "pending" && <div className="notice notice-error" role="status"><strong>Not saved yet.</strong> {upload.error}</div>}
    {isLocalRun && upload?.state === "not_signed_in" && <div className="notice" role="note"><strong>Local only.</strong> {account.data?.state === "signed_in" ? "Save this run's metrics to your account." : "Sign in to save this run's metrics to your account."}</div>}
    {retryUpload.error && <div className="notice notice-error" role="alert">{retryUpload.error instanceof Error ? retryUpload.error.message : "The run could not be saved."}</div>}
    {result.error && <div role="note" className="notice notice-error">{result.error}. Partial metrics are preserved in this run.</div>}
    <div className="report-grid"><div className="report-main"><RunSummary run={run} />
      <section className="panel report-section"><div className="section-title"><h2><Timer size={22} className="accent-icon" />Measured latency bounds</h2></div>
        <div className="latency-grid"><MetricCard label="Minimum" value={formatLatency(result.metrics.latencyMs.min)} /><MetricCard label="Average" value={formatLatency(result.metrics.latencyMs.average)} /><MetricCard label="Maximum" value={formatLatency(result.metrics.latencyMs.max)} /></div>
        <p className="help-text">Includes consuming the response body. Cancellations are excluded. Time-series and percentile data are not collected.</p></section>
      <StatusDistribution run={run} />
      <section className="panel report-section"><h2>Execution details</h2><dl className="detail-list">
        <div><dt>Started</dt><dd>{new Date(result.startedAt).toLocaleString()}</dd></div><div><dt>Finished</dt><dd>{new Date(result.finishedAt).toLocaleString()}</dd></div>
        <div><dt>Aborted requests</dt><dd>{result.metrics.requestsAborted}</dd></div><div><dt>Skipped requests</dt><dd>{result.metrics.requestsSkipped}</dd></div>
        <div><dt>Run ID</dt><dd className="breakable-code">{result.id}</dd></div></dl></section>
    </div><aside className="report-sidebar"><div className="notice"><h3>Configuration preserved</h3><p>Load this profile in the playground to prepare another run. Headers and payloads are not included in saved metadata.</p></div>
      <section className="panel report-section"><div className="section-title"><h2>Load profile</h2><span className="quiet-tag">{patternLabels[configuration.pattern]}</span></div><PatternPreview pattern={configuration.pattern} />
        <dl className="detail-list"><div><dt>Planned rate</dt><dd>{configuration.rate} req/{configuration.rateUnit === "per_second" ? "sec" : "min"}</dd></div><div><dt>Concurrency</dt><dd>{configuration.concurrency}</dd></div><div><dt>Planned duration</dt><dd>{configuration.durationSeconds} seconds</dd></div><div><dt>Stop policy</dt><dd>HTTP 500 / network error</dd></div></dl></section>
      <section className="panel report-section privacy-panel"><LockKeyhole size={22} /><h3>Payload stays local</h3><p>Response bodies are discarded. Target headers and request bodies are never stored with saved results.</p></section>
    </aside></div>
    <div className="execution-tray"><div className="execution-message"><SlidersHorizontal className="accent-icon" /><p>Try another rate or concurrency limit.</p></div><Button variant="outline" onClick={loadInPlayground}>Open in editor<ArrowRight /></Button></div>
  </div>;
}

function uploadLabel(upload: RunUploadState | undefined) {
  switch (upload?.state) {
    case "uploaded":
      return `Saved to account · ${shortId(upload.projectId)}`;
    case "pending":
      return "Save pending";
    case "not_signed_in":
      return "Not saved · signed out";
    default:
      return "Not saved";
  }
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}
