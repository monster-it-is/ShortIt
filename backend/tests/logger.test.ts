import { describe, expect, it, vi } from "vitest";
import { logger, redactText, sanitizeLogMeta } from "../src/lib/logger";

describe("safe logging", () => {
	it("redacts MongoDB URIs, bearer tokens, and secret keys", () => {
		expect(redactText("failed mongodb://secret:27017/shortit and Bearer abc.def")).toContain("mongodb://[redacted]");
		expect(redactText("failed mongodb://secret:27017/shortit and Bearer abc.def")).not.toContain("secret:27017");
		expect(redactText("Authorization: Bearer abc.def")).not.toContain("abc.def");
		expect(redactText("Authorization: Bearer abc.def")).toMatch(/\[redacted\]/);

		const sanitized = sanitizeLogMeta({
			password: "secret123",
			token: "jwt-value",
			authorization: "Bearer abc",
			error: new Error("ECONNREFUSED mongodb://user:pass@localhost:27017/shortit"),
			path: "/api/user/login",
		});

		expect(sanitized?.password).toBe("[redacted]");
		expect(sanitized?.token).toBe("[redacted]");
		expect(sanitized?.authorization).toBe("[redacted]");
		expect(sanitized?.path).toBe("/api/user/login");
		expect(JSON.stringify(sanitized)).not.toContain("user:pass");
		expect(JSON.stringify(sanitized)).not.toContain("secret123");
	});

	it("does not print unexpected error secrets to the console payload", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		logger.error("Failed to login", {
			password: "secret123",
			error: new Error("JWT_SECRET=super-secret mongodb://u:p@db/shortit"),
		});

		const logged = spy.mock.calls.map((call) => String(call[0])).join(" ");
		expect(logged).toContain("Failed to login");
		expect(logged).not.toContain("secret123");
		expect(logged).not.toContain("super-secret");
		expect(logged).not.toContain("u:p@");
		spy.mockRestore();
	});
});
