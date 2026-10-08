import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { isMongoDuplicateKeyError } from "../lib/credentials";
import { parseDestinationUrl } from "../lib/destinationUrl";
import { logger } from "../lib/logger";
import {
	createLinkBodySchema,
	deleteLinkInputSchema,
	resolveSlugParamSchema,
	updateLinkBodySchema,
} from "../lib/schemas/link";
import {
	UniqueSlugExhaustedError,
	createWithGeneratedSlug,
	isValidSlugFormat,
	normalizeSlug,
} from "../lib/slug";
import { parseWithZod } from "../lib/zod";
import { authMiddleware } from "../middleware/auth";
import { Link } from "../models/Link";

export const linkRouter = Router();

const isDuplicateSlugError = (error: unknown): boolean => isMongoDuplicateKeyError(error, "slug");

const isMongooseValidationError = (error: unknown): boolean => {
	return Boolean(error && typeof error === "object" && (error as { name?: string }).name === "ValidationError");
};

const toLinkResponse = (link: {
	_id: Types.ObjectId;
	title: string;
	slug: string;
	url: string;
	clicks: number;
}) => ({
	id: link._id.toString(),
	title: link.title,
	slug: link.slug,
	url: link.url,
	clicks: link.clicks,
});

const getAuthenticatedUserId = (req: Request, res: Response): string | null => {
	const userId = req.userId;
	if (!userId || !Types.ObjectId.isValid(userId)) {
		res.status(401).json({ message: "Unauthorized" });
		return null;
	}

	return userId;
};

const sendCreateError = (res: Response, error: unknown): void => {
	if (error instanceof UniqueSlugExhaustedError) {
		res.status(500).json({ message: "Could not generate a unique slug. Please try again." });
		return;
	}

	if (isDuplicateSlugError(error)) {
		res.status(409).json({ message: "Slug already exists" });
		return;
	}

	if (isMongooseValidationError(error)) {
		res.status(400).json({ message: "Invalid link data" });
		return;
	}

	logger.error("Failed to create link", { error });
	res.status(500).json({ message: "Failed to create link" });
};

linkRouter.get("/resolve/:slug", async (req, res) => {
	try {
		const parsedSlug = parseWithZod(resolveSlugParamSchema, req.params.slug);
		if (!parsedSlug.success) {
			res.status(400).json({ message: parsedSlug.message });
			return;
		}

		const slug = normalizeSlug(parsedSlug.data);
		if (!isValidSlugFormat(slug)) {
			res.status(404).json({ message: "Link not found" });
			return;
		}

		const link = await Link.findOne({ slug });
		if (!link) {
			res.status(404).json({ message: "Link not found" });
			return;
		}

		const destination = parseDestinationUrl(link.url);
		if ("message" in destination) {
			res.status(400).json({ message: "Link destination is invalid" });
			return;
		}

		const updated = await Link.findOneAndUpdate({ _id: link._id }, { $inc: { clicks: 1 } }, { new: true });
		if (!updated) {
			res.status(404).json({ message: "Link not found" });
			return;
		}

		res.json({ slug: updated.slug, url: updated.url, clicks: updated.clicks });
	} catch (error) {
		logger.error("Failed to resolve link", { error });
		res.status(500).json({ message: "Failed to resolve link" });
	}
});

linkRouter.get("/", authMiddleware, async (req, res) => {
	try {
		const userId = getAuthenticatedUserId(req, res);
		if (!userId) {
			return;
		}

		const links = await Link.find({ userId }).sort({ createdAt: -1 });

		res.json({ links: links.map((link) => toLinkResponse(link)) });
	} catch (error) {
		logger.error("Failed to fetch links", { error });
		res.status(500).json({ message: "Failed to fetch links" });
	}
});

linkRouter.post("/create", authMiddleware, async (req, res) => {
	try {
		const userId = getAuthenticatedUserId(req, res);
		if (!userId) {
			return;
		}

		const parsed = parseWithZod(createLinkBodySchema, req.body);
		if (!parsed.success) {
			res.status(400).json({ message: parsed.message });
			return;
		}

		const fields = {
			title: parsed.data.title,
			url: parsed.data.url,
			userId,
			clicks: 0,
		};

		if (parsed.data.slug) {
			const existingSlug = await Link.findOne({ slug: parsed.data.slug }).select("_id");
			if (existingSlug) {
				res.status(409).json({ message: "Slug already exists" });
				return;
			}

			const link = await Link.create({
				...fields,
				slug: parsed.data.slug,
			});

			res.status(201).json({ message: "Link created", link: toLinkResponse(link) });
			return;
		}

		const link = await createWithGeneratedSlug(
			(slug) => Link.create({ ...fields, slug }),
			isDuplicateSlugError
		);

		res.status(201).json({ message: "Link created", link: toLinkResponse(link) });
	} catch (error) {
		sendCreateError(res, error);
	}
});

linkRouter.post("/update", authMiddleware, async (req, res) => {
	try {
		const userId = getAuthenticatedUserId(req, res);
		if (!userId) {
			return;
		}

		const parsed = parseWithZod(updateLinkBodySchema, req.body);
		if (!parsed.success) {
			res.status(400).json({ message: parsed.message });
			return;
		}

		const data: { title?: string; url?: string } = {};
		if (parsed.data.title !== undefined) {
			data.title = parsed.data.title;
		}
		if (parsed.data.url !== undefined) {
			data.url = parsed.data.url;
		}

		const updated = await Link.findOneAndUpdate(
			{ slug: parsed.data.slug, userId },
			{ $set: data },
			{ new: true, runValidators: true }
		);

		if (!updated) {
			res.status(404).json({ message: "Link not found" });
			return;
		}

		res.json({ message: "Link updated", link: toLinkResponse(updated) });
	} catch (error) {
		if (isMongooseValidationError(error)) {
			res.status(400).json({ message: "Invalid link data" });
			return;
		}

		logger.error("Failed to update link", { error });
		res.status(500).json({ message: "Failed to update link" });
	}
});

linkRouter.delete("/", authMiddleware, async (req, res) => {
	try {
		const userId = getAuthenticatedUserId(req, res);
		if (!userId) {
			return;
		}

		const slugFromBody = (req.body as { slug?: unknown } | undefined)?.slug;
		const slugFromQuery = req.query.slug;
		const parsed = parseWithZod(deleteLinkInputSchema, { slug: slugFromBody ?? slugFromQuery });
		if (!parsed.success) {
			res.status(400).json({ message: parsed.message });
			return;
		}

		const deleted = await Link.deleteOne({ slug: parsed.data.slug, userId });

		if (deleted.deletedCount === 0) {
			res.status(404).json({ message: "Link not found" });
			return;
		}

		res.json({ message: "Link deleted" });
	} catch (error) {
		logger.error("Failed to delete link", { error });
		res.status(500).json({ message: "Failed to delete link" });
	}
});
