import { describe, expect, it } from "vitest";
import { isMongoDuplicateKeyError } from "../src/lib/credentials";
import {
	AUTO_SLUG_LENGTH,
	MAX_AUTO_SLUG_ATTEMPTS,
	RESERVED_SLUGS,
	UniqueSlugExhaustedError,
	createWithGeneratedSlug,
	generateRandomSlug,
	isReservedSlug,
	parseCustomSlug,
} from "../src/lib/slug";

describe("reserved and custom slugs", () => {
	it("rejects reserved path segments regardless of case", () => {
		for (const reserved of RESERVED_SLUGS) {
			expect(isReservedSlug(reserved)).toBe(true);
			expect(isReservedSlug(reserved.toUpperCase())).toBe(true);
			expect(parseCustomSlug(reserved)).toEqual({ message: "This slug is reserved" });
			expect(parseCustomSlug(`  ${reserved.toUpperCase()}  `)).toEqual({
				message: "This slug is reserved",
			});
		}

		expect(parseCustomSlug("homepage")).toEqual({ slug: "homepage" });
		expect(parseCustomSlug("my-home")).toEqual({ slug: "my-home" });
		expect(parseCustomSlug("Home-Page")).toEqual({ slug: "home-page" });
	});

	it("rejects invalid custom slug formats", () => {
		expect(parseCustomSlug("hello_world")).toEqual({
			message: "Invalid slug. Use lowercase letters, numbers, and hyphens only",
		});
		expect(parseCustomSlug("foo/bar")).toEqual({
			message: "Invalid slug. Use lowercase letters, numbers, and hyphens only",
		});
		expect(parseCustomSlug("ok slug")).toEqual({
			message: "Invalid slug. Use lowercase letters, numbers, and hyphens only",
		});
	});
});

describe("automatic slug generation", () => {
	it("produces URL-safe slugs of the expected length", () => {
		for (let i = 0; i < 20; i += 1) {
			const slug = generateRandomSlug();
			expect(slug).toMatch(/^[a-z0-9]+$/);
			expect(slug).toHaveLength(AUTO_SLUG_LENGTH);
			expect(isReservedSlug(slug)).toBe(false);
		}
	});

	it("retries duplicate generated slugs a bounded number of times", async () => {
		let attempts = 0;
		const duplicate = Object.assign(new Error("E11000 duplicate key"), {
			code: 11000,
			keyPattern: { slug: 1 },
		});

		await expect(
			createWithGeneratedSlug(async () => {
				attempts += 1;
				throw duplicate;
			}, (error) => isMongoDuplicateKeyError(error, "slug"))
		).rejects.toBeInstanceOf(UniqueSlugExhaustedError);

		expect(attempts).toBe(MAX_AUTO_SLUG_ATTEMPTS);
	});
});
