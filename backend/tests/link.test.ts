process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-value-do-not-use-elsewhere";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/shortit-unused-placeholder";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import { Types } from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../src/lib/db";
import { Link } from "../src/models/Link";
import { User } from "../src/models/User";
import { AUTO_SLUG_LENGTH } from "../src/lib/slug";

let mongo: MongoMemoryServer;
let app: Express;

const password = "secret123";

const signup = async (email: string) => {
	const response = await request(app).post("/api/user/signup").send({ email, password });
	expect(response.status).toBe(201);
	return {
		token: response.body.token as string,
		id: response.body.user.id as string,
	};
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const createLink = (
	token: string,
	body: { title?: string; url?: string; slug?: string }
) => request(app).post("/api/link/create").set(authHeader(token)).send(body);

beforeAll(async () => {
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
	await disconnectFromDatabase();
	if (mongo) {
		await mongo.stop();
	}
});

describe("link authentication", () => {
	it("requires a bearer token for list, create, update, and delete", async () => {
		const list = await request(app).get("/api/link");
		expect(list.status).toBe(401);

		const create = await request(app)
			.post("/api/link/create")
			.send({ title: "https://example.com", url: "https://example.com" });
		expect(create.status).toBe(401);

		const update = await request(app)
			.post("/api/link/update")
			.send({ slug: "demo", url: "https://example.com/new" });
		expect(update.status).toBe(401);

		const remove = await request(app).delete("/api/link").send({ slug: "demo" });
		expect(remove.status).toBe(401);
	});
});

describe("create link", () => {
	it("creates a link with a valid https URL and generated slug", async () => {
		const { token, id } = await signup("owner@example.com");
		const response = await createLink(token, {
			title: "Docs",
			url: "https://example.com/docs",
		});

		expect(response.status).toBe(201);
		expect(response.body.message).toBe("Link created");
		expect(response.body.link).toMatchObject({
			title: "Docs",
			url: "https://example.com/docs",
			clicks: 0,
		});
		expect(response.body.link.id).toEqual(expect.any(String));
		expect(response.body.link.slug).toMatch(new RegExp(`^[a-z0-9]{${AUTO_SLUG_LENGTH}}$`));

		const stored = await Link.findById(response.body.link.id);
		expect(stored).toBeTruthy();
		expect(stored?.userId.toString()).toBe(id);
		expect(stored?.clicks).toBe(0);
		expect(stored?.slug).toBe(response.body.link.slug);
	});

	it("creates a link with a custom slug", async () => {
		const { token } = await signup("owner@example.com");
		const response = await createLink(token, {
			title: "Portfolio",
			url: "http://example.com/me",
			slug: "My-Site",
		});

		expect(response.status).toBe(201);
		expect(response.body.link.slug).toBe("my-site");
		expect(response.body.link.url).toBe("http://example.com/me");
	});

	it("rejects a duplicate custom slug", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "First",
			url: "https://example.com/one",
			slug: "taken",
		});

		const duplicate = await createLink(token, {
			title: "Second",
			url: "https://example.com/two",
			slug: "TAKEN",
		});

		expect(duplicate.status).toBe(409);
		expect(duplicate.body.message).toBe("Slug already exists");
	});

	it("rejects reserved slugs", async () => {
		const { token } = await signup("owner@example.com");

		for (const slug of ["home", "HOME", "api", "assets"]) {
			const response = await createLink(token, {
				title: "Reserved",
				url: "https://example.com",
				slug,
			});
			expect(response.status).toBe(400);
			expect(response.body.message).toBe("This slug is reserved");
		}

		const allowed = await createLink(token, {
			title: "Allowed",
			url: "https://example.com/home-page",
			slug: "homepage",
		});
		expect(allowed.status).toBe(201);
		expect(allowed.body.link.slug).toBe("homepage");
	});

	it("rejects unsafe and malformed destination URLs", async () => {
		const { token } = await signup("owner@example.com");

		const unsafe = [
			"javascript:alert(1)",
			"data:text/html,hi",
			"file:///etc/passwd",
			"ftp://files.example.com",
			"not-a-url",
			"",
		];

		for (const url of unsafe) {
			const response = await createLink(token, { title: "Bad", url });
			expect(response.status).toBe(400);
		}
	});

	it("accepts valid http and https URLs", async () => {
		const { token } = await signup("owner@example.com");

		const httpsLink = await createLink(token, {
			title: "HTTPS",
			url: "https://example.com/a",
			slug: "https-ok",
		});
		expect(httpsLink.status).toBe(201);

		const httpLink = await createLink(token, {
			title: "HTTP",
			url: "http://localhost:8080/status",
			slug: "http-ok",
		});
		expect(httpLink.status).toBe(201);
		expect(httpLink.body.link.url).toBe("http://localhost:8080/status");
	});

	it("rejects missing title or invalid slug format", async () => {
		const { token } = await signup("owner@example.com");

		const missingTitle = await createLink(token, { url: "https://example.com" });
		expect(missingTitle.status).toBe(400);
		expect(missingTitle.body.message).toBe("title is required");

		const badSlug = await createLink(token, {
			title: "Docs",
			url: "https://example.com",
			slug: "hello_world",
		});
		expect(badSlug.status).toBe(400);
	});
});

describe("retrieve links", () => {
	it("returns only the authenticated user's links, including an empty list", async () => {
		const owner = await signup("owner@example.com");
		const other = await signup("other@example.com");

		const empty = await request(app).get("/api/link").set(authHeader(owner.token));
		expect(empty.status).toBe(200);
		expect(empty.body.links).toEqual([]);

		await createLink(owner.token, {
			title: "Owner",
			url: "https://example.com/owner",
			slug: "owner-link",
		});
		await createLink(other.token, {
			title: "Other",
			url: "https://example.com/other",
			slug: "other-link",
		});

		const ownerList = await request(app).get("/api/link").set(authHeader(owner.token));
		expect(ownerList.status).toBe(200);
		expect(ownerList.body.links).toHaveLength(1);
		expect(ownerList.body.links[0]).toMatchObject({
			slug: "owner-link",
			url: "https://example.com/owner",
			title: "Owner",
			clicks: 0,
		});
		expect(ownerList.body.links.map((link: { slug: string }) => link.slug)).not.toContain("other-link");
	});
});

describe("update link", () => {
	it("updates the destination URL for the owner", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Original",
			url: "https://example.com/old",
			slug: "editable",
		});

		const response = await request(app)
			.post("/api/link/update")
			.set(authHeader(token))
			.send({ slug: "EDITABLE", url: "https://example.com/new" });

		expect(response.status).toBe(200);
		expect(response.body.message).toBe("Link updated");
		expect(response.body.link).toMatchObject({
			slug: "editable",
			url: "https://example.com/new",
			title: "Original",
		});

		const stored = await Link.findOne({ slug: "editable" });
		expect(stored?.url).toBe("https://example.com/new");
	});

	it("rejects updates from another user and missing links", async () => {
		const owner = await signup("owner@example.com");
		const other = await signup("other@example.com");
		await createLink(owner.token, {
			title: "Private",
			url: "https://example.com/private",
			slug: "private-link",
		});

		const forbidden = await request(app)
			.post("/api/link/update")
			.set(authHeader(other.token))
			.send({ slug: "private-link", url: "https://evil.example/takeover" });
		expect(forbidden.status).toBe(404);
		expect(forbidden.body.message).toBe("Link not found");

		const missing = await request(app)
			.post("/api/link/update")
			.set(authHeader(owner.token))
			.send({ slug: "does-not-exist", url: "https://example.com/new" });
		expect(missing.status).toBe(404);

		const stored = await Link.findOne({ slug: "private-link" });
		expect(stored?.url).toBe("https://example.com/private");
	});

	it("rejects an update with no fields and a delete without a slug", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Original",
			url: "https://example.com/old",
			slug: "needs-fields",
		});

		const emptyUpdate = await request(app)
			.post("/api/link/update")
			.set(authHeader(token))
			.send({ slug: "needs-fields" });
		expect(emptyUpdate.status).toBe(400);
		expect(emptyUpdate.body.message).toBe("Nothing to update");

		const missingSlug = await request(app).delete("/api/link").set(authHeader(token)).send({});
		expect(missingSlug.status).toBe(400);
		expect(missingSlug.body.message).toBe("slug is required");
	});

	it("rejects unsafe URLs on update", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Safe",
			url: "https://example.com/safe",
			slug: "still-safe",
		});

		const response = await request(app)
			.post("/api/link/update")
			.set(authHeader(token))
			.send({ slug: "still-safe", url: "javascript:alert(1)" });

		expect(response.status).toBe(400);
		const stored = await Link.findOne({ slug: "still-safe" });
		expect(stored?.url).toBe("https://example.com/safe");
	});
});

describe("delete link", () => {
	it("deletes an owned link", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Temp",
			url: "https://example.com/temp",
			slug: "temp-link",
		});

		const response = await request(app)
			.delete("/api/link")
			.set(authHeader(token))
			.send({ slug: "temp-link" });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ message: "Link deleted" });
		expect(await Link.findOne({ slug: "temp-link" })).toBeNull();
	});

	it("accepts slug via query string", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Query",
			url: "https://example.com/query",
			slug: "query-link",
		});

		const response = await request(app)
			.delete("/api/link")
			.query({ slug: "query-link" })
			.set(authHeader(token));

		expect(response.status).toBe(200);
		expect(await Link.findOne({ slug: "query-link" })).toBeNull();
	});

	it("rejects deletion by another user and unknown slugs", async () => {
		const owner = await signup("owner@example.com");
		const other = await signup("other@example.com");
		await createLink(owner.token, {
			title: "Keep",
			url: "https://example.com/keep",
			slug: "keep-me",
		});

		const forbidden = await request(app)
			.delete("/api/link")
			.set(authHeader(other.token))
			.send({ slug: "keep-me" });
		expect(forbidden.status).toBe(404);
		expect(forbidden.body.message).toBe("Link not found");

		const missing = await request(app)
			.delete("/api/link")
			.set(authHeader(owner.token))
			.send({ slug: "nope" });
		expect(missing.status).toBe(404);

		expect(await Link.findOne({ slug: "keep-me" })).toBeTruthy();
	});
});

describe("public slug resolution", () => {
	it("resolves a public slug without authentication and increments clicks", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Public",
			url: "https://example.com/destination",
			slug: "go-here",
		});

		const first = await request(app).get("/api/link/resolve/go-here");
		expect(first.status).toBe(200);
		expect(first.body).toMatchObject({
			slug: "go-here",
			url: "https://example.com/destination",
			clicks: 1,
		});

		const second = await request(app)
			.get("/api/link/resolve/GO-HERE")
			.set(authHeader("not-a-real-token"));
		expect(second.status).toBe(200);
		expect(second.body.clicks).toBe(2);

		const stored = await Link.findOne({ slug: "go-here" });
		expect(stored?.clicks).toBe(2);
	});

	it("returns 404 for unknown slugs and does not increment other links", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Counted",
			url: "https://example.com/counted",
			slug: "counted",
		});

		const missing = await request(app).get("/api/link/resolve/missing-slug");
		expect(missing.status).toBe(404);
		expect(missing.body.message).toBe("Link not found");

		const stored = await Link.findOne({ slug: "counted" });
		expect(stored?.clicks).toBe(0);
	});

	it("applies concurrent click increments atomically", async () => {
		const { token } = await signup("owner@example.com");
		await createLink(token, {
			title: "Busy",
			url: "https://example.com/busy",
			slug: "busy-link",
		});

		const results = await Promise.all(
			Array.from({ length: 20 }, () => request(app).get("/api/link/resolve/busy-link"))
		);

		expect(results.every((result) => result.status === 200)).toBe(true);

		const stored = await Link.findOne({ slug: "busy-link" });
		expect(stored?.clicks).toBe(20);
	});

	it("does not increment clicks when a stored destination is unsafe", async () => {
		const { id } = await signup("owner@example.com");
		await Link.collection.insertOne({
			title: "Legacy",
			slug: "legacy-js",
			url: "javascript:alert(1)",
			userId: new Types.ObjectId(id),
			clicks: 4,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const response = await request(app).get("/api/link/resolve/legacy-js");
		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Link destination is invalid");

		const stored = await Link.collection.findOne({ slug: "legacy-js" });
		expect(stored?.clicks).toBe(4);
	});
});
