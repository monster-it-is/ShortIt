import http from "node:http";
import fs from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
	API_ORIGIN,
	API_PORT,
	BACKEND_ROOT,
	DESTINATION_ORIGIN,
	DESTINATION_PORT,
	E2E_DB_NAME,
	E2E_JWT_SECRET,
	FRONTEND_ORIGIN,
	RUNTIME_PATH,
} from "./env.ts";

const applyE2EEnv = (mongoUri: string) => {
	process.env.SHORTIT_E2E = "true";
	process.env.NODE_ENV = "test";
	process.env.MONGODB_URI = mongoUri;
	process.env.JWT_SECRET = E2E_JWT_SECRET;
	process.env.PORT = String(API_PORT);
	process.env.CORS_ORIGIN = `${FRONTEND_ORIGIN},http://localhost:${new URL(FRONTEND_ORIGIN).port}`;
	process.env.RATE_LIMIT_LOGIN_MAX = "200";
	process.env.RATE_LIMIT_SIGNUP_MAX = "200";
	process.env.RATE_LIMIT_RESOLVE_MAX = "500";
	delete process.env.VITEST;
	delete process.env.TRUST_PROXY;
};

const startDestination = () => {
	const server = http.createServer((req, res) => {
		const url = req.url ?? "/";
		if (url === "/ok" || url === "/alt" || url === "/") {
			res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
			res.end(url === "/alt" ? "ShortIt E2E alternate destination" : "ShortIt E2E destination");
			return;
		}

		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
		res.end("not found");
	});

	return new Promise<http.Server>((resolve, reject) => {
		server.once("error", reject);
		server.listen(DESTINATION_PORT, "127.0.0.1", () => resolve(server));
	});
};

const start = async () => {
	process.chdir(BACKEND_ROOT);

	const mongo = await MongoMemoryServer.create({
		instance: { dbName: E2E_DB_NAME },
	});
	const mongoUri = mongo.getUri(E2E_DB_NAME);
	applyE2EEnv(mongoUri);

	const { assertIsolatedMongoUri } = await import("../backend/src/lib/config.ts");
	assertIsolatedMongoUri(mongoUri);

	const { connectToDatabase, disconnectFromDatabase } = await import("../backend/src/lib/db.ts");
	const { createApp } = await import("../backend/src/app.ts");

	await connectToDatabase();
	const app = createApp();
	const destination = await startDestination();

	const api = await new Promise<http.Server>((resolve, reject) => {
		const server = app.listen(API_PORT, "127.0.0.1", () => resolve(server));
		server.once("error", reject);
	});

	const runtime = {
		mongoUri,
		apiOrigin: API_ORIGIN,
		frontendOrigin: FRONTEND_ORIGIN,
		destinationOrigin: DESTINATION_ORIGIN,
	};
	fs.writeFileSync(RUNTIME_PATH, `${JSON.stringify(runtime, null, 2)}\n`);

	const shutdown = async () => {
		api.close();
		destination.close();
		await disconnectFromDatabase();
		await mongo.stop();
		try {
			fs.unlinkSync(RUNTIME_PATH);
		} catch {
			// already removed
		}
	};

	process.on("SIGINT", () => {
		void shutdown().finally(() => process.exit(0));
	});
	process.on("SIGTERM", () => {
		void shutdown().finally(() => process.exit(0));
	});

	console.log(`E2E API ${API_ORIGIN}  destination ${DESTINATION_ORIGIN}  mongo isolated`);
};

start().catch((error) => {
	console.error(error);
	process.exit(1);
});
