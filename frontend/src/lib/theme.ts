export const THEME_STORAGE_KEY = "shortit_theme";

export type Theme = "light" | "dark";

export const isTheme = (value: unknown): value is Theme => {
  return value === "light" || value === "dark";
};

export const getStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const getSystemTheme = (): Theme => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const resolveTheme = (stored = getStoredTheme()): Theme => {
  return stored ?? getSystemTheme();
};

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
};

export const persistTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore quota / private-mode failures; the in-memory theme still applies.
  }
};
