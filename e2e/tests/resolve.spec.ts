import { expect, test } from "@playwright/test";
import { API_ORIGIN, DESTINATION_ORIGIN, FRONTEND_ORIGIN } from "../env";
import { createLinkViaUi, registerViaUi, uniqueEmail, uniqueSlug, waitForDashboard } from "../helpers/app";
import { findLinkBySlug, insertUnsafeLegacyLink } from "../helpers/db";

test.describe("public short URL resolution", () => {
	test("redirects through the real resolve API and counts one click per visit", async ({ page }) => {
		const email = uniqueEmail("resolve");
		await registerViaUi(page, email);
		const slug = uniqueSlug("go");
		await createLinkViaUi(page, { slug });
		expect((await findLinkBySlug(slug))?.clicks).toBe(0);

		const firstResolve = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link/resolve/${slug}`) &&
				response.request().method() === "GET" &&
				response.status() === 200
		);
		await page.goto(`/${slug}`);
		const first = await firstResolve;
		expect(first.url()).toContain(API_ORIGIN);
		await expect(page).toHaveURL(`${DESTINATION_ORIGIN}/ok`);
		await expect(page.getByText("ShortIt E2E destination")).toBeVisible();
		expect((await findLinkBySlug(slug))?.clicks).toBe(1);

		const secondResolve = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link/resolve/${slug}`) &&
				response.request().method() === "GET" &&
				response.status() === 200
		);
		await page.goto(`${FRONTEND_ORIGIN}/${slug}`);
		await secondResolve;
		await expect(page).toHaveURL(`${DESTINATION_ORIGIN}/ok`);
		expect((await findLinkBySlug(slug))?.clicks).toBe(2);

		await page.goto("/home");
		await waitForDashboard(page);
		await expect(page.getByText("2 clicks")).toBeVisible();
		await expect(page.locator("[data-slot='card']").filter({ hasText: "Total clicks" })).toContainText("2");
	});

	test("unknown slugs do not increment other counters", async ({ page }) => {
		const email = uniqueEmail("unknown-slug");
		await registerViaUi(page, email);
		const slug = uniqueSlug("counted");
		await createLinkViaUi(page, { slug });

		const missing = page.waitForResponse(
			(response) =>
				response.url().includes("/api/link/resolve/missing-e2e-slug-xyz") && response.request().method() === "GET"
		);
		await page.goto("/missing-e2e-slug-xyz");
		expect((await missing).status()).toBe(404);
		await expect(page.getByRole("alert")).toHaveText("Link not found");
		expect((await findLinkBySlug(slug))?.clicks).toBe(0);
	});

	test("unsafe legacy destinations are not redirected or counted", async ({ page }) => {
		const email = uniqueEmail("unsafe");
		await registerViaUi(page, email);
		const slug = uniqueSlug("js");
		await insertUnsafeLegacyLink(email, slug);

		const resolve = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/link/resolve/${slug}`) && response.request().method() === "GET"
		);
		await page.goto(`/${slug}`);
		expect((await resolve).status()).toBe(400);
		await expect(page.getByRole("alert")).toHaveText("This short link has an invalid destination.");
		await expect(page).toHaveURL(`${FRONTEND_ORIGIN}/${slug}`);
		expect((await findLinkBySlug(slug))?.clicks).toBe(0);
	});
});
