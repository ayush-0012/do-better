import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { FlaskConical, Moon, Sun, UserRound } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/features/settings/appearance-provider";

const navigation = [
  { to: "/overview", label: "Overview" }, { to: "/playground", label: "Playground" },
  { to: "/history", label: "History" }, { to: "/settings", label: "Settings" },
] as const;

export function AppShell() {
  const { theme, setTheme } = useAppearance();
  const { pathname } = useLocation();
  const showSamples = pathname === "/overview" || pathname === "/history" || pathname.startsWith("/runs/");
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <Brand />
      <nav aria-label="Main navigation" className="main-nav">{navigation.map(({ to, label }) => <Link key={to} to={to}
        activeProps={{ className: "nav-active", "aria-current": "page" }} className="nav-link">{label}</Link>)}</nav>
      <div className="header-controls"><span className="project-label">Checkout API <span className="subtle">/ preview</span></span>
        <span className="runner-indicator"><span className="status-dot status-idle" />UI preview</span>
        <Button size="icon" variant="ghost" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon /> : <Sun />}</Button>
        <Link to="/settings" className="account-link" aria-label="Account settings"><UserRound size={18} /></Link>
      </div>
    </div></header>
    {showSamples && <div className="sample-notice"><FlaskConical size={14} aria-hidden="true" /><span>Sample data · Execution, authentication, and master uploads are not connected.</span></div>}
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="app-footer"><span><strong>do-better</strong> <span className="footer-dot">·</span> Built for local API testing</span><span>Configure. Run. Understand.</span></footer>
  </div>;
}
