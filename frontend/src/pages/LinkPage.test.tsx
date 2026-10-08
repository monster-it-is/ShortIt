import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LinkPage from "./LinkPage";
import { resolveShortLinkRequest } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    resolveShortLinkRequest: vi.fn(),
  };
});

const axiosError = (status?: number): AxiosError => {
  const error = new AxiosError("Request failed");
  if (status !== undefined) {
    error.response = {
      status,
      data: { message: "failed" },
      statusText: "Error",
      headers: {},
      config: {} as never,
    };
  }
  return error;
};

const renderLinkPage = (slug = "abc") =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/${slug}`]}>
        <Routes>
          <Route path="/:slug" element={<LinkPage />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );

describe("LinkPage", () => {
  beforeEach(() => {
    vi.mocked(resolveShortLinkRequest).mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "http://localhost:5173",
        replace: vi.fn(),
      },
    });
  });

  it("resolves a valid slug once under StrictMode", async () => {
    vi.mocked(resolveShortLinkRequest).mockResolvedValue({
      slug: "abc",
      url: "https://example.com/docs",
      clicks: 1,
    });

    renderLinkPage();

    await waitFor(() => {
      expect(resolveShortLinkRequest).toHaveBeenCalledTimes(1);
    });
    expect(resolveShortLinkRequest).toHaveBeenCalledWith("abc");
    expect(window.location.replace).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("shows not-found for unknown slugs", async () => {
    vi.mocked(resolveShortLinkRequest).mockRejectedValue(axiosError(404));
    renderLinkPage("missing");
    expect(await screen.findByRole("alert")).toHaveTextContent("Link not found");
  });

  it("shows a network error instead of not-found", async () => {
    vi.mocked(resolveShortLinkRequest).mockRejectedValue(axiosError());
    renderLinkPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach the server");
  });

  it("shows a server error instead of not-found", async () => {
    vi.mocked(resolveShortLinkRequest).mockRejectedValue(axiosError(500));
    renderLinkPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to resolve link");
  });

  it("shows an invalid-destination state for 400 responses", async () => {
    vi.mocked(resolveShortLinkRequest).mockRejectedValue(axiosError(400));
    renderLinkPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid destination");
  });
});
