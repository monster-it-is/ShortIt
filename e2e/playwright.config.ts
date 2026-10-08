import { defineConfig, devices } from "@playwright/test";
import { API_ORIGIN, FRONTEND_ORIGIN, FRONTEND_PORT, FRONTEND_ROOT } from "./env";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 45_000,
	expect: { timeout: 10_000 },
	globalTimeout: 10 * 60_000,
	forbidOnly: Boolean(process.env.CI),
	reporter: [["list"], ["html", { open: "never" }]],
	outputDir: "test-results",
	use: {
		baseURL: FRONTEND_ORIGIN,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		permissions: ["clipboard-read", "clipboard-write"],
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: [
		{
			command: "pnpm exec tsx harness.ts",
			url: `${API_ORIGIN}/api/health`,
			reuseExistingServer: false,
			timeout: 300_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: `pnpm exec vite --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
			cwd: FRONTEND_ROOT,
			url: FRONTEND_ORIGIN,
			reuseExistingServer: false,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				VITE_API_BASE_URL: `${API_ORIGIN}/api`,
			},
		},
	],
});
