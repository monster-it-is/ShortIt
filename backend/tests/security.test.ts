process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-value-do-not-use-elsewhere";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/shortit-unused-placeholder";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import { connectToDatabase, disconnectFromDatabase } from "../src/lib/db";
import { User } from "../src/models/User";
import { Link } from "../src/models/Link";
import { getConfig } from "../src/lib/config";

let mongo: MongoMemoryServer;
let app: Express;

const password = "secret123";
const previousRateLimits = {
	login: process.env.RATE_LIMIT_LOGIN_MAX,
	signup: process.env.RATE_LIMIT_SIGNUP_MAX,
	resolve: process.env.RATE_LIMIT_RESOLVE_MAX,
};

const restoreRateLimitEnv = () => {
	const restore = (name: "RATE_LIMIT_LOGIN_MAX" | "RATE_LIMIT_SIGNUP_MAX" | "RATE_LIMIT_RESOLVE_MAX", previous: string | undefined) => {
		if (previous === undefined) {
			delete process.env[name];
			return;
		}

		process.env[name] = previous;
	};

	restore("RATE_LIMIT_LOGIN_MAX", previousRateLimits.login);
	restore("RATE_LIMIT_SIGNUP_MAX", previousRateLimits.signup);
	restore("RATE_LIMIT_RESOLVE_MAX", previousRateLimits.resolve);
};

const signup = async (email: string) => {
	const response = await request(app).post("/api/user/signup").send({ email, password });
	expect(response.status).toBe(201);
	return {
		token: response.body.token as string,
		id: response.body.user.id as string,
	};
};

beforeAll(async () => {
	process.env.RATE_LIMIT_LOGIN_MAX = "3";
	process.env.RATE_LIMIT_SIGNUP_MAX = "3";
	process.env.RATE_LIMIT_RESOLVE_MAX = "3";
	mongo = await MongoMemoryServer.create();
	process.env.MONGODB_URI = mongo.getUri();
	await connectToDatabase();
	const { createApp } = await import("../src/app");
	app = createApp();
});

beforeEach(async () => {
	await Link.deleteMany({});
	await User.deleteMany({});
	await app.locals.resetRateLimits?.();
});

afterAll(async () => {
	restoreRateLimitEnv();
	await disconnectFromDatabase();
	if (mongo) {
		await mongo.stop();
	}
});

describe("rate limiting", () => {
	it("returns 429 with Retry-After after too many login attempts", async () => {
		await signup("limit-login@example.com");
		await app.locals.resetRateLimits?.();

		for (let i = 0; i < 3; i += 1) {
			const allowed = await request(app)
				.post("/api/user/login")
				.send({ email: "limit-login@example.com", password: "wrong-password" });
			expect(allowed.status).toBe(401);
		}

		const blocked = await request(app)
			.post("/api/user/login")
			.send({ email: "limit-login@example.com", password: "wrong-password" });

		expect(blocked.status).toBe(429);
		expect(blocked.body).toEqual({ message: "Too many requests. Try again later." });
		expect(blocked.headers["retry-after"]).toBeTruthy();
	});

	it("returns 429 after too many registration attempts", async () => {
		for (let i = 0; i < 3; i += 1) {
			const response = await request(app)
				.post("/api/user/signup")
				.send({ email: `limit-signup-${i}@example.com`, password });
			expect(response.status).toBe(201);
		}

		const blocked = await request(app)
			.post("/api/user/signup")
			.send({ email: "limit-signup-overflow@example.com", password });

		expect(blocked.status).toBe(429);
		expect(blocked.body.message).toBe("Too many requests. Try again later.");
		expect(blocked.headers["retry-after"]).toBeTruthy();
	});
});

describe("security headers", () => {
	it("sends browser-relevant API headers and hides Express identity", async () => {
		const response = await request(app).get("/api/health");

		expect(response.status).toBe(200);
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["referrer-policy"]).toBeTruthy();
		expect(response.headers["x-frame-options"]?.toLowerCase()).toBe("sameorigin");
		expect(response.headers["x-powered-by"]).toBeUndefined();
	});
});

describe("JWT authentication", () => {
	it("rejects missing, malformed, expired, and wrongly signed tokens", async () => {
		const { token, id } = await signup("jwt-user@example.com");

		const missing = await request(app).get("/api/user");
		expect(missing.status).toBe(401);

		const malformed = await request(app).get("/api/user").set("Authorization", "Token abc");
		expect(malformed.status).toBe(401);

		const emptyBearer = await request(app).get("/api/user").set("Authorization", "Bearer ");
		expect(emptyBearer.status).toBe(401);

		const garbage = await request(app).get("/api/user").set("Authorization", "Bearer not-a-real-token");
		expect(garbage.status).toBe(401);
		expect(garbage.body.message).toBe("Invalid or expired token");

		const expired = jwt.sign(
			{ userId: id, exp: Math.floor(Date.now() / 1000) - 30 },
			process.env.JWT_SECRET as string,
			{ algorithm: "HS256" }
		);
		const expiredResponse = await request(app).get("/api/user").set("Authorization", `Bearer ${expired}`);
		expect(expiredResponse.status).toBe(401);

		const forged = jwt.sign({ userId: id }, "some-other-secret-value-not-configured", {
			algorithm: "HS256",
			expiresIn: "7d",
		});
		const forgedResponse = await request(app).get("/api/user").set("Authorization", `Bearer ${forged}`);
		expect(forgedResponse.status).toBe(401);

		const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
		const nonePayload = Buffer.from(JSON.stringify({ userId: id })).toString("base64url");
		const noneToken = `${noneHeader}.${nonePayload}.`;
		const noneResponse = await request(app).get("/api/user").set("Authorization", `Bearer ${noneToken}`);
		expect(noneResponse.status).toBe(401);

		const wrongAlg = jwt.sign({ userId: id }, process.env.JWT_SECRET as string, {
			algorithm: "HS384",
			expiresIn: "7d",
		});
		const wrongAlgResponse = await request(app).get("/api/user").set("Authorization", `Bearer ${wrongAlg}`);
		expect(wrongAlgResponse.status).toBe(401);

		const valid = await request(app).get("/api/user").set("Authorization", `Bearer ${token}`);
		expect(valid.status).toBe(200);
		expect(valid.body.password).toBeUndefined();
		expect(JSON.stringify(valid.body)).not.toMatch(/\$2[aby]\$/);
	});
});

describe("authorization isolation", () => {
	it("returns 404 for another user's private link without allowing mutation", async () => {
		const owner = await signup("owner-sec@example.com");
		const other = await signup("other-sec@example.com");
		await request(app)
			.post("/api/link/create")
			.set("Authorization", `Bearer ${owner.token}`)
			.send({ title: "Private", url: "https://example.com/private", slug: "private-sec" });

		const update = await request(app)
			.post("/api/link/update")
			.set("Authorization", `Bearer ${other.token}`)
			.send({ slug: "private-sec", url: "https://evil.example/takeover" });
		expect(update.status).toBe(404);
		expect(update.body.message).toBe("Link not found");

		const missing = await request(app)
			.post("/api/link/update")
			.set("Authorization", `Bearer ${other.token}`)
			.send({ slug: "no-such-link", url: "https://example.com/new" });
		expect(missing.status).toBe(404);
		expect(missing.body.message).toBe("Link not found");

		const stored = await Link.findOne({ slug: "private-sec" });
		expect(stored?.url).toBe("https://example.com/private");
		expect(stored?.userId.toString()).toBe(owner.id);

		const remove = await request(app)
			.delete("/api/link")
			.set("Authorization", `Bearer ${other.token}`)
			.send({ slug: "private-sec" });
		expect(remove.status).toBe(404);
		expect(remove.body.message).toBe("Link not found");
		expect(await Link.findOne({ slug: "private-sec" })).toBeTruthy();
	});
});

describe("request validation and errors", () => {
	it("rejects invalid JSON and unknown API routes", async () => {
		const invalidJson = await request(app)
			.post("/api/user/login")
			.set("Content-Type", "application/json")
			.send("{");
		expect(invalidJson.status).toBe(400);
		expect(invalidJson.body.message).toBe("Invalid JSON");
		expect(JSON.stringify(invalidJson.body)).not.toMatch(/SyntaxError|stack|at /);

		const unknown = await request(app).get("/api/definitely-not-a-route");
		expect(unknown.status).toBe(404);
		expect(unknown.body).toEqual({ message: "Not found" });
	});

	it("rejects unsafe destination URLs", async () => {
		const { token } = await signup("urls@example.com");
		const response = await request(app)
			.post("/api/link/create")
			.set("Authorization", `Bearer ${token}`)
			.send({ title: "Bad", url: "javascript:alert(1)" });

		expect(response.status).toBe(400);
		expect(response.body.message).toMatch(/http/i);
	});

	it("rejects missing fields, empty bodies, and oversized JSON", async () => {
		const missing = await request(app).post("/api/user/login").send({});
		expect(missing.status).toBe(400);
		expect(missing.body.message).toBe("email and password are required");

		const empty = await request(app).post("/api/user/signup").send();
		expect(empty.status).toBe(400);

		const { token } = await signup("validate@example.com");
		const missingTitle = await request(app)
			.post("/api/link/create")
			.set("Authorization", `Bearer ${token}`)
			.send({ url: "https://example.com" });
		expect(missingTitle.status).toBe(400);

		const oversized = await request(app)
			.post("/api/user/login")
			.set("Content-Type", "application/json")
			.send({ email: "a@example.com", password: "x".repeat(40_000) });
		expect(oversized.status).toBe(413);
		expect(oversized.body.message).toBe("Request body is too large");
	});

	it("uses the same login error for unknown emails and wrong passwords", async () => {
		await signup("known@example.com");
		await app.locals.resetRateLimits?.();

		const unknown = await request(app)
			.post("/api/user/login")
			.send({ email: "missing@example.com", password });
		const wrong = await request(app)
			.post("/api/user/login")
			.send({ email: "known@example.com", password: "wrong-password" });

		expect(unknown.status).toBe(401);
		expect(wrong.status).toBe(401);
		expect(unknown.body).toEqual({ message: "Invalid credentials" });
		expect(wrong.body).toEqual(unknown.body);
	});

	it("returns a generic 500 without leaking internals", async () => {
		const { token } = await signup("errors@example.com");
		const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const spy = vi.spyOn(Link, "find").mockReturnValueOnce({
			sort: () => Promise.reject(new Error("ECONNREFUSED mongodb://secret:27017/shortit")),
		} as never);

		const response = await request(app).get("/api/link").set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(500);
		expect(response.body).toEqual({ message: "Failed to fetch links" });
		expect(JSON.stringify(response.body)).not.toContain("mongodb://");
		expect(JSON.stringify(response.body)).not.toContain("secret");
		expect(logSpy.mock.calls.map((call) => String(call[0])).join(" ")).not.toContain("secret:27017");
		spy.mockRestore();
		logSpy.mockRestore();
	});
});

describe("CORS", () => {
	it("allows the configured origin and rejects an untrusted origin", async () => {
		const allowed = await request(app)
			.options("/api/user/login")
			.set("Origin", "http://localhost:5173")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type,authorization");

		expect(allowed.status).toBeGreaterThanOrEqual(200);
		expect(allowed.status).toBeLessThan(300);
		expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

		const denied = await request(app)
			.post("/api/user/login")
			.set("Origin", "http://evil.example")
			.send({ email: "a@example.com", password });

		expect(denied.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
	});
});

describe("configuration", () => {
	it("rejects TRUST_PROXY=true", () => {
		const previous = process.env.TRUST_PROXY;
		process.env.TRUST_PROXY = "true";
		expect(() => getConfig()).toThrow(/TRUST_PROXY=true is not allowed/);
		if (previous === undefined) {
			delete process.env.TRUST_PROXY;
		} else {
			process.env.TRUST_PROXY = previous;
		}
	});
});
