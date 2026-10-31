import { MetricCard } from "@/components/ui/metric-card";
import { formatNumber, type RunRecord } from "@/lib/run-types";

export function RunSummary({ run }: { run: RunRecord }) {
  const { metrics, elapsedSeconds } = run.result;
  return <div className="metrics-grid"><MetricCard label="Requests started" value={formatNumber(metrics.requestsStarted)} detail={`${formatNumber(metrics.requestsCompleted)} completed`} />
    <MetricCard label="Succeeded" value={formatNumber(metrics.requestsSucceeded)} tone="success" detail="Completed with HTTP 2xx" />
    <MetricCard label="Failed" value={formatNumber(metrics.requestsFailed)} tone={metrics.requestsFailed ? "danger" : "default"} detail="HTTP or network failures" />
    <MetricCard label="Throughput" value={<>{formatNumber(elapsedSeconds > 0 ? metrics.requestsCompleted / elapsedSeconds : 0, 2)}<small> req/s</small></>} detail="Observed completed requests" />
  </div>;
}
