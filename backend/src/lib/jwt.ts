import jwt from "jsonwebtoken";
import { getConfig } from "./config";

const JWT_ALGORITHM = "HS256" as const;

type AuthPayload = {
	userId?: string;
};

export const signAuthToken = (userId: string, expiresIn: jwt.SignOptions["expiresIn"] = "7d"): string => {
	return jwt.sign({ userId }, getConfig().jwtSecret, {
		algorithm: JWT_ALGORITHM,
		expiresIn,
	});
};

export const verifyAuthToken = (token: string): { userId: string } => {
	const payload = jwt.verify(token, getConfig().jwtSecret, {
		algorithms: [JWT_ALGORITHM],
	}) as AuthPayload;
	if (!payload.userId || typeof payload.userId !== "string") {
		throw new Error("Invalid token payload");
	}

	return { userId: payload.userId };
};
