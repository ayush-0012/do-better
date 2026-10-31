import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Download, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { RunSummary } from "@/features/runs/run-summary";
import { RunTable } from "@/features/runs/run-table";
import { PatternPreview } from "@/features/playground/pattern-preview";
import { useRequestDraft } from "@/features/playground/draft-provider";
import { sampleRuns } from "@/features/runs/sample-runs";
import { downloadJson } from "@/lib/download-json";
import { formatNumber } from "@/lib/run-types";

export function OverviewPage() {
  const latest = sampleRuns[0]!;
  const { loadConfiguration } = useRequestDraft();
  const navigate = useNavigate();
  const endpointCount = new Set(sampleRuns.map((run) => run.configuration.url)).size;
  const totals = sampleRuns.reduce((sum, run) => ({ started: sum.started + run.result.metrics.requestsStarted, succeeded: sum.succeeded + run.result.metrics.requestsSucceeded }), { started: 0, succeeded: 0 });
  return <div className="page-container"><PageHeading eyebrow="Benchmarking workspace" title="Overview" description="Your local workbench. A clear view of every test." actions={<>
    <Button variant="outline" onClick={() => downloadJson(sampleRuns, "do-better-sample-runs.json")}><Download />Export sample runs</Button>
    <Button asChild><Link to="/playground"><Plus />New run</Link></Button></>} />
    <div className="instrument-strip"><div><span className="status-dot status-idle" /><div><p className="eyebrow">Runner</p><span>Not linked in preview</span></div></div>
      <div><ShieldCheck size={18} /><div><p className="eyebrow">Execution</p><span>Target requests stay local</span></div></div>
      <div><span className="preview-square" /><div><p className="eyebrow">Data source</p><span>Six illustrative sample runs</span></div></div></div>
    <section className="panel latest-run"><div className="latest-run-toolbar"><div className="target-line"><span className="method-badge">POST</span><code>{latest.configuration.url}</code><span className="quiet-tag">Latest sample</span></div>
      <div className="table-actions"><Button variant="outline" onClick={() => { loadConfiguration(latest.configuration); void navigate({ to: "/playground" }); }}><SlidersHorizontal />Load in Playground</Button>
        <Button asChild><Link to="/runs/$runId" params={{ runId: latest.result.id }}>Inspect run<ArrowRight /></Link></Button></div></div>
      <div className="latest-run-content"><RunSummary run={latest} /><div className="latest-pattern"><p className="eyebrow">Planned constant profile</p><PatternPreview pattern="constant" /><p className="help-text">20 req/s · 30 seconds · Concurrency 10</p></div></div>
    </section>
    <div className="metrics-grid overview-metrics"><MetricCard label="Sample executions" value={sampleRuns.length} detail={`Across ${endpointCount} target endpoints`} />
      <MetricCard label="Requests started" value={formatNumber(totals.started)} detail="Across the sample dataset" />
      <MetricCard label="Request success" value={`${formatNumber(totals.succeeded / totals.started * 100, 1)}%`} detail="Succeeded / started" tone="success" />
      <MetricCard label="Stopped early" value={sampleRuns.filter((run) => run.result.stopReason !== "duration_elapsed").length} detail="HTTP 500 or network error" />
    </div>
    <section className="panel table-panel"><div className="section-heading"><div><h2>Execution log</h2><p>A closer look at recent sample executions.</p></div><Button asChild variant="ghost"><Link to="/history">All history<ArrowRight /></Link></Button></div>
      <RunTable runs={sampleRuns.slice(0, 4)} /><div className="table-footer"><span>Showing 4 of {sampleRuns.length} sample runs</span><span>Preview data · No target requests sent</span></div></section>
  </div>;
}
