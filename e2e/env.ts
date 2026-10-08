import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const E2E_ROOT = here;
export const REPO_ROOT = path.resolve(here, "..");
export const BACKEND_ROOT = path.join(REPO_ROOT, "backend");
export const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
export const RUNTIME_PATH = path.join(here, ".runtime.json");

export const E2E_DB_NAME = "shortit-e2e";
export const E2E_JWT_SECRET = "e2e-jwt-secret-value-do-not-use-elsewhere";
export const E2E_PASSWORD = "e2e-pass-1";

export const API_PORT = Number(process.env.E2E_API_PORT ?? "18080");
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? "4173");
export const DESTINATION_PORT = Number(process.env.E2E_DEST_PORT ?? "18081");

export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
export const DESTINATION_ORIGIN = `http://127.0.0.1:${DESTINATION_PORT}`;
export const DESTINATION_URL = `${DESTINATION_ORIGIN}/ok`;
export const DESTINATION_ALT_URL = `${DESTINATION_ORIGIN}/alt`;

export type E2ERuntime = {
	mongoUri: string;
	apiOrigin: string;
	frontendOrigin: string;
	destinationOrigin: string;
};
