import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function Brand() {
  return <Link to="/" className="brand" aria-label="Do Better home">
    <Activity className="brand-mark" size={38} aria-hidden="true" />
    <span>Do Better</span>
  </Link>;
}
