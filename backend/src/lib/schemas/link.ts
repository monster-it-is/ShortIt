import { z } from "zod";
import { destinationUrlSchema } from "../destinationUrl";
import { customSlugSchema, slugIdentifierSchema } from "../slug";

export const MAX_TITLE_LENGTH = 2048;

export const titleSchema = z
	.string({ error: "title is required" })
	.trim()
	.min(1, "title is required")
	.max(MAX_TITLE_LENGTH, "title is too long");

const optionalCreateSlugSchema = z
	.unknown()
	.optional()
	.transform((value) => (typeof value === "string" && value.trim() ? value : undefined))
	.pipe(customSlugSchema.optional());

export const createLinkBodySchema = z.object({
	title: titleSchema,
	url: destinationUrlSchema,
	slug: optionalCreateSlugSchema,
});

export const updateLinkBodySchema = z
	.object({
		slug: slugIdentifierSchema,
		title: titleSchema.optional(),
		url: destinationUrlSchema.optional(),
	})
	.refine((data) => data.title !== undefined || data.url !== undefined, {
		message: "Nothing to update",
	});

export const deleteLinkInputSchema = z.object({
	slug: slugIdentifierSchema,
});

export const resolveSlugParamSchema = z
	.string({ error: "slug is required" })
	.trim()
	.min(1, "slug is required");

export type CreateLinkBody = z.infer<typeof createLinkBodySchema>;
export type UpdateLinkBody = z.infer<typeof updateLinkBodySchema>;
