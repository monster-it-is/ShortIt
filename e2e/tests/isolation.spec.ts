import { expect, test } from "@playwright/test";
import { API_ORIGIN, DESTINATION_ALT_URL, DESTINATION_ORIGIN, DESTINATION_URL } from "../env";
import {
	createLinkViaUi,
	loginViaUi,
	logoutViaUi,
	registerViaUi,
	uniqueEmail,
	uniqueSlug,
	waitForDashboard,
} from "../helpers/app";
import { findLinkBySlug } from "../helpers/db";

test.describe("user isolation", () => {
	test("another account cannot see or mutate private links; public resolve still works", async ({
		page,
		request,
	}) => {
		const emailA = uniqueEmail("iso-a");
		const emailB = uniqueEmail("iso-b");
		const slug = uniqueSlug("owned");

		await registerViaUi(page, emailA);
		await createLinkViaUi(page, { slug });
		await logoutViaUi(page);

		await registerViaUi(page, emailB);
		await waitForDashboard(page);
		await expect(page.getByText("No links yet. Create your first short link.")).toBeVisible();
		await expect(page.getByRole("button", { name: `Delete /${slug}` })).toHaveCount(0);

		const tokenB = await page.evaluate(() => localStorage.getItem("shortit_token"));
		expect(tokenB).toBeTruthy();

		const update = await request.post(`${API_ORIGIN}/api/link/update`, {
			headers: {
				Authorization: `Bearer ${tokenB}`,
				"Content-Type": "application/json",
			},
			data: { slug, url: DESTINATION_ALT_URL },
		});
		expect(update.status()).toBe(404);
		expect(await update.json()).toEqual({ message: "Link not found" });

		const remove = await request.delete(`${API_ORIGIN}/api/link`, {
			headers: {
				Authorization: `Bearer ${tokenB}`,
				"Content-Type": "application/json",
			},
			data: { slug },
		});
		expect(remove.status()).toBe(404);
		expect((await findLinkBySlug(slug))?.url).toBe(DESTINATION_URL);

		await logoutViaUi(page);
		await page.goto(`/${slug}`);
		await expect(page).toHaveURL(`${DESTINATION_ORIGIN}/ok`);

		await loginViaUi(page, emailA);
		await waitForDashboard(page);
		await expect(page.getByRole("button", { name: `Delete /${slug}` })).toBeVisible();
	});
});
