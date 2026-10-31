import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, actions }: {
  eyebrow: string; title: string; description: ReactNode; actions?: ReactNode;
}) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p>
    <h1>{title}<span className="heading-mark" aria-hidden="true" /></h1>
    <div className="page-description">{description}</div>
  </div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}
