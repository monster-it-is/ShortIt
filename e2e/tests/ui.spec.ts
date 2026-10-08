import { expect, test } from "@playwright/test";
import {
	fillAuthForm,
	openAuthDialog,
	registerViaUi,
	switchToRegister,
	uniqueEmail,
	waitForLanding,
} from "../helpers/app";
import { E2E_PASSWORD } from "../env";

test.describe("landing navigation", () => {
	test("Learn More scrolls to Why ShortIt without leaving the app", async ({ page }) => {
		await waitForLanding(page);

		const learnMore = page.getByRole("link", { name: "Learn More" });
		await expect(learnMore).toHaveAttribute("href", "#why-shortit");
		await learnMore.click();

		await expect(page).toHaveURL(/\/#why-shortit$/);
		await expect(page.getByRole("heading", { name: "Why ShortIt?" })).toBeInViewport();
		await expect(page.getByRole("heading", { name: "Simple Link Management" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
	});
});

test.describe("theme", () => {
	test("follows the system scheme until the user picks a theme", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await waitForLanding(page);
		await expect(page.locator("html")).toHaveClass(/dark/);

		await page.emulateMedia({ colorScheme: "light" });
		await page.reload();
		await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
		await expect(page.locator("html")).not.toHaveClass(/dark/);
	});

	test("toggles dark mode and persists it after reload", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await waitForLanding(page);

		await page.getByRole("button", { name: "Switch to dark mode" }).click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		expect(await page.evaluate(() => localStorage.getItem("shortit_theme"))).toBe("dark");

		await page.reload();
		await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

		await page.getByRole("button", { name: "Get Started" }).first().click();
		await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
		await expect(page.locator("html")).toHaveClass(/dark/);
	});
});

test.describe("auth form polish", () => {
	test("blocks registration when passwords do not match", async ({ page }) => {
		await openAuthDialog(page);
		await switchToRegister(page);
		await fillAuthForm(page, uniqueEmail("mismatch"), E2E_PASSWORD, "different-pass");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByText("Passwords do not match.")).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
	});

	test("shows and hides the login password without submitting", async ({ page }) => {
		await openAuthDialog(page);
		await page.getByLabel("Password", { exact: true }).fill("secret-value");
		await page.getByRole("button", { name: "Show password" }).click();
		await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
		await expect(page.getByLabel("Password", { exact: true })).toHaveValue("secret-value");
		await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
		await page.getByRole("button", { name: "Hide password" }).click();
		await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
	});

	test("keeps the dashboard theme toggle after login", async ({ page }) => {
		const email = uniqueEmail("theme-home");
		await page.emulateMedia({ colorScheme: "light" });
		await registerViaUi(page, email);
		await page.getByRole("button", { name: "Switch to dark mode" }).click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
	});
});
