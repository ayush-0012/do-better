import { FieldError } from "@/components/ui/field-error";
import { PatternPreview } from "@/features/playground/pattern-preview";
import { formatNumber, patternLabels, requestsPerSecond, type RequestPattern } from "@/lib/run-types";
import type { RequestDraft } from "@/features/playground/draft-provider";
import type { DraftErrors } from "@/features/playground/validate-draft";

interface LoadProfileProps {
  draft: RequestDraft;
  onChange: (changes: Partial<RequestDraft>) => void;
  errors?: DraftErrors;
}

export function LoadProfile({ draft, onChange, errors = {} }: LoadProfileProps) {
  const estimatedMaximum = requestsPerSecond(draft) * draft.durationSeconds;

  return (
    <section className="panel load-profile" aria-labelledby="load-profile-heading">
      <div className="load-profile-heading">
        <h2 id="load-profile-heading">Load profile</h2>
        <span className="help-text">Planned request rate</span>
      </div>
      <PatternPreview pattern={draft.pattern} />
      <div className="segments" role="group" aria-label="Request pattern">
        {(Object.keys(patternLabels) as RequestPattern[]).map((pattern) => (
          <button type="button" key={pattern} aria-pressed={draft.pattern === pattern} onClick={() => onChange({ pattern })}>
            {patternLabels[pattern]}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="request-rate">Request rate</label>
        <div className="number-control">
          <input id="request-rate" type="number" min="0.001" step="any" required
            value={Number.isNaN(draft.rate) ? "" : draft.rate}
            aria-invalid={Boolean(errors.rate) || undefined} aria-describedby={errors.rate ? "rate-error" : undefined}
            onChange={(event) => onChange({ rate: event.target.valueAsNumber })} />
          <select aria-label="Request rate unit" value={draft.rateUnit}
            onChange={(event) => onChange({ rateUnit: event.target.value as RequestDraft["rateUnit"] })}>
            <option value="per_second">req / second</option>
            <option value="per_minute">req / minute</option>
          </select>
        </div>
        <FieldError id="rate-error" message={errors.rate} />
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="duration">Duration</label>
          <div className="number-control">
            <input id="duration" type="number" min="0.001" step="any" required
              value={Number.isNaN(draft.durationSeconds) ? "" : draft.durationSeconds}
              aria-invalid={Boolean(errors.durationSeconds) || undefined} aria-describedby={errors.durationSeconds ? "duration-error" : undefined}
              onChange={(event) => onChange({ durationSeconds: event.target.valueAsNumber })} />
            <span className="input-unit">sec</span>
          </div>
          <FieldError id="duration-error" message={errors.durationSeconds} />
        </div>
        <div className="field">
          <label htmlFor="concurrency">Concurrency</label>
          <input id="concurrency" type="number" min="1" step="1" required
            value={Number.isNaN(draft.concurrency) ? "" : draft.concurrency}
            aria-invalid={Boolean(errors.concurrency) || undefined} aria-describedby={errors.concurrency ? "concurrency-error" : undefined}
            onChange={(event) => onChange({ concurrency: event.target.valueAsNumber })} />
          <FieldError id="concurrency-error" message={errors.concurrency} />
        </div>
      </div>
      <div className="schedule-summary">
        <strong>{Number.isFinite(estimatedMaximum) && estimatedMaximum > 0 ? formatNumber(Math.floor(estimatedMaximum)) : "—"} requests</strong>
        <p>{draft.pattern === "constant" ? "Estimated" : "Upper bound"} over {Number.isFinite(draft.durationSeconds) ? draft.durationSeconds : "—"} seconds</p>
      </div>
      <p className="help-text">Stops on HTTP 500 or a network error. Concurrency limits may reduce the number dispatched.</p>
    </section>
  );
}
