import { MongoClient, ObjectId, type Db } from "mongodb";
import { E2E_DB_NAME } from "../env";
import { readRuntime } from "./runtime";

const withDb = async <T>(fn: (db: Db) => Promise<T>): Promise<T> => {
	const { mongoUri } = readRuntime();
	const client = new MongoClient(mongoUri);
	await client.connect();
	try {
		return await fn(client.db(E2E_DB_NAME));
	} finally {
		await client.close();
	}
};

export const findUserByEmail = async (email: string) => {
	return withDb((db) => db.collection("users").findOne({ email: email.toLowerCase() }));
};

export const findLinkBySlug = async (slug: string) => {
	return withDb((db) => db.collection("links").findOne({ slug: slug.toLowerCase() }));
};

export const countLinksBySlug = async (slug: string) => {
	return withDb((db) => db.collection("links").countDocuments({ slug: slug.toLowerCase() }));
};

export const insertUnsafeLegacyLink = async (email: string, slug: string) => {
	return withDb(async (db) => {
		const user = await db.collection("users").findOne({ email: email.toLowerCase() });
		if (!user?._id) {
			throw new Error(`Cannot seed unsafe link; user ${email} was not found in the isolated database`);
		}

		await db.collection("links").insertOne({
			title: "legacy-unsafe",
			slug: slug.toLowerCase(),
			url: "javascript:alert(1)",
			userId: new ObjectId(String(user._id)),
			clicks: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	});
};
