import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "weekcurve_theme";

/**
 * Pre-hydration anti-flash script string.
 * Injected synchronously in <head> to read localStorage and apply `.dark` to <html>
 * before the body is rendered or painted.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var key = '${THEME_STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (!stored && prefersDark);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
`.trim();

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDocument(theme: Theme): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      setThemeState(initial);
      const resolved = applyThemeToDocument(initial);
      setResolvedTheme(resolved);
    } catch {
      // Fallback if localStorage access is blocked
      const resolved = applyThemeToDocument("system");
      setResolvedTheme(resolved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        const resolved = applyThemeToDocument("system");
        setResolvedTheme(resolved);
      }
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage write errors in restricted contexts
    }
    const resolved = applyThemeToDocument(newTheme);
    setResolvedTheme(resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeToggleProps {
  className?: string;
  variant?: "segmented" | "compact";
}

export function ThemeToggle({ className, variant = "compact" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === "compact") {
    return (
      <div
        role="group"
        aria-label="Color theme selector"
        className={`inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1 text-xs ${className ?? ""}`}
      >
        <button
          type="button"
          aria-label="Switch to light theme"
          aria-pressed={theme === "light"}
          title="Light theme"
          onClick={() => setTheme("light")}
          className={`flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            theme === "light"
              ? "bg-card text-foreground shadow-xs font-medium"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Sun className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Switch to dark theme"
          aria-pressed={theme === "dark"}
          title="Dark theme"
          onClick={() => setTheme("dark")}
          className={`flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            theme === "dark"
              ? "bg-card text-foreground shadow-xs font-medium"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Moon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Switch to system theme"
          aria-pressed={theme === "system"}
          title="System theme"
          onClick={() => setTheme("system")}
          className={`flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            theme === "system"
              ? "bg-card text-foreground shadow-xs font-medium"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Monitor className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Color theme selector"
      className={`inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1 text-xs font-medium text-muted-foreground ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label="Light mode"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
          theme === "light"
            ? "bg-card text-foreground shadow-xs font-medium"
            : "hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        <Sun className="size-3.5" />
        <span>Light</span>
      </button>
      <button
        type="button"
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
          theme === "dark"
            ? "bg-card text-foreground shadow-xs font-medium"
            : "hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        <Moon className="size-3.5" />
        <span>Dark</span>
      </button>
      <button
        type="button"
        aria-label="System mode"
        aria-pressed={theme === "system"}
        onClick={() => setTheme("system")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
          theme === "system"
            ? "bg-card text-foreground shadow-xs font-medium"
            : "hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        <Monitor className="size-3.5" />
        <span>System</span>
      </button>
    </div>
  );
}
