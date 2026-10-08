import { E2E_DB_NAME } from "../env";

export const assertIsolatedMongoUri = (uri: string): void => {
	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch {
		throw new Error("E2E MONGODB_URI is not a valid URI");
	}

	if (parsed.protocol !== "mongodb:") {
		throw new Error("E2E MONGODB_URI must use mongodb:// (not mongodb+srv)");
	}

	const host = parsed.hostname.toLowerCase();
	if (host !== "127.0.0.1" && host !== "localhost") {
		throw new Error("E2E MONGODB_URI must use a loopback host");
	}

	if (!parsed.port || parsed.port === "27017") {
		throw new Error("E2E MONGODB_URI cannot use the default MongoDB port 27017");
	}

	const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
	if (dbName !== E2E_DB_NAME) {
		throw new Error(`E2E MONGODB_URI must use database name ${E2E_DB_NAME}`);
	}
};
