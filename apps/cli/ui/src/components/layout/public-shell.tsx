import { Link, Outlet } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/account/use-account";
import { useAppearance } from "@/features/settings/appearance-provider";

export function PublicShell() {
  const signedIn = useAccount().data?.state === "signed_in";
  const { theme, setTheme } = useAppearance();

  return <div className="app-shell public-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="app-header">
      <div className="header-inner public-header-inner">
        <Brand />
        <nav className="public-nav" aria-label="Product navigation">
          <Link to="/" hash="get-started">Quickstart</Link>
          <Button size="icon" variant="ghost" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon /> : <Sun />}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={signedIn ? "/overview" : "/sign-in"}>{signedIn ? "Open workspace" : "Sign in"}</Link>
          </Button>
        </nav>
      </div>
    </header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="app-footer"><strong>do-better</strong><span>Local HTTP load testing</span></footer>
  </div>;
}
