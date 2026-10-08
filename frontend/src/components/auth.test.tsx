import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "./auth";

const login = vi.fn();
const register = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login,
    register,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

describe("AuthDialog", () => {
  beforeEach(() => {
    login.mockReset();
    register.mockReset();
  });

  it("suppresses native validation and shows custom login errors without calling the API", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    const form = document.querySelector("form");
    expect(form).toHaveAttribute("novalidate");

    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("submits one- and two-character login passwords without showing registration length errors", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password", { exact: true });

    await user.type(email, "ada@example.com");
    await user.type(password, "x");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(login).toHaveBeenCalledWith("ada@example.com", "x");
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();

    login.mockClear();
    await user.clear(email);
    await user.clear(password);
    await user.type(email, "ada@example.com");
    await user.type(password, "ab");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(login).toHaveBeenCalledWith("ada@example.com", "ab");
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("submits a five-character login password to the API", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "12345");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(login).toHaveBeenCalledWith("ada@example.com", "12345");
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("does not keep registration password-length errors after switching back to login", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "12345");
    await user.type(screen.getByLabelText("Confirm password"), "12345");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Password must be at least 6 characters.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Already have an account? Login" }));
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Login", exact: true }));
    expect(login).toHaveBeenCalledWith("ada@example.com", "12345");
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("shows the backend 401 for incorrect credentials after a short login password", async () => {
    const user = userEvent.setup();
    const error = new AxiosError("Unauthorized");
    error.response = {
      status: 401,
      data: { message: "Invalid credentials" },
      statusText: "Unauthorized",
      headers: {},
      config: {} as never,
    };
    login.mockRejectedValue(error);
    render(<AuthDialog open />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "x");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(login).toHaveBeenCalledWith("ada@example.com", "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("does not treat a password containing only spaces as empty", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), " ");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(login).toHaveBeenCalledWith("ada@example.com", " ");
  });

  it("validates email format on login", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password", { exact: true }), "abcdef");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email")).toHaveValue("not-an-email");
  });

  it("toggles password visibility on login", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    const password = screen.getByLabelText("Password", { exact: true });
    await user.type(password, "secret-pass");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("secret-pass");
  });

  it("submits with Enter after valid login input", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "abcdef");
    await user.keyboard("{Enter}");

    expect(login).toHaveBeenCalledWith("ada@example.com", "abcdef");
  });

  it("keeps email after invalid credentials and disables submit while pending", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    login.mockImplementation(
      () =>
        new Promise((_, reject) => {
          release = () => reject(new Error("nope"));
        })
    );

    render(<AuthDialog open />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Login", exact: true }));

    expect(screen.getByRole("button", { name: "Please wait..." })).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);

    release();
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("still enforces a six-character minimum on registration", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "12345");
    await user.type(screen.getByLabelText("Confirm password"), "12345");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Password must be at least 6 characters.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("requires matching confirmation on register and does not call the API", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "abcdef");
    await user.type(screen.getByLabelText("Confirm password"), "abcdeg");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers when confirmation matches and omits the confirmation from the API call", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue(undefined);
    render(<AuthDialog open />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Email"), " ada@example.com ");
    await user.type(screen.getByLabelText("Password", { exact: true }), "abcdef");
    await user.type(screen.getByLabelText("Confirm password"), "abcdef");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith("ada@example.com", "abcdef");
    expect(register.mock.calls[0]).toHaveLength(2);
  });

  it("clears stale errors when switching between login and register", async () => {
    const user = userEvent.setup();
    render(<AuthDialog open />);

    await user.click(screen.getByRole("button", { name: "Login", exact: true }));
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    expect(screen.queryByText("Enter your email.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });
});
