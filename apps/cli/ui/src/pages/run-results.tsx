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
import { sampleRuns } from "@/features/runs/sample-runs";
import { formatLatency, patternLabels, stopReasonLabels } from "@/lib/run-types";
import { downloadJson } from "@/lib/download-json";

export function RunResultsPage({ runId }: { runId: string }) {
  const run = sampleRuns.find((entry) => entry.result.id === runId);
  const { loadConfiguration } = useRequestDraft();
  const navigate = useNavigate();
  if (!run) return <div className="page-container"><EmptyState title="Run not found" description="This preview contains only the sample runs listed in history." action={<Button asChild><Link to="/history">Back to history</Link></Button>} /></div>;
  const { result, configuration } = run;
  const loadInPlayground = () => { loadConfiguration(configuration); void navigate({ to: "/playground" }); };
  return <div className="page-container"><Link to="/history" className="back-link"><ArrowLeft size={18} />Back to history</Link>
    <PageHeading eyebrow="Execution report" title={`Run results: ${new URL(configuration.url).pathname}`} description="A clear view of what this sample execution returned." actions={<>
      <Button variant="outline" onClick={() => downloadJson(run, `do-better-sample-${result.id}.json`)}><Download />Export JSON</Button>
      <Button onClick={loadInPlayground}>Run again in Playground<ArrowRight /></Button></>} />
    <div className="panel run-context"><div><div className="target-line"><span className="method-badge">POST</span><code>{configuration.url}</code></div><p className={result.stopReason === "duration_elapsed" ? "text-success" : "text-danger"}>{stopReasonLabels[result.stopReason]} · {result.elapsedSeconds}s elapsed</p></div>
      <div className="quiet-tag">Sample report · Not uploaded</div></div>
    {result.error && <div role="note" className="notice notice-error">{result.error}. Partial metrics are preserved in this sample.</div>}
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
      <section className="panel report-section privacy-panel"><LockKeyhole size={22} /><h3>Payload stays local</h3><p>Response bodies are discarded. Target headers and request bodies are never part of the master upload.</p></section>
    </aside></div>
    <div className="execution-tray"><div className="execution-message"><SlidersHorizontal className="accent-icon" /><p>Try another rate or concurrency limit.</p></div><Button variant="outline" onClick={loadInPlayground}>Open in editor<ArrowRight /></Button></div>
  </div>;
}
