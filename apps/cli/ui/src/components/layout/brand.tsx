import { Link } from "@tanstack/react-router";

export function Brand() {
  return <Link to="/" className="brand" aria-label="do-better home">
    <svg viewBox="-2 0 18 20" width="23" height="25" aria-hidden="true"><path d="M7 0L9 5L14 3L11 8L16 10L11 12L14 17L9 15L7 20L5 15L0 17L3 12L-2 10L3 8L0 3L5 5Z" fill="currentColor" /></svg>
    <span>do-better</span>
  </Link>;
}
