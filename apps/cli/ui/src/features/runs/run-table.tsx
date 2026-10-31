import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useRequestDraft } from "@/features/playground/draft-provider";
import { formatLatency, formatNumber, patternLabels, stopReasonLabels, type RunRecord } from "@/lib/run-types";

export function RunTable({ runs }: { runs: RunRecord[] }) {
  const { loadConfiguration } = useRequestDraft();
  const navigate = useNavigate();
  if (runs.length === 0) return <EmptyState title="No matching runs" description="Try another endpoint, outcome, or date range." />;
  return <div className="table-scroll"><table className="run-table"><caption className="sr-only">Sample API test runs</caption><thead><tr>
    <th scope="col">Target URL</th><th scope="col">Pattern</th><th scope="col">Duration</th><th scope="col">Completed</th><th scope="col">Failed</th><th scope="col">Stop reason</th><th scope="col">Actions</th>
  </tr></thead><tbody>{runs.map((run) => <tr key={run.result.id}><td><div className="table-target"><span className="method-badge small">POST</span><code>{run.configuration.url}</code></div>
    <span className="table-secondary">{new Date(run.result.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></td>
    <td>{patternLabels[run.configuration.pattern]}<span className="table-secondary">{run.configuration.rate} req/{run.configuration.rateUnit === "per_second" ? "sec" : "min"}</span></td>
    <td className="numeric">{run.result.elapsedSeconds}s</td><td className="numeric">{formatNumber(run.result.metrics.requestsCompleted)}</td>
    <td className={run.result.metrics.requestsFailed ? "numeric text-danger" : "numeric text-success"}>{formatNumber(run.result.metrics.requestsFailed)}</td>
    <td><span className={`outcome-label ${run.result.stopReason === "duration_elapsed" ? "outcome-success" : "outcome-error"}`}><span className="status-dot" />{stopReasonLabels[run.result.stopReason]}</span>
    <span className="table-secondary">{formatLatency(run.result.metrics.latencyMs.average)} avg</span></td>
    <td><div className="table-actions"><Button variant="ghost" size="icon" aria-label={`Load configuration for ${run.configuration.url}`} onClick={() => { loadConfiguration(run.configuration); void navigate({ to: "/playground" }); }}><RotateCcw /></Button>
      <Button asChild variant="secondary" size="sm"><Link to="/runs/$runId" params={{ runId: run.result.id }}>View report<ArrowRight /></Link></Button></div></td>
  </tr>)}</tbody></table></div>;
}
