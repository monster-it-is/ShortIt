import { expect, test } from "@playwright/test";
import { DESTINATION_URL } from "../env";
import { registerViaUi, uniqueEmail } from "../helpers/app";

test.describe("dashboard empty, loading, and recoverable errors", () => {
	test("shows a loading state then the empty dashboard", async ({ page }) => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		await page.route("**/api/link", async (route) => {
			if (route.request().method() === "GET" && !route.request().url().includes("/resolve")) {
				await gate;
			}
			await route.continue();
		});

		const email = uniqueEmail("loading");
		await registerViaUi(page, email);
		await expect(page.getByRole("status")).toHaveText("Loading links...");
		release();
		await expect(page.getByText("No links yet. Create your first short link.")).toBeVisible();
		await expect(page.locator("[data-slot='card']").filter({ hasText: "Total links" })).toContainText("0");
		await expect(page.locator("[data-slot='card']").filter({ hasText: "Total clicks" })).toContainText("0");
	});

	test("shows a recoverable load error and retries against the real API", async ({ page }) => {
		let blockList = true;
		await page.route("**/api/link", async (route) => {
			if (route.request().method() === "GET" && !route.request().url().includes("/resolve") && blockList) {
				await route.abort("failed");
				return;
			}
			await route.continue();
		});

		const email = uniqueEmail("load-error");
		await registerViaUi(page, email);
		await expect(page.getByRole("alert")).toContainText("Unable to reach the server");
		blockList = false;
		await page.getByRole("button", { name: "Retry" }).click();
		await expect(page.getByText("No links yet. Create your first short link.")).toBeVisible();
	});

	test("rejects an unsafe destination from the create form", async ({ page }) => {
		const email = uniqueEmail("unsafe-create");
		await registerViaUi(page, email);
		await page.getByRole("button", { name: "Add Link" }).click();
		await page.getByLabel("Destination URL").fill("javascript:alert(1)");
		const create = page.getByRole("button", { name: "Create", exact: true });
		await expect(create).toBeEnabled();
		await create.click();
		await expect(page.getByRole("alert")).toContainText(/http/i);
		await expect(page).toHaveURL(/\/home$/);
		await expect(page.getByText(DESTINATION_URL)).toHaveCount(0);
	});
});
