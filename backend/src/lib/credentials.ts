import { loginBodySchema, signupBodySchema, type LoginBody, type SignupBody } from "./schemas/auth";
import { parseWithZod } from "./zod";

export type ParsedCredentials = SignupBody;

export const parseSignupBody = (body: unknown): SignupBody | { message: string } => {
	const parsed = parseWithZod(signupBodySchema, body);
	return parsed.success ? parsed.data : { message: parsed.message };
};

export const parseLoginBody = (body: unknown): LoginBody | { message: string } => {
	const parsed = parseWithZod(loginBodySchema, body);
	return parsed.success ? parsed.data : { message: parsed.message };
};

export const isMongoDuplicateKeyError = (error: unknown, field: string): boolean => {
	if (!error || typeof error !== "object" || !("code" in error)) {
		return false;
	}

	if ((error as { code?: number }).code !== 11000) {
		return false;
	}

	const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
	const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue;
	return Boolean(keyPattern?.[field] || keyValue?.[field]);
};
