import { rateLimit, MemoryStore, type RateLimitRequestHandler } from "express-rate-limit";
import type { AppConfig } from "./config";

export type RateLimiters = {
	loginLimiter: RateLimitRequestHandler;
	signupLimiter: RateLimitRequestHandler;
	resolveLimiter: RateLimitRequestHandler;
	reset: () => Promise<void>;
};

const tooManyRequests = "Too many requests. Try again later.";

const buildLimiter = (store: MemoryStore, windowMs: number, limit: number): RateLimitRequestHandler => {
	return rateLimit({
		windowMs,
		limit,
		store,
		standardHeaders: true,
		legacyHeaders: false,
		validate: { xForwardedForHeader: false },
		skip: (req) => req.method === "OPTIONS",
		handler: (req, res, _next, options) => {
			const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
			res.setHeader("Retry-After", String(retryAfterSeconds));
			res.status(options.statusCode).json({ message: tooManyRequests });
		},
	});
};

export const createRateLimiters = (config: AppConfig): RateLimiters => {
	const loginStore = new MemoryStore();
	const signupStore = new MemoryStore();
	const resolveStore = new MemoryStore();

	return {
		loginLimiter: buildLimiter(loginStore, config.authRateLimit.windowMs, config.authRateLimit.loginLimit),
		signupLimiter: buildLimiter(signupStore, config.authRateLimit.windowMs, config.authRateLimit.signupLimit),
		resolveLimiter: buildLimiter(
			resolveStore,
			config.resolveRateLimit.windowMs,
			config.resolveRateLimit.limit
		),
		reset: async () => {
			await Promise.all([loginStore.resetAll(), signupStore.resetAll(), resolveStore.resetAll()]);
		},
	};
};
