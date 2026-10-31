import { PatternPreview } from "@/features/playground/pattern-preview";
import { formatNumber, patternLabels, requestsPerSecond, type RequestPattern } from "@/lib/run-types";
import type { RequestDraft } from "@/features/playground/draft-provider";

export function LoadProfile({ draft, onChange }: { draft: RequestDraft; onChange: (changes: Partial<RequestDraft>) => void }) {
  const estimatedMaximum = requestsPerSecond(draft) * draft.durationSeconds;
  return <section className="panel load-profile" aria-labelledby="load-profile-heading"><h2 id="load-profile-heading">Load profile</h2>
    <PatternPreview pattern={draft.pattern} />
    <div className="segments" role="group" aria-label="Request pattern">{(Object.keys(patternLabels) as RequestPattern[]).map((pattern) =>
      <button type="button" key={pattern} aria-pressed={draft.pattern === pattern} onClick={() => onChange({ pattern })}>{patternLabels[pattern]}</button>)}</div>
    <label className="field" htmlFor="request-rate"><span>Request rate</span><span className="number-control"><input id="request-rate" type="number" min="0.001" step="any" required value={Number.isNaN(draft.rate) ? "" : draft.rate}
      onChange={(event) => onChange({ rate: event.target.valueAsNumber })} /><select aria-label="Request rate unit" value={draft.rateUnit} onChange={(event) => onChange({ rateUnit: event.target.value as RequestDraft["rateUnit"] })}>
        <option value="per_second">req / second</option><option value="per_minute">req / minute</option></select></span></label>
    <div className="field-pair"><label className="field" htmlFor="duration"><span>Duration</span><span className="number-control"><input id="duration" type="number" min="0.001" step="any" required value={Number.isNaN(draft.durationSeconds) ? "" : draft.durationSeconds}
      onChange={(event) => onChange({ durationSeconds: event.target.valueAsNumber })} /><span className="input-unit">sec</span></span></label>
    <label className="field" htmlFor="concurrency"><span>Concurrency</span><input id="concurrency" type="number" min="1" step="1" required value={Number.isNaN(draft.concurrency) ? "" : draft.concurrency}
      onChange={(event) => onChange({ concurrency: event.target.valueAsNumber })} /></label></div>
    <div className="schedule-summary"><strong>{Number.isFinite(estimatedMaximum) && estimatedMaximum > 0 ? formatNumber(Math.floor(estimatedMaximum)) : "—"} requests</strong>
      <p>{draft.pattern === "constant" ? "Estimated" : "Upper bound"} over {Number.isFinite(draft.durationSeconds) ? draft.durationSeconds : "—"} seconds</p></div>
    <p className="help-text">Stops on HTTP 500 or a network error. Concurrency limits may reduce the number dispatched.</p>
  </section>;
}
