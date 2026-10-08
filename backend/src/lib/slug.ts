import { randomInt } from "crypto";
import { z } from "zod";
import { firstZodMessage } from "./zod";

export const AUTO_SLUG_LENGTH = 8;
export const MAX_AUTO_SLUG_ATTEMPTS = 8;
export const MAX_SLUG_LENGTH = 64;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Path segments that would collide with the SPA or static hosting.
 * Keep this list minimal: only real first-segment conflicts.
 *
 * - home: React route `/home`
 * - api: Vite `/api` proxy (and typical same-origin API prefix)
 * - assets: Vite production asset directory `/assets`
 */
export const RESERVED_SLUGS = new Set(["home", "api", "assets"]);

export class UniqueSlugExhaustedError extends Error {
	constructor() {
		super("Could not generate a unique slug");
		this.name = "UniqueSlugExhaustedError";
	}
}

export const normalizeSlug = (value: string): string => value.trim().toLowerCase();

export const isReservedSlug = (value: string): boolean => {
	return RESERVED_SLUGS.has(normalizeSlug(value));
};

export const isValidSlugFormat = (value: string): boolean => {
	return SLUG_PATTERN.test(value);
};

export const isUsableSlug = (value: string): boolean => {
	if (!value || value.length > MAX_SLUG_LENGTH || !isValidSlugFormat(value)) {
		return false;
	}

	return !isReservedSlug(value);
};

export const customSlugSchema = z
	.string({ error: "Invalid slug. Use lowercase letters, numbers, and hyphens only" })
	.trim()
	.toLowerCase()
	.min(1, "Invalid slug. Use lowercase letters, numbers, and hyphens only")
	.max(MAX_SLUG_LENGTH, "slug is too long")
	.regex(SLUG_PATTERN, "Invalid slug. Use lowercase letters, numbers, and hyphens only")
	.refine((slug) => !RESERVED_SLUGS.has(slug), { message: "This slug is reserved" });

export const slugIdentifierSchema = z
	.string({ error: "slug is required" })
	.trim()
	.min(1, "slug is required")
	.toLowerCase()
	.regex(SLUG_PATTERN, "Invalid slug");

export const parseCustomSlug = (value: unknown): { slug: string } | { message: string } => {
	const result = customSlugSchema.safeParse(value);
	if (!result.success) {
		return { message: firstZodMessage(result.error, "Invalid slug. Use lowercase letters, numbers, and hyphens only") };
	}

	return { slug: result.data };
};

export const generateRandomSlug = (length = AUTO_SLUG_LENGTH): string => {
	let slug = "";

	while (slug.length < length) {
		slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
	}

	return slug;
};

export const createWithGeneratedSlug = async <T>(
	create: (slug: string) => Promise<T>,
	isDuplicate: (error: unknown) => boolean
): Promise<T> => {
	for (let attempt = 1; attempt <= MAX_AUTO_SLUG_ATTEMPTS; attempt += 1) {
		try {
			return await create(generateRandomSlug());
		} catch (error) {
			if (isDuplicate(error) && attempt < MAX_AUTO_SLUG_ATTEMPTS) {
				continue;
			}

			if (isDuplicate(error)) {
				throw new UniqueSlugExhaustedError();
			}

			throw error;
		}
	}

	throw new UniqueSlugExhaustedError();
};
