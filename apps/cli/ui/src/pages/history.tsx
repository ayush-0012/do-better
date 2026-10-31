import { useState } from "react";
import { CheckCircle2, Download, Search, Terminal, TriangleAlert } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { RunTable } from "@/features/runs/run-table";
import { sampleRuns } from "@/features/runs/sample-runs";
import { downloadJson } from "@/lib/download-json";

const pageSize = 4;
type OutcomeFilter = "all" | "completed" | "stopped";

export function HistoryPage() {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const matching = sampleRuns.filter((run) => run.configuration.url.toLowerCase().includes(query.toLowerCase()) && (outcome === "all" || (outcome === "completed") === (run.result.stopReason === "duration_elapsed")))
    .sort((first, second) => (Date.parse(second.result.startedAt) - Date.parse(first.result.startedAt)) * (sort === "newest" ? 1 : -1));
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = matching.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const completed = sampleRuns.filter((run) => run.result.stopReason === "duration_elapsed").length;
  const endpointCount = new Set(sampleRuns.map((run) => run.configuration.url)).size;
  return <div className="page-container"><PageHeading eyebrow="Execution archive" title="Run history" description="Every completed and stopped execution, in one place." actions={<Button variant="outline" onClick={() => downloadJson(matching, "do-better-filtered-sample-runs.json")}><Download />Export sample JSON</Button>} />
    <div className="metrics-grid"><MetricCard label="Sample executions" value={sampleRuns.length} detail={`Across ${endpointCount} endpoints`} icon={<Terminal size={18} />} />
      <MetricCard label="Duration completed" value={completed} detail="Reached the configured duration" icon={<CheckCircle2 size={18} />} />
      <MetricCard label="Stopped early" value={sampleRuns.length - completed} detail="HTTP 500 or network error" tone="danger" icon={<TriangleAlert size={18} />} />
      <MetricCard label="Data source" value={<span className="metric-word">Preview</span>} detail="Master integration is pending" /></div>
    <div className="history-filters panel"><label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">Search target URL</span><input type="search" placeholder="Filter by target endpoint…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
      <div className="segments filter-segments" role="group" aria-label="Filter by run outcome">{([['all', 'All runs'], ['completed', 'Completed'], ['stopped', 'Stopped']] as const).map(([value, label]) =>
        <button key={value} aria-pressed={outcome === value} onClick={() => { setOutcome(value); setPage(1); }}>{label}</button>)}</div>
      <select aria-label="Sort runs" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </div>
    <section className="panel table-panel"><RunTable runs={visible} /><div className="table-footer"><span>{matching.length ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, matching.length)} of ${matching.length} sample runs` : "No matching sample runs"}</span>
      <nav aria-label="History pagination" className="pagination"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span aria-live="polite">{currentPage} / {pageCount}</span><Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></nav></div></section>
    <aside className="notice"><strong>Your history, without the payload.</strong><p>The master stores run configuration and aggregate metrics. Target request headers and bodies are excluded.</p></aside>
  </div>;
}
