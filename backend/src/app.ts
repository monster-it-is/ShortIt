import cors from "cors";
import express from "express";
import helmet from "helmet";
import { getConfig } from "./lib/config";
import { errorHandler, notFoundHandler } from "./lib/httpErrors";
import { createRateLimiters } from "./lib/rateLimits";
import { linkRouter } from "./routes/linkRouter";
import { userRouter } from "./routes/userRouter";

export const createApp = () => {
	const config = getConfig();
	const app = express();
	const rateLimiters = createRateLimiters(config);

	app.locals.resetRateLimits = rateLimiters.reset;
	app.disable("x-powered-by");

	if (config.trustProxy !== false) {
		app.set("trust proxy", config.trustProxy);
	}

	app.use(
		helmet({
			contentSecurityPolicy: false,
			crossOriginEmbedderPolicy: false,
			strictTransportSecurity:
				config.nodeEnv === "production"
					? { maxAge: 15552000, includeSubDomains: true }
					: false,
		})
	);

	app.use(
		cors({
			origin: (origin, callback) => {
				if (!origin) {
					callback(null, true);
					return;
				}

				if (config.corsOrigins.includes(origin)) {
					callback(null, true);
					return;
				}

				callback(null, false);
			},
			methods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			maxAge: 600,
		})
	);

	app.use(express.json({ limit: "32kb" }));

	app.get("/api/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.use("/api/user/signup", rateLimiters.signupLimiter);
	app.use("/api/user/login", rateLimiters.loginLimiter);
	app.use("/api/link/resolve", rateLimiters.resolveLimiter);

	app.use("/api/user", userRouter);
	app.use("/api/link", linkRouter);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
};
