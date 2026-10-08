import fs from "node:fs";
import { E2E_DB_NAME, RUNTIME_PATH, type E2ERuntime } from "../env";
import { assertIsolatedMongoUri } from "./mongoGuard";

export const readRuntime = (): E2ERuntime => {
	if (!fs.existsSync(RUNTIME_PATH)) {
		throw new Error(`E2E runtime file missing at ${RUNTIME_PATH}. The harness did not start.`);
	}

	const runtime = JSON.parse(fs.readFileSync(RUNTIME_PATH, "utf8")) as E2ERuntime;
	assertIsolatedMongoUri(runtime.mongoUri);
	if (!runtime.mongoUri.includes(E2E_DB_NAME)) {
		throw new Error("E2E runtime mongoUri is not the isolated database");
	}

	return runtime;
};
