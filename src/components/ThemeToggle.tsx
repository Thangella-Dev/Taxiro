"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const THEME_KEY = "taxiro-theme";

type ThemeMode = "dark" | "light";

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        compact ? "taxiro-theme-toggle relative inline-flex size-10 shrink-0 items-center rounded-full border border-border bg-card/90 p-1 text-primary shadow-[var(--shadow-soft)] backdrop-blur-xl transition active:scale-95 sm:size-11" : "taxiro-theme-toggle relative inline-flex h-10 w-[4.75rem] shrink-0 items-center rounded-full border border-border bg-card/90 p-1 text-primary shadow-[var(--shadow-soft)] backdrop-blur-xl transition active:scale-95 sm:h-11 sm:w-20",
        className,
      )}
      onClick={toggleTheme}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      type="button"
    >
      <span
        className={cn(
          "absolute inset-y-1 left-1 grid aspect-square place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-300 ease-out",
          compact ? "translate-x-0" : theme === "dark" ? "translate-x-[2.15rem] sm:translate-x-[2.25rem]" : "translate-x-0",
        )}
      >
        {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
      <span className="sr-only">{theme === "dark" ? "Dark" : "Light"}</span>
      {!compact ? (
        <span className="ml-auto pr-2 text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
          {theme === "dark" ? "Dark" : "Light"}
        </span>
      ) : null}
    </button>
  );
}
