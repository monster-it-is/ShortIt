import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditLinkDialog } from "./edit-link-dialog";
import { updateLinkRequest } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    updateLinkRequest: vi.fn(),
  };
});

const link = {
  id: "1",
  title: "https://example.com/old",
  slug: "docs",
  url: "https://example.com/old",
  clicks: 4,
};

describe("EditLinkDialog", () => {
  beforeEach(() => {
    vi.mocked(updateLinkRequest).mockReset();
  });

  it("loads the current URL and keeps the dialog open when an update fails", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const error = new AxiosError("failed");
    error.response = {
      status: 400,
      data: { message: "Only http and https URLs are allowed" },
      statusText: "Error",
      headers: {},
      config: {} as never,
    };
    vi.mocked(updateLinkRequest).mockRejectedValue(error);

    render(
      <EditLinkDialog
        link={link}
        trigger={<button type="button">Edit URL</button>}
        onUpdated={onUpdated}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit URL" }));
    const input = screen.getByLabelText("Destination URL");
    expect(input).toHaveValue("https://example.com/old");
    expect(document.querySelector("form")).toHaveAttribute("novalidate");

    await user.clear(input);
    await user.type(input, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only http and https URLs are allowed");
    expect(updateLinkRequest).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
