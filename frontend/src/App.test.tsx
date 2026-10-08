import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

const authState = {
  user: null as { id: string; email: string } | null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

describe("authentication navigation", () => {
  it("sends unauthenticated users from /home to landing", () => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.user = null;

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Make your links look smart." })).toBeInTheDocument();
  });

  it("waits on session restore before redirecting", () => {
    authState.isLoading = true;
    authState.isAuthenticated = false;

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking session...");
  });
});
