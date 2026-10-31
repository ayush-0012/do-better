import type { RunRecord } from "@/lib/run-types";
import { formatNumber } from "@/lib/run-types";

export function StatusDistribution({ run }: { run: RunRecord }) {
  const { metrics } = run.result;
  const responses = Object.values(metrics.statusCounts).reduce((total, count) => total + count, 0);
  return <section className="panel report-section"><div className="section-title"><h2>HTTP status distribution</h2><span className="help-text">{metrics.requestsAborted} aborted · {metrics.requestsSkipped} skipped</span></div>
    {responses === 0 && <p className="help-text">No HTTP response statuses were received.</p>}
    {Object.entries(metrics.statusCounts).map(([status, count]) => {
      const percent = responses > 0 ? count / responses * 100 : 0;
      return <div className="status-distribution-row" key={status}><div><span className={`http-status ${Number(status) < 400 ? "text-success" : "text-danger"}`}>HTTP {status}</span><span className="numeric">{formatNumber(count)} responses <strong>{formatNumber(percent, 1)}%</strong></span></div>
        <div className="distribution-track" role="meter" aria-label={`HTTP ${status} share of received statuses`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span className={Number(status) < 400 ? "distribution-success" : "distribution-error"} style={{ width: `${percent}%` }} /></div></div>;
    })}<p className="help-text">Share of received HTTP statuses. Network failures may have no status.</p>
  </section>;
}
