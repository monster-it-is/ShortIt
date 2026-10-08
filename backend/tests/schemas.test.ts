import { describe, expect, it } from "vitest";
import { loginBodySchema, signupBodySchema } from "../src/lib/schemas/auth";
import {
	createLinkBodySchema,
	deleteLinkInputSchema,
	updateLinkBodySchema,
} from "../src/lib/schemas/link";

describe("loginBodySchema", () => {
	it("requires email and a nonempty password without registration length rules", () => {
		expect(loginBodySchema.safeParse({}).success).toBe(false);
		expect(loginBodySchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);

		const oneCharacter = loginBodySchema.safeParse({ email: "ada@example.com", password: "x" });
		expect(oneCharacter.success).toBe(true);
		if (oneCharacter.success) {
			expect(oneCharacter.data.password).toBe("x");
		}

		const twoCharacter = loginBodySchema.safeParse({ email: "ada@example.com", password: "xy" });
		expect(twoCharacter.success).toBe(true);

		const padded = loginBodySchema.safeParse({ email: "ada@example.com", password: " secret " });
		expect(padded.success).toBe(true);
		if (padded.success) {
			expect(padded.data.password).toBe(" secret ");
		}
	});

	it("normalizes email without changing the password", () => {
		const result = loginBodySchema.safeParse({
			email: "  Ada@Example.COM  ",
			password: " Secret123 ",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe("ada@example.com");
			expect(result.data.password).toBe(" Secret123 ");
		}
	});
});

describe("signupBodySchema", () => {
	it("enforces password length and valid email", () => {
		const short = signupBodySchema.safeParse({ email: "ada@example.com", password: "12345" });
		expect(short.success).toBe(false);

		const long = signupBodySchema.safeParse({
			email: "ada@example.com",
			password: "a".repeat(129),
		});
		expect(long.success).toBe(false);

		const invalidEmail = signupBodySchema.safeParse({
			email: "not-an-email",
			password: "secret123",
		});
		expect(invalidEmail.success).toBe(false);

		const valid = signupBodySchema.safeParse({ email: "ada@example.com", password: "secret123" });
		expect(valid.success).toBe(true);
	});
});

describe("link request schemas", () => {
	it("accepts http and https URLs and valid custom slugs", () => {
		expect(
			createLinkBodySchema.safeParse({
				title: "Docs",
				url: "https://example.com",
				slug: "my-link",
			}).success
		).toBe(true);
		expect(
			createLinkBodySchema.safeParse({
				title: "Local",
				url: "http://localhost:8080/status",
			}).success
		).toBe(true);
	});

	it("rejects unsafe protocols, reserved slugs, and invalid titles", () => {
		expect(
			createLinkBodySchema.safeParse({
				title: "Bad",
				url: "javascript:alert(1)",
			}).success
		).toBe(false);
		expect(
			createLinkBodySchema.safeParse({
				title: "Docs",
				url: "https://example.com",
				slug: "home",
			}).success
		).toBe(false);
		expect(
			createLinkBodySchema.safeParse({
				title: "   ",
				url: "https://example.com",
			}).success
		).toBe(false);
	});

	it("requires a slug and at least one updatable field", () => {
		expect(updateLinkBodySchema.safeParse({ slug: "docs" }).success).toBe(false);
		expect(
			updateLinkBodySchema.safeParse({ slug: "docs", url: "https://example.com/new" }).success
		).toBe(true);
		expect(deleteLinkInputSchema.safeParse({}).success).toBe(false);
		expect(deleteLinkInputSchema.safeParse({ slug: "docs" }).success).toBe(true);
	});
});
