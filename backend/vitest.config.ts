import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		fileParallelism: false,
		hookTimeout: 300000,
		testTimeout: 30000,
		env: {
			NODE_ENV: "test",
			JWT_SECRET: "test-jwt-secret-value-do-not-use-elsewhere",
			CORS_ORIGIN: "http://localhost:5173",
			PORT: "8080",
			MONGODB_URI: "mongodb://127.0.0.1:27017/shortit-unused-placeholder",
			RATE_LIMIT_LOGIN_MAX: "1000",
			RATE_LIMIT_SIGNUP_MAX: "1000",
			RATE_LIMIT_RESOLVE_MAX: "1000",
		},
	},
});
