import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  createLinkFormSchema,
  editLinkFormSchema,
  fieldErrorsFromZod,
  loginFormSchema,
  registerFormSchema,
} from "./validation";

const fieldError = (
  result: { success: true } | { success: false; error: z.ZodError },
  field: string
): string | undefined => {
  expect(result.success).toBe(false);
  if (result.success) {
    return undefined;
  }
  return fieldErrorsFromZod(result.error)[field];
};

describe("loginFormSchema", () => {
  it("rejects an empty or invalid email", () => {
    expect(fieldError(loginFormSchema.safeParse({ email: "", password: "x" }), "email")).toBe("Enter your email.");
    expect(fieldError(loginFormSchema.safeParse({ email: "   ", password: "x" }), "email")).toBe("Enter your email.");
    expect(fieldError(loginFormSchema.safeParse({ email: "not-an-email", password: "x" }), "email")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects an empty password and accepts any nonempty value", () => {
    expect(fieldError(loginFormSchema.safeParse({ email: "ada@example.com", password: "" }), "password")).toBe(
      "Password is required."
    );

    for (const password of ["x", "xy", "abcdef", " a", " "]) {
      const result = loginFormSchema.safeParse({ email: "ada@example.com", password });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe(password);
      }
    }
  });

  it("does not apply registration length rules to login passwords", () => {
    const short = loginFormSchema.safeParse({ email: "ada@example.com", password: "12345" });
    const long = loginFormSchema.safeParse({
      email: "ada@example.com",
      password: "a".repeat(MAX_PASSWORD_LENGTH + 1),
    });
    expect(short.success).toBe(true);
    expect(long.success).toBe(true);
  });

  it("trims and lowercases email without changing the password", () => {
    const result = loginFormSchema.safeParse({ email: "  Ada@Example.COM  ", password: " Secret " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.password).toBe(" Secret ");
    }
  });
});

describe("registerFormSchema", () => {
  it("rejects empty fields and invalid email", () => {
    const empty = registerFormSchema.safeParse({ email: "", password: "", confirmPassword: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const errors = fieldErrorsFromZod(empty.error);
      expect(errors.email).toBe("Enter your email.");
      expect(errors.password).toBe("Enter your password.");
      expect(errors.confirmPassword).toBe("Confirm your password.");
    }

    expect(
      fieldError(
        registerFormSchema.safeParse({
          email: "not-an-email",
          password: "abcdef",
          confirmPassword: "abcdef",
        }),
        "email"
      )
    ).toBe("Enter a valid email address.");
  });

  it("enforces the backend password length requirements", () => {
    expect(
      fieldError(
        registerFormSchema.safeParse({
          email: "ada@example.com",
          password: "12345",
          confirmPassword: "12345",
        }),
        "password"
      )
    ).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    expect(
      fieldError(
        registerFormSchema.safeParse({
          email: "ada@example.com",
          password: "a".repeat(MAX_PASSWORD_LENGTH + 1),
          confirmPassword: "a".repeat(MAX_PASSWORD_LENGTH + 1),
        }),
        "password"
      )
    ).toBe(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  });

  it("requires confirmation and rejects mismatches on the confirm field", () => {
    expect(
      fieldError(
        registerFormSchema.safeParse({
          email: "ada@example.com",
          password: "abcdef",
          confirmPassword: "",
        }),
        "confirmPassword"
      )
    ).toBe("Confirm your password.");

    const mismatch = registerFormSchema.safeParse({
      email: "ada@example.com",
      password: "abc123",
      confirmPassword: "abc124",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      const errors = fieldErrorsFromZod(mismatch.error);
      expect(errors.confirmPassword).toBe("Passwords do not match.");
      expect(errors.password).toBeUndefined();
    }
  });

  it("accepts matching passwords that meet the length requirements", () => {
    const result = registerFormSchema.safeParse({
      email: "  Ada@Example.COM  ",
      password: "abcdef",
      confirmPassword: "abcdef",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.password).toBe("abcdef");
      expect(result.data.confirmPassword).toBe("abcdef");
    }
  });
});

describe("link form schemas", () => {
  it("accepts http and https destinations", () => {
    expect(editLinkFormSchema.safeParse({ url: "https://example.com/path" }).success).toBe(true);
    expect(editLinkFormSchema.safeParse({ url: "http://localhost:8080/status" }).success).toBe(true);
    expect(createLinkFormSchema.safeParse({ url: "https://example.com/path", slug: "" }).success).toBe(true);
  });

  it("rejects empty, malformed, and unsafe URLs", () => {
    expect(fieldError(editLinkFormSchema.safeParse({ url: "" }), "url")).toBe("Enter a destination URL.");
    expect(fieldError(editLinkFormSchema.safeParse({ url: "javascript:alert(1)" }), "url")).toBe(
      "Only http and https URLs are allowed"
    );
    expect(fieldError(editLinkFormSchema.safeParse({ url: "ftp://example.com" }), "url")).toBe(
      "Only http and https URLs are allowed"
    );
    expect(fieldError(editLinkFormSchema.safeParse({ url: "not-a-url" }), "url")).toBe(
      "Enter a valid http or https URL"
    );
  });

  it("allows an empty custom slug and rejects reserved or invalid values", () => {
    const empty = createLinkFormSchema.safeParse({ url: "https://example.com", slug: "" });
    expect(empty.success).toBe(true);

    expect(fieldError(createLinkFormSchema.safeParse({ url: "https://example.com", slug: "home" }), "slug")).toBe(
      "This slug is reserved."
    );
    expect(fieldError(createLinkFormSchema.safeParse({ url: "https://example.com", slug: "My Link" }), "slug")).toBe(
      "Use lowercase letters, numbers, and hyphens only."
    );

    const valid = createLinkFormSchema.safeParse({ url: "https://example.com", slug: "my-link" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.slug).toBe("my-link");
    }
  });
});
