import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddLinkDialog } from "./add-link-dialog";
import { createLinkRequest } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    createLinkRequest: vi.fn(),
  };
});

const axiosError = (status: number, message: string): AxiosError => {
  const error = new AxiosError(message);
  error.response = {
    status,
    data: { message },
    statusText: "Error",
    headers: {},
    config: {} as never,
  };
  return error;
};

describe("AddLinkDialog", () => {
  beforeEach(() => {
    vi.mocked(createLinkRequest).mockReset();
  });

  it("rejects reserved slugs before calling the API", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<AddLinkDialog open onCreated={onCreated} />);

    expect(document.querySelector("form")).toHaveAttribute("novalidate");

    await user.type(screen.getByLabelText("Destination URL"), "https://example.com");
    await user.type(screen.getByLabelText(/Custom slug/), "home");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This slug is reserved");
    expect(createLinkRequest).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows backend uniqueness errors after a valid form passes Zod", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    vi.mocked(createLinkRequest).mockRejectedValue(axiosError(409, "Slug already exists"));

    render(<AddLinkDialog open onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Destination URL"), "https://example.com");
    await user.type(screen.getByLabelText(/Custom slug/), "docs-ok");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Slug already exists");
    expect(createLinkRequest).toHaveBeenCalledWith("https://example.com", "docs-ok");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows success feedback after a link is created", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    vi.mocked(createLinkRequest).mockResolvedValue({
      message: "Link created",
      link: {
        id: "1",
        title: "https://example.com",
        slug: "docs",
        url: "https://example.com",
        clicks: 0,
      },
    });

    render(<AddLinkDialog open onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Destination URL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Congrats, your link has been shortened")).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "docs", clicks: 0 })
    );
  });

  it("shows custom validation and does not call the API when the URL is empty", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<AddLinkDialog open onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Enter a destination URL.")).toBeInTheDocument();
    expect(createLinkRequest).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
