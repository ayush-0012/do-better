import { useEffect, useState } from "react";
import { CheckCircle2, Download, Search, Terminal, TriangleAlert } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RunTable } from "@/features/runs/run-table";
import { useSavedRuns, useSavedRunsSummary } from "@/features/history/use-saved-runs";
import { useDebouncedValue } from "@/features/history/use-debounced-value";
import { downloadJson } from "@/lib/download-json";
import { formatNumber } from "@/lib/run-types";

const pageSize = 10;
type OutcomeFilter = "all" | "completed" | "stopped";
type SortOrder = "newest" | "oldest";

export function HistoryPage() {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOrder>("newest");
  const debouncedQuery = useDebouncedValue(query);
  const listQuery = useSavedRuns({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: debouncedQuery,
    outcome,
    sort,
  });
  const summaryQuery = useSavedRunsSummary();

  const total = listQuery.data?.total ?? 0;
  const runs = listQuery.data?.runs ?? [];
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const summary = summaryQuery.data;
  const hasFilters = Boolean(debouncedQuery) || outcome !== "all";

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return <div className="page-container"><PageHeading eyebrow="Execution archive" title="Run history" description="Every saved execution from your account, in one place." actions={
    <Button variant="outline" onClick={() => downloadJson(runs, "do-better-history-page.json")} disabled={!runs.length}><Download />Export page</Button>} />
    <div className="metrics-grid"><MetricCard label="Saved runs" value={summary ? formatNumber(summary.totalRuns) : "—"} detail={summary ? `Across ${summary.endpointCount} endpoint${summary.endpointCount === 1 ? "" : "s"}` : "Loading history"} icon={<Terminal size={18} />} />
      <MetricCard label="Duration completed" value={summary ? formatNumber(summary.completed) : "—"} detail="Reached the configured duration" icon={<CheckCircle2 size={18} />} />
      <MetricCard label="Stopped early" value={summary ? formatNumber(summary.stoppedEarly) : "—"} detail="HTTP 500 or network error" tone={summary?.stoppedEarly ? "danger" : "default"} icon={<TriangleAlert size={18} />} />
      <MetricCard label="Request success" value={summary?.successRate == null ? "—" : `${formatNumber(summary.successRate, 1)}%`} detail="Succeeded / started" tone="success" /></div>
    {summaryQuery.isError && <div className="notice notice-error" role="status">Summary metrics are unavailable. <Button size="sm" variant="ghost" onClick={() => void summaryQuery.refetch()}>Try again</Button></div>}
    <div className="history-filters panel"><label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">Search target URL</span><input type="search" placeholder="Filter by target endpoint…" value={query} onChange={(event) => changeQuery(event.target.value)} /></label>
      <div className="segments filter-segments" role="group" aria-label="Filter by run outcome">{([["all", "All runs"], ["completed", "Completed"], ["stopped", "Stopped"]] as const).map(([value, label]) =>
        <button key={value} aria-pressed={outcome === value} onClick={() => { setOutcome(value); setPage(1); }}>{label}</button>)}</div>
      <select aria-label="Sort runs" value={sort} onChange={(event) => { setSort(event.target.value as SortOrder); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </div>
    <section className="panel table-panel" aria-busy={listQuery.isFetching}>
      {listQuery.isError
        ? <div className="notice notice-error" role="status">{listQuery.error instanceof Error ? listQuery.error.message : "Saved runs could not be loaded."} <Button size="sm" variant="ghost" onClick={() => void listQuery.refetch()}>Try again</Button></div>
        : listQuery.isPending && !listQuery.data
          ? <div className="empty-state" role="status"><p>Loading saved runs…</p></div>
          : total === 0
            ? <EmptyState title={hasFilters ? "No matching runs" : "No saved runs yet"}
                description={hasFilters ? "Try another endpoint or outcome filter." : "Finish a run while signed in and it will appear here."}
                action={hasFilters
                  ? <Button variant="outline" onClick={() => { setQuery(""); setOutcome("all"); setPage(1); }}>Clear filters</Button>
                  : undefined} />
            : <RunTable runs={runs} />}
      <div className="table-footer"><span>{total ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total} saved runs` : hasFilters ? "No matching saved runs" : "No saved runs yet"}</span>
        <nav aria-label="History pagination" className="pagination"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span aria-live="polite">{currentPage} / {pageCount}</span><Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></nav></div></section>
    <aside className="notice"><strong>Your history, without the payload.</strong><p>Saved reports contain run configuration and aggregate metrics. Target request headers and bodies are excluded.</p></aside>
  </div>;
}
