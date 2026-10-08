import { expect, test } from "@playwright/test";
import { API_ORIGIN, DESTINATION_ALT_URL, DESTINATION_URL, FRONTEND_ORIGIN } from "../env";
import {
	cardForSlug,
	createLinkViaUi,
	registerViaUi,
	uniqueEmail,
	uniqueSlug,
	waitForDashboard,
} from "../helpers/app";
import { countLinksBySlug, findLinkBySlug } from "../helpers/db";

test.describe("link creation", () => {
	test("creates an auto-generated short link and a custom slug", async ({ page }) => {
		const email = uniqueEmail("create");
		await registerViaUi(page, email);
		await waitForDashboard(page);

		const generated = await createLinkViaUi(page);
		expect(generated.slug).toMatch(/^[a-z0-9]{8}$/);
		const storedGenerated = await findLinkBySlug(generated.slug);
		expect(storedGenerated?.url).toBe(DESTINATION_URL);
		expect(storedGenerated?.clicks).toBe(0);

		const generatedCard = cardForSlug(page, generated.slug);
		await expect(generatedCard.getByRole("link", { name: `${FRONTEND_ORIGIN}/${generated.slug}` })).toBeVisible();
		await expect(generatedCard.getByText("0 clicks")).toBeVisible();

		const customSlug = uniqueSlug("custom");
		const custom = await createLinkViaUi(page, { slug: customSlug });
		expect(custom.slug).toBe(customSlug);
		expect(await findLinkBySlug(customSlug)).toBeTruthy();
		await expect(cardForSlug(page, customSlug)).toBeVisible();
		await expect(page.getByText("Total links")).toBeVisible();
		await expect(page.locator("[data-slot='card']").filter({ hasText: "Total links" })).toContainText("2");
	});

	test("rejects reserved slugs, duplicates, and missing destinations", async ({ page }) => {
		const email = uniqueEmail("create-errors");
		await registerViaUi(page, email);
		await waitForDashboard(page);

		await page.getByRole("button", { name: "Add Link" }).click();
		await expect(page.locator("form")).toHaveAttribute("novalidate", "");
		await page.getByRole("button", { name: "Create" }).click();
		await expect(page.getByText("Enter a destination URL.")).toBeVisible();

		await page.getByLabel("Destination URL").fill(DESTINATION_URL);
		await page.getByLabel(/Custom slug/).fill("home");
		await page.getByRole("button", { name: "Create" }).click();
		await expect(page.getByRole("alert")).toContainText(/reserved/i);
		await page.keyboard.press("Escape");
		await expect(page.getByRole("heading", { name: "Add a new link" })).toHaveCount(0);

		const slug = uniqueSlug("dup");
		await createLinkViaUi(page, { slug });

		await page.getByRole("button", { name: "Add Link" }).click();
		await page.getByLabel("Destination URL").fill(DESTINATION_URL);
		await page.getByLabel(/Custom slug/).fill(slug);
		const duplicate = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link/create`) && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Create" }).click();
		expect((await duplicate).status()).toBe(409);
		await expect(page.getByRole("alert")).toHaveText("Slug already exists");
		expect(await countLinksBySlug(slug)).toBe(1);
	});

	test("prevents a second create while the first request is in flight", async ({ page }) => {
		const email = uniqueEmail("double-submit");
		await registerViaUi(page, email);
		await waitForDashboard(page);

		let createCalls = 0;
		await page.route("**/api/link/create", async (route) => {
			createCalls += 1;
			await new Promise((resolve) => setTimeout(resolve, 400));
			await route.continue();
		});

		await page.getByRole("button", { name: "Add Link" }).click();
		await page.getByLabel("Destination URL").fill(DESTINATION_URL);
		await page.getByRole("button", { name: "Create", exact: true }).click();
		await expect(page.getByRole("button", { name: "Creating..." })).toBeDisabled();
		await expect(page.getByRole("heading", { name: "Congrats, your link has been shortened" })).toBeVisible();
		expect(createCalls).toBe(1);
	});
});

test.describe("copy, edit, and delete", () => {
	test("copies the complete short URL from the current origin", async ({ page, context }) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		const email = uniqueEmail("copy");
		await registerViaUi(page, email);
		const slug = uniqueSlug("clip");
		await createLinkViaUi(page, { slug });

		const expected = `${FRONTEND_ORIGIN}/${slug}`;
		await cardForSlug(page, slug).getByRole("button", { name: "Copy", exact: true }).click();
		await expect(cardForSlug(page, slug).getByRole("button", { name: "Copied", exact: true })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
	});

	test("edits a destination and persists it after refresh", async ({ page }) => {
		const email = uniqueEmail("edit");
		await registerViaUi(page, email);
		const slug = uniqueSlug("edit");
		await createLinkViaUi(page, { slug });

		const card = cardForSlug(page, slug);
		await card.getByRole("button", { name: "Edit URL" }).click();
		await expect(page.getByRole("heading", { name: "Edit link URL" })).toBeVisible();
		await page.getByLabel("Destination URL").fill(DESTINATION_ALT_URL);
		const update = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link/update`) && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Save" }).click();
		expect((await update).status()).toBe(200);
		await expect(cardForSlug(page, slug).getByText(DESTINATION_ALT_URL)).toBeVisible();
		expect((await findLinkBySlug(slug))?.url).toBe(DESTINATION_ALT_URL);

		await page.reload();
		await waitForDashboard(page);
		await expect(cardForSlug(page, slug).getByText(DESTINATION_ALT_URL)).toBeVisible();
	});

	test("shows edit error feedback for an invalid destination", async ({ page }) => {
		const email = uniqueEmail("edit-invalid");
		await registerViaUi(page, email);
		const slug = uniqueSlug("edit-bad");
		await createLinkViaUi(page, { slug });

		await cardForSlug(page, slug).getByRole("button", { name: "Edit URL" }).click();
		await page.getByLabel("Destination URL").fill("ftp://example.com/not-allowed");
		await page.getByRole("button", { name: "Save" }).click();
		await expect(page.getByRole("alert")).toContainText(/http/i);
		await page.getByRole("button", { name: "Cancel" }).click();
		expect((await findLinkBySlug(slug))?.url).toBe(DESTINATION_URL);
	});

	test("deletes a link and does not restore it after refresh", async ({ page }) => {
		const email = uniqueEmail("delete");
		await registerViaUi(page, email);
		const slug = uniqueSlug("delete");
		await createLinkViaUi(page, { slug });

		page.once("dialog", (dialog) => dialog.accept());
		const removed = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link`) && response.request().method() === "DELETE"
		);
		await page.getByRole("button", { name: `Delete /${slug}` }).click();
		expect((await removed).status()).toBe(200);
		await expect(page.getByRole("button", { name: `Delete /${slug}` })).toHaveCount(0);
		expect(await findLinkBySlug(slug)).toBeNull();

		await page.reload();
		await waitForDashboard(page);
		await expect(page.getByRole("button", { name: `Delete /${slug}` })).toHaveCount(0);

		await page.goto(`/${slug}`);
		await expect(page.getByRole("alert")).toHaveText("Link not found");
	});

	test("keeps dashboard rows when a delete request fails", async ({ page }) => {
		const email = uniqueEmail("delete-fail");
		await registerViaUi(page, email);
		const slug = uniqueSlug("keep");
		await createLinkViaUi(page, { slug });

		await page.route("**/api/link", async (route) => {
			if (route.request().method() === "DELETE") {
				await route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ message: "Failed to delete link" }),
				});
				return;
			}
			await route.continue();
		});

		page.once("dialog", (dialog) => dialog.accept());
		await page.getByRole("button", { name: `Delete /${slug}` }).click();
		await expect(page.getByRole("alert")).toHaveText("Failed to delete link");
		await expect(cardForSlug(page, slug)).toBeVisible();
		expect(await findLinkBySlug(slug)).toBeTruthy();
	});
});
