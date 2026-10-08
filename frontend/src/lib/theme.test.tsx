import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme-context";
import { THEME_STORAGE_KEY, applyTheme, getStoredTheme, resolveTheme } from "@/lib/theme";

const setMatchMedia = (matchesDark: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchesDark && query.includes("prefers-color-scheme: dark"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("theme helpers", () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  it("falls back to the system theme when nothing is stored", () => {
    expect(getStoredTheme()).toBeNull();
    setMatchMedia(true);
    expect(resolveTheme()).toBe("dark");
    setMatchMedia(false);
    expect(resolveTheme()).toBe("light");
  });

  it("prefers a stored theme over the system preference", () => {
    setMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(resolveTheme()).toBe("light");
  });

  it("applies the dark class and color-scheme", () => {
    applyTheme("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

describe("ThemeToggle", () => {
  afterEach(() => {
    setMatchMedia(false);
  });

  it("toggles dark mode and persists the choice", async () => {
    const user = userEvent.setup();
    setMatchMedia(false);

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(document.documentElement).not.toHaveClass("dark");
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores a stored dark theme on a fresh provider mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("uses the system dark preference when no theme is stored", () => {
    setMatchMedia(true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass("dark");
  });
});
