import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function Brand() {
  return <Link to="/" className="brand" aria-label="do-better home">
    <Activity className="brand-mark" size={27} strokeWidth={2.2} aria-hidden="true" />
    <span>do-better</span>
  </Link>;
}
