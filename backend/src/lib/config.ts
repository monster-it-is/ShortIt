import dotenv from "dotenv";

const isE2E = process.env.SHORTIT_E2E === "true";

if (process.env.VITEST !== "true" && !isE2E) {
	dotenv.config();
}

export type RateLimitConfig = {
	windowMs: number;
	limit: number;
};

export type AppConfig = {
	mongoUri: string;
	jwtSecret: string;
	port: number;
	listenHost: string;
	corsOrigins: string[];
	nodeEnv: string;
	trustProxy: false | number;
	authRateLimit: {
		windowMs: number;
		loginLimit: number;
		signupLimit: number;
	};
	resolveRateLimit: RateLimitConfig;
};

const DEFAULT_DEV_CORS_ORIGINS = ["http://localhost:5173"];
const DEFAULT_PORT = 8080;
const DEFAULT_LISTEN_HOST = "0.0.0.0";
const MIN_JWT_SECRET_LENGTH = 16;
const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const RESOLVE_WINDOW_MS = 60 * 1000;

const requireEnv = (name: string): string => {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
};

const assertAllowedCorsOrigin = (origin: string): string => {
	if (origin === "*" || origin.toLowerCase() === "null") {
		throw new Error("CORS_ORIGIN cannot be * or null");
	}

	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch {
		throw new Error(`CORS_ORIGIN is not a valid origin: ${origin}`);
	}

	if (parsed.origin !== origin) {
		throw new Error(`CORS_ORIGIN must be an origin without a path or query: ${origin}`);
	}

	return origin;
};

const parseCorsOrigins = (nodeEnv: string): string[] => {
	const fromEnv = process.env.CORS_ORIGIN?.split(",")
		.map((origin) => origin.trim().replace(/\/+$/, ""))
		.filter(Boolean);

	if (fromEnv && fromEnv.length > 0) {
		return fromEnv.map((origin) => assertAllowedCorsOrigin(origin));
	}

	if (nodeEnv === "production") {
		throw new Error("CORS_ORIGIN is not set");
	}

	return DEFAULT_DEV_CORS_ORIGINS;
};

const parseListenHost = (): string => {
	const raw = process.env.HOST?.trim();
	if (!raw) {
		return DEFAULT_LISTEN_HOST;
	}

	return raw;
};

const parsePort = (): number => {
	const raw = process.env.PORT?.trim();
	if (!raw) {
		return DEFAULT_PORT;
	}

	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("PORT must be an integer between 1 and 65535");
	}

	return port;
};

const parsePositiveInt = (name: string, fallback: number): number => {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be a positive integer`);
	}

	return value;
};

/**
 * Trust a fixed number of reverse-proxy hops. Do not use `true` (trusts all).
 * Unset/0/false: use the socket address (safe local default).
 */
const parseTrustProxy = (): false | number => {
	const raw = process.env.TRUST_PROXY?.trim().toLowerCase();
	if (!raw || raw === "0" || raw === "false") {
		return false;
	}

	if (raw === "true") {
		throw new Error("TRUST_PROXY=true is not allowed; set a hop count such as 1");
	}

	const hops = Number(raw);
	if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
		throw new Error("TRUST_PROXY must be a hop count between 1 and 10, or unset");
	}

	return hops;
};

export const E2E_DB_NAME = "shortit-e2e";

/**
 * E2E traffic must use an ephemeral loopback MongoDB, never Atlas or :27017.
 */
export const assertIsolatedMongoUri = (uri: string): void => {
	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch {
		throw new Error("SHORTIT_E2E MONGODB_URI is not a valid URI");
	}

	if (parsed.protocol !== "mongodb:") {
		throw new Error("SHORTIT_E2E MONGODB_URI must use mongodb:// (not mongodb+srv)");
	}

	const host = parsed.hostname.toLowerCase();
	if (host !== "127.0.0.1" && host !== "localhost") {
		throw new Error("SHORTIT_E2E MONGODB_URI must use a loopback host");
	}

	if (host.includes("mongodb.net") || parsed.username || parsed.password) {
		throw new Error("SHORTIT_E2E MONGODB_URI cannot use remote or credentialed hosts");
	}

	if (!parsed.port || parsed.port === "27017") {
		throw new Error("SHORTIT_E2E MONGODB_URI cannot use the default MongoDB port 27017");
	}

	const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
	if (dbName !== E2E_DB_NAME) {
		throw new Error(`SHORTIT_E2E MONGODB_URI must use database name ${E2E_DB_NAME}`);
	}
};

const parseJwtSecret = (nodeEnv: string): string => {
	const jwtSecret = requireEnv("JWT_SECRET");
	const minLength = nodeEnv === "production" ? MIN_PRODUCTION_JWT_SECRET_LENGTH : MIN_JWT_SECRET_LENGTH;
	if (jwtSecret.length < minLength) {
		throw new Error(`JWT_SECRET must be at least ${minLength} characters`);
	}

	return jwtSecret;
};

export const getConfig = (): AppConfig => {
	const nodeEnv = process.env.NODE_ENV?.trim() || "development";
	const isProduction = nodeEnv === "production";
	const mongoUri = requireEnv("MONGODB_URI");

	if (process.env.SHORTIT_E2E === "true") {
		assertIsolatedMongoUri(mongoUri);
	}

	return {
		mongoUri,
		jwtSecret: parseJwtSecret(nodeEnv),
		port: parsePort(),
		listenHost: parseListenHost(),
		corsOrigins: parseCorsOrigins(nodeEnv),
		nodeEnv,
		trustProxy: parseTrustProxy(),
		authRateLimit: {
			windowMs: AUTH_WINDOW_MS,
			loginLimit: parsePositiveInt("RATE_LIMIT_LOGIN_MAX", isProduction ? 10 : 20),
			signupLimit: parsePositiveInt("RATE_LIMIT_SIGNUP_MAX", isProduction ? 5 : 10),
		},
		resolveRateLimit: {
			windowMs: RESOLVE_WINDOW_MS,
			limit: parsePositiveInt("RATE_LIMIT_RESOLVE_MAX", isProduction ? 120 : 300),
		},
	};
};
