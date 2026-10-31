import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value, detail, tone = "default", icon }: {
  label: string; value: ReactNode; detail?: ReactNode; tone?: "default" | "success" | "danger"; icon?: ReactNode;
}) {
  return <div className="metric-card"><div className="metric-label"><span className="eyebrow">{label}</span>{icon}</div>
    <div className={cn("metric-value", tone === "success" && "text-success", tone === "danger" && "text-danger")}>{value}</div>
    {detail && <div className="metric-detail">{detail}</div>}
  </div>;
}
