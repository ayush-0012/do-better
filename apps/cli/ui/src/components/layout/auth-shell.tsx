import { Outlet } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/features/settings/appearance-provider";

export function AuthShell() {
  const { theme, setTheme } = useAppearance();

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="app-header">
      <div className="header-inner auth-header">
        <Brand />
        <Button size="icon" variant="ghost" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
  </div>;
}
