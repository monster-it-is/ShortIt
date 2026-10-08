process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-value-do-not-use-elsewhere";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/shortit-unused-placeholder";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import { connectToDatabase, disconnectFromDatabase } from "../src/lib/db";
import { User } from "../src/models/User";
import { getConfig } from "../src/lib/config";

let mongo: MongoMemoryServer;
let app: Express;

const credentials = {
	email: "ada@example.com",
	password: "secret123",
};

beforeAll(async () => {
	mongo = await MongoMemoryServer.create();
	process.env.MONGODB_URI = mongo.getUri();
	await connectToDatabase();
	const { createApp } = await import("../src/app");
	app = createApp();
});

beforeEach(async () => {
	await User.deleteMany({});
	await app.locals.resetRateLimits?.();
});

afterAll(async () => {
	await disconnectFromDatabase();
	if (mongo) {
		await mongo.stop();
	}
});

describe("configuration", () => {
	it("requires JWT_SECRET", () => {
		const previous = process.env.JWT_SECRET;
		delete process.env.JWT_SECRET;
		expect(() => getConfig()).toThrow(/JWT_SECRET is not set/);
		process.env.JWT_SECRET = previous;
	});

	it("requires MONGODB_URI", () => {
		const previous = process.env.MONGODB_URI;
		delete process.env.MONGODB_URI;
		expect(() => getConfig()).toThrow(/MONGODB_URI is not set/);
		process.env.MONGODB_URI = previous;
	});

	it("rejects remote MongoDB URIs when SHORTIT_E2E is set", () => {
		const previousFlag = process.env.SHORTIT_E2E;
		const previousUri = process.env.MONGODB_URI;
		process.env.SHORTIT_E2E = "true";
		process.env.MONGODB_URI = "mongodb+srv://cluster.mongodb.net/shortit";
		expect(() => getConfig()).toThrow(/mongodb:\/\//);
		process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/shortit-e2e";
		expect(() => getConfig()).toThrow(/27017/);
		process.env.MONGODB_URI = "mongodb://127.0.0.1:27018/shortit-e2e";
		expect(() => getConfig()).not.toThrow();
		process.env.MONGODB_URI = previousUri;
		if (previousFlag === undefined) {
			delete process.env.SHORTIT_E2E;
		} else {
			process.env.SHORTIT_E2E = previousFlag;
		}
	});

	it("rejects wildcard CORS origins", () => {
		const previous = process.env.CORS_ORIGIN;
		process.env.CORS_ORIGIN = "*";
		expect(() => getConfig()).toThrow(/cannot be \*/);
		process.env.CORS_ORIGIN = previous;
	});

	it("strips trailing slashes from CORS origins", () => {
		const previous = process.env.CORS_ORIGIN;
		process.env.CORS_ORIGIN = "https://shortit-web.onrender.com/";
		expect(getConfig().corsOrigins).toEqual(["https://shortit-web.onrender.com"]);
		process.env.CORS_ORIGIN = previous;
	});

	it("listens on 0.0.0.0 by default so Render can bind PORT", () => {
		const previousHost = process.env.HOST;
		const previousPort = process.env.PORT;
		delete process.env.HOST;
		process.env.PORT = "10000";
		const config = getConfig();
		expect(config.listenHost).toBe("0.0.0.0");
		expect(config.port).toBe(10000);
		if (previousHost === undefined) {
			delete process.env.HOST;
		} else {
			process.env.HOST = previousHost;
		}
		process.env.PORT = previousPort;
	});
});

describe("CORS", () => {
	it("allows configured origin preflight", async () => {
		const response = await request(app)
			.options("/api/user/login")
			.set("Origin", "http://localhost:5173")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type,authorization");

		expect(response.status).toBeGreaterThanOrEqual(200);
		expect(response.status).toBeLessThan(300);
		expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
		expect(String(response.headers["access-control-allow-headers"]).toLowerCase()).toContain(
			"authorization"
		);
	});

	it("does not reflect an unknown origin", async () => {
		const response = await request(app)
			.options("/api/user/login")
			.set("Origin", "http://evil.example")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type");

		expect(response.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
	});
});

describe("health", () => {
	it("returns ok without authentication", async () => {
		const response = await request(app).get("/api/health");
		expect(response.status).toBe(200);
		expect(response.body).toEqual({ status: "ok" });
	});
});

describe("registration and sign-in", () => {
	it("registers a user, hashes the password, and returns a token", async () => {
		const response = await request(app).post("/api/user/signup").send(credentials);

		expect(response.status).toBe(201);
		expect(response.body.user.email).toBe(credentials.email);
		expect(response.body.token).toEqual(expect.any(String));

		const stored = await User.findOne({ email: credentials.email });
		expect(stored).toBeTruthy();
		expect(stored?.password).not.toBe(credentials.password);
		expect(stored?.password.startsWith("$2")).toBe(true);
	});

	it("rejects duplicate registration", async () => {
		await request(app).post("/api/user/signup").send(credentials);
		const response = await request(app).post("/api/user/signup").send(credentials);

		expect(response.status).toBe(409);
		expect(response.body.message).toBe("User already exists");
	});

	it("rejects invalid email and short passwords", async () => {
		const invalidEmail = await request(app)
			.post("/api/user/signup")
			.send({ email: "not-an-email", password: "secret123" });
		expect(invalidEmail.status).toBe(400);

		const shortPassword = await request(app)
			.post("/api/user/signup")
			.send({ email: "ok@example.com", password: "123" });
		expect(shortPassword.status).toBe(400);
	});

	it("signs in with valid credentials", async () => {
		await request(app).post("/api/user/signup").send(credentials);
		const response = await request(app).post("/api/user/login").send(credentials);

		expect(response.status).toBe(200);
		expect(response.body.message).toBe("Login successful");
		expect(response.body.token).toEqual(expect.any(String));
		expect(response.body.user.email).toBe(credentials.email);
	});

	it("rejects invalid credentials", async () => {
		await request(app).post("/api/user/signup").send(credentials);
		const response = await request(app)
			.post("/api/user/login")
			.send({ email: credentials.email, password: "wrong-password" });

		expect(response.status).toBe(401);
		expect(response.body.message).toBe("Invalid credentials");
	});

	it("does not reject a short login password for length; authentication still fails", async () => {
		await request(app).post("/api/user/signup").send(credentials);

		const oneCharacter = await request(app)
			.post("/api/user/login")
			.send({ email: credentials.email, password: "x" });
		expect(oneCharacter.status).toBe(401);
		expect(oneCharacter.body.message).toBe("Invalid credentials");

		const twoCharacter = await request(app)
			.post("/api/user/login")
			.send({ email: credentials.email, password: "xy" });
		expect(twoCharacter.status).toBe(401);

		const missing = await request(app)
			.post("/api/user/login")
			.send({ email: credentials.email, password: "" });
		expect(missing.status).toBe(400);
		expect(missing.body.message).toBe("email and password are required");
	});

	it("does not transform login passwords before comparing them", async () => {
		await request(app).post("/api/user/signup").send({
			email: "spaces@example.com",
			password: "secret123",
		});

		const padded = await request(app)
			.post("/api/user/login")
			.send({ email: "spaces@example.com", password: " secret123 " });
		expect(padded.status).toBe(401);
		expect(padded.body.message).toBe("Invalid credentials");
	});

	it("requires a bearer token for the current-user endpoint", async () => {
		const unauthenticated = await request(app).get("/api/user");
		expect(unauthenticated.status).toBe(401);

		const signup = await request(app).post("/api/user/signup").send(credentials);
		const me = await request(app)
			.get("/api/user")
			.set("Authorization", `Bearer ${signup.body.token}`);

		expect(me.status).toBe(200);
		expect(me.body.email).toBe(credentials.email);
		expect(me.body.id).toBe(signup.body.user.id);
	});

	it("rejects an invalid token", async () => {
		const response = await request(app)
			.get("/api/user")
			.set("Authorization", "Bearer not-a-real-token");

		expect(response.status).toBe(401);
		expect(response.body.message).toBe("Invalid or expired token");
	});
});
