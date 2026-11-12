import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Download, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RunSummary } from "@/features/runs/run-summary";
import { RunTable } from "@/features/runs/run-table";
import { PatternPreview } from "@/features/playground/pattern-preview";
import { useRequestDraft } from "@/features/playground/draft-provider";
import { useRunnerStatus } from "@/features/playground/use-runner";
import { useSavedRuns, useSavedRunsSummary } from "@/features/history/use-saved-runs";
import { downloadJson } from "@/lib/download-json";
import { formatNumber } from "@/lib/run-types";

export function OverviewPage() {
  const summaryQuery = useSavedRunsSummary();
  const recentQuery = useSavedRuns({ limit: 4, offset: 0, outcome: "all", sort: "newest" });
  const { loadConfiguration } = useRequestDraft();
  const navigate = useNavigate();
  const runner = useRunnerStatus();
  const runnerState = runner.data?.state;
  const runnerLabel = runnerState === "running" ? "Run in progress" : runnerState === "idle" ? "Ready for a run" : "Status unavailable";
  const runnerDot = runnerState === "running" ? "status-running" : runnerState === "idle" ? "status-idle" : "status-unavailable";

  if (summaryQuery.isPending) {
    return <div className="page-container"><section className="panel" role="status"><p>Loading saved runs from your account…</p></section></div>;
  }

  if (summaryQuery.isError) {
    return <div className="page-container"><EmptyState title="Saved runs are unavailable"
      description={summaryQuery.error instanceof Error ? summaryQuery.error.message : "The local database could not be read."}
      action={<Button onClick={() => void summaryQuery.refetch()}>Try again</Button>} /></div>;
  }

  const summary = summaryQuery.data;
  const latest = summary.latestRun;
  const recentRuns = recentQuery.data?.runs ?? [];

  if (!latest) {
    return <div className="page-container"><PageHeading eyebrow="Benchmarking workspace" title="Overview" description="Your local workbench. A clear view of every test." actions={<Button asChild><Link to="/playground"><Plus />New run</Link></Button>} />
      <EmptyState title="No saved runs yet" description="Finish a run while signed in and its metrics will appear here."
        action={<Button asChild><Link to="/playground"><Plus />Run your first test</Link></Button>} />
    </div>;
  }

  return <div className="page-container"><PageHeading eyebrow="Benchmarking workspace" title="Overview" description="Your local workbench. A clear view of every test." actions={<>
    <Button variant="outline" onClick={() => downloadJson(recentRuns, "do-better-recent-runs.json")} disabled={!recentRuns.length}><Download />Export recent runs</Button>
    <Button asChild><Link to="/playground"><Plus />New run</Link></Button></>} />
    <div className="instrument-strip"><div><span className={`status-dot ${runnerDot}`} /><div><p className="eyebrow">Runner</p><span>{runnerLabel}</span></div></div>
      <div><ShieldCheck size={18} /><div><p className="eyebrow">Execution</p><span>Target requests stay local</span></div></div>
      <div><span className="preview-square" /><div><p className="eyebrow">Data source</p><span>Saved history from your account</span></div></div></div>
    <section className="panel latest-run"><div className="latest-run-toolbar"><div className="target-line"><span className="method-badge">POST</span><code>{latest.configuration.url}</code><span className="quiet-tag">Latest saved run</span></div>
      <div className="table-actions"><Button variant="outline" onClick={() => { loadConfiguration(latest.configuration); void navigate({ to: "/playground" }); }}><SlidersHorizontal />Load in Playground</Button>
        <Button asChild><Link to="/runs/$runId" params={{ runId: latest.result.id }}>Inspect run<ArrowRight /></Link></Button></div></div>
      <div className="latest-run-content"><RunSummary run={latest} /><div className="latest-pattern"><p className="eyebrow">Planned profile</p><PatternPreview pattern={latest.configuration.pattern} /><p className="help-text">{formatNumber(latest.configuration.rate)} req/{latest.configuration.rateUnit === "per_second" ? "sec" : "min"} · {latest.configuration.durationSeconds} seconds · Concurrency {latest.configuration.concurrency}</p></div></div>
    </section>
    <div className="metrics-grid overview-metrics"><MetricCard label="Saved runs" value={formatNumber(summary.totalRuns)} detail={`Across ${summary.endpointCount} target endpoint${summary.endpointCount === 1 ? "" : "s"}`} />
      <MetricCard label="Requests started" value={formatNumber(summary.requestsStarted)} detail="Across saved runs" />
      <MetricCard label="Request success" value={summary.successRate === null ? "—" : `${formatNumber(summary.successRate, 1)}%`} detail="Succeeded / started" tone="success" />
      <MetricCard label="Stopped early" value={formatNumber(summary.stoppedEarly)} detail="HTTP 500 or network error" tone={summary.stoppedEarly ? "danger" : undefined} />
    </div>
    <section className="panel table-panel"><div className="section-heading"><div><h2>Execution log</h2><p>Recent runs saved to your account.</p></div><Button asChild variant="ghost"><Link to="/history">All history<ArrowRight /></Link></Button></div>
      {recentQuery.isError
        ? <div className="notice notice-error" role="status">{recentQuery.error instanceof Error ? recentQuery.error.message : "Recent runs could not be loaded."} <Button size="sm" variant="ghost" onClick={() => void recentQuery.refetch()}>Try again</Button></div>
        : recentQuery.isPending && !recentQuery.data
          ? <div className="empty-state" role="status"><p>Loading recent runs…</p></div>
          : <RunTable runs={recentRuns} />}
      <div className="table-footer"><span>Showing {recentRuns.length} of {summary.totalRuns} saved runs</span><span>Metrics stored without payloads</span></div></section>
  </div>;
}
