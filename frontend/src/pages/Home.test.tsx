import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";
import { ThemeProvider } from "@/lib/theme-context";
import { deleteLinkRequest, getLinksRequest, type UserLink } from "@/lib/api";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "ada@example.com" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getLinksRequest: vi.fn(),
    deleteLinkRequest: vi.fn(),
  };
});

const sampleLinks: UserLink[] = [
  {
    id: "1",
    title: "https://example.com/a",
    slug: "alpha",
    url: "https://example.com/a",
    clicks: 0,
  },
  {
    id: "2",
    title: "https://example.com/b",
    slug: "beta",
    url: "https://example.com/b",
    clicks: 1,
  },
];

const renderHome = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </ThemeProvider>
  );

describe("Home dashboard", () => {
  beforeEach(() => {
    vi.mocked(getLinksRequest).mockReset();
    vi.mocked(deleteLinkRequest).mockReset();
  });

  it("shows a loading state while links are fetched", () => {
    vi.mocked(getLinksRequest).mockReturnValue(new Promise(() => undefined));
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Loading links...");
  });

  it("shows an empty state when there are no links", async () => {
    vi.mocked(getLinksRequest).mockResolvedValue({ links: [] });
    renderHome();
    expect(await screen.findByText("No links yet. Create your first short link.")).toBeInTheDocument();
    expect(screen.getByText("Total links").parentElement).toHaveTextContent("0");
    expect(screen.getByText("Total clicks").parentElement).toHaveTextContent("0");
  });

  it("renders click counts and keeps links visible after a failed deletion", async () => {
    const user = userEvent.setup();
    vi.mocked(getLinksRequest).mockResolvedValue({ links: sampleLinks });
    vi.mocked(deleteLinkRequest).mockRejectedValue(new Error("nope"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderHome();

    expect(await screen.findByText("0 clicks")).toBeInTheDocument();
    expect(screen.getByText("1 click")).toBeInTheDocument();
    expect(screen.getByText("Total clicks").parentElement).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Delete /alpha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("/alpha")).toBeInTheDocument();
    expect(screen.getByText("/beta")).toBeInTheDocument();
  });

  it("does not hide the empty prompt as a stand-in when the initial load fails", async () => {
    vi.mocked(getLinksRequest).mockRejectedValue(new Error("offline"));
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByText("No links yet. Create your first short link.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
