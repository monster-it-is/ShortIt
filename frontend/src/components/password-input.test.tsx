import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("toggles visibility without submitting or clearing the value", async () => {
    const user = userEvent.setup();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="secret">Password</label>
        <PasswordInput id="secret" defaultValue="hunter2" />
        <button type="submit">Save</button>
      </form>
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("hunter2");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("hunter2");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("type", "button");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("hunter2");
  });
});
