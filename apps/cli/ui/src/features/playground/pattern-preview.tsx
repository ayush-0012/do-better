import { patternLabels, type RequestPattern } from "@/lib/run-types";

const paths: Record<RequestPattern, string> = {
  constant: "M0 25 L300 25",
  ramp: "M0 46 L300 6",
  burst: "M0 46 L50 46 L50 7 L300 7",
  randomized: "M0 40 L45 40 L45 12 L95 12 L95 30 L150 30 L150 5 L205 5 L205 42 L255 42 L255 22 L300 22",
};

export function PatternPreview({ pattern }: { pattern: RequestPattern }) {
  return <div className="pattern-preview"><svg viewBox="0 0 300 58" preserveAspectRatio="none" role="img" aria-label={`${patternLabels[pattern]} planned request rate; illustrative, not measured`}>
    <path d={`${paths[pattern]} L300 58 L0 58 Z`} fill="currentColor" opacity="0.06" />
    <path d={paths[pattern]} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg></div>;
}
