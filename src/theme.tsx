import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const ThemeContext = createContext<ResolvedTheme>("dark");

export function ThemeProvider({ value, children }: { value: ResolvedTheme; children: ReactNode }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}

function systemDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useResolvedTheme(pref: ThemePref): ResolvedTheme {
  const [sysDark, setSysDark] = useState<boolean>(() => systemDark());
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
  return pref === "system" ? (sysDark ? "dark" : "light") : pref;
}

export function useApplyDocumentTheme(resolved: ResolvedTheme) {
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
}
