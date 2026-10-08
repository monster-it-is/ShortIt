import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Landing from "./Landing";
import { ThemeProvider } from "@/lib/theme-context";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

describe("Landing page", () => {
  it("keeps Learn More on the page and points at Why ShortIt", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Landing />
        </MemoryRouter>
      </ThemeProvider>
    );

    const learnMore = screen.getByRole("link", { name: "Learn More" });
    expect(learnMore).toHaveAttribute("href", "#why-shortit");
    expect(learnMore).not.toHaveAttribute("href", "https://abhee.dev");
    expect(document.getElementById("why-shortit")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Why ShortIt?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Simple Link Management" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Get Started" }).length).toBeGreaterThan(0);
  });
});
