import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../lib/jwt";

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const authHeader = req.headers.authorization;
	if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	const token = authHeader.slice(7).trim();
	if (!token) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const payload = verifyAuthToken(token);
		req.userId = payload.userId;
		next();
	} catch {
		res.status(401).json({ message: "Invalid or expired token" });
	}
};
