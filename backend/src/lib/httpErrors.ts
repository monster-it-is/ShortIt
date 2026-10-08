import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

export const notFoundHandler = (_req: Request, res: Response): void => {
	res.status(404).json({ message: "Not found" });
};

const isJsonParseError = (error: unknown): boolean => {
	if (!error || typeof error !== "object") {
		return false;
	}

	const typed = error as { type?: string; status?: number; body?: unknown };
	return typed.type === "entity.parse.failed" || (error instanceof SyntaxError && "body" in error);
};

const isPayloadTooLarge = (error: unknown): boolean => {
	if (!error || typeof error !== "object") {
		return false;
	}

	return (error as { type?: string; status?: number }).type === "entity.too.large";
};

export const errorHandler = (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
	if (res.headersSent) {
		next(error);
		return;
	}

	if (isJsonParseError(error)) {
		res.status(400).json({ message: "Invalid JSON" });
		return;
	}

	if (isPayloadTooLarge(error)) {
		res.status(413).json({ message: "Request body is too large" });
		return;
	}

	logger.error("Unhandled request error", {
		error,
	});

	res.status(500).json({ message: "Internal server error" });
};
