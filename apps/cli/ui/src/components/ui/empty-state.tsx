import type { ReactNode } from "react";
import { FileSearch } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><FileSearch size={28} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</div>;
}
