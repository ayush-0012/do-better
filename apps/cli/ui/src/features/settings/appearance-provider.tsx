import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const AppearanceContext = createContext<{
  theme: Theme; setTheme: (theme: Theme) => void; storageWarning: boolean;
} | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem("do-better-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("do-better-theme", theme); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  }, [theme]);
  return <AppearanceContext.Provider value={{ theme, setTheme, storageWarning }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("AppearanceProvider is required");
  return context;
}
