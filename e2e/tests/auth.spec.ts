import { expect, test } from "@playwright/test";
import { API_ORIGIN, E2E_PASSWORD } from "../env";
import {
	fillAuthForm,
	loginViaUi,
	logoutViaUi,
	openAuthDialog,
	registerViaUi,
	switchToRegister,
	uniqueEmail,
	waitForDashboard,
	waitForLanding,
} from "../helpers/app";
import { findUserByEmail } from "../helpers/db";

test.describe("registration and login", () => {
	test("registers through the real API and lands on the dashboard", async ({ page }) => {
		const email = uniqueEmail("register");
		await registerViaUi(page, email);

		const stored = await findUserByEmail(email);
		expect(stored).toBeTruthy();
		expect(stored?.password).not.toBe(E2E_PASSWORD);
		expect(String(stored?.password)).toMatch(/^\$2[aby]\$/);
		expect(await page.evaluate(() => localStorage.getItem("shortit_token"))).toBeTruthy();
		await waitForDashboard(page);
		await expect(page.getByText("No links yet. Create your first short link.")).toBeVisible();
	});

	test("rejects invalid email, missing fields, and short passwords", async ({ page }) => {
		await openAuthDialog(page);
		await switchToRegister(page);

		await expect(page.locator("form")).toHaveAttribute("novalidate", "");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByText("Enter your email.")).toBeVisible();
		await expect(page.getByText("Enter your password.")).toBeVisible();
		await expect(page.getByText("Confirm your password.")).toBeVisible();

		await fillAuthForm(page, "not-an-email", E2E_PASSWORD);
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByText("Enter a valid email address.")).toBeVisible();

		await fillAuthForm(page, uniqueEmail("short-pass"), "123");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});

	test("shows backend feedback for a duplicate email", async ({ page }) => {
		const email = uniqueEmail("duplicate");
		await registerViaUi(page, email);
		await logoutViaUi(page);

		await openAuthDialog(page);
		await switchToRegister(page);
		await fillAuthForm(page, email, E2E_PASSWORD);
		const signup = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/user/signup`) && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Create account" }).click();
		expect((await signup).status()).toBe(409);
		await expect(page.getByRole("alert")).toHaveText("User already exists");
		await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
	});

	test("rejects a password mismatch without calling signup", async ({ page }) => {
		await openAuthDialog(page);
		await switchToRegister(page);
		await fillAuthForm(page, uniqueEmail("mismatch"), "abc123", "abc124");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByText("Passwords do not match.")).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});

	test("login accepts a one-character password and lets the API reject it", async ({ page }) => {
		await openAuthDialog(page);
		await page.getByRole("button", { name: "Login", exact: true }).click();
		await expect(page.getByText("Enter your email.")).toBeVisible();
		await expect(page.getByText("Password is required.")).toBeVisible();
		await expect(page.getByText(/at least 6 characters/i)).toHaveCount(0);

		await fillAuthForm(page, uniqueEmail("short-login"), "x");
		const failed = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/user/login`) && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Login", exact: true }).click();
		expect((await failed).status()).toBe(401);
		await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
	});

	test("logs in an existing user and rejects invalid credentials", async ({ page }) => {
		const email = uniqueEmail("login");
		await registerViaUi(page, email);
		await logoutViaUi(page);

		await openAuthDialog(page);
		await fillAuthForm(page, email, "wrong-password");
		const failed = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/user/login`) && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Login", exact: true }).click();
		expect((await failed).status()).toBe(401);
		await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
		await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

		await fillAuthForm(page, email, E2E_PASSWORD);
		const succeeded = page.waitForResponse(
			(response) =>
				response.url().startsWith(`${API_ORIGIN}/api/user/login`) &&
				response.request().method() === "POST" &&
				response.status() === 200
		);
		await page.getByRole("button", { name: "Login", exact: true }).click();
		await succeeded;
		await expect(page).toHaveURL(/\/home$/);
		await expect(page.getByText(email)).toBeVisible();
	});
});

test.describe("authentication persistence", () => {
	test("restores a session after refresh and blocks /home when logged out", async ({ page }) => {
		const email = uniqueEmail("persist");
		await registerViaUi(page, email);

		await page.reload();
		await expect(page).toHaveURL(/\/home$/);
		await expect(page.getByText(email)).toBeVisible();
		await waitForDashboard(page);

		await logoutViaUi(page);
		expect(await page.evaluate(() => localStorage.getItem("shortit_token"))).toBeNull();

		await page.goto("/home");
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
	});

	test("clears an invalid stored token and stays on the landing page", async ({ page }) => {
		await waitForLanding(page);
		await page.evaluate(() => localStorage.setItem("shortit_token", "not-a-real-token"));
		await page.goto("/home");
		await expect(page).toHaveURL(/\/$/);
		expect(await page.evaluate(() => localStorage.getItem("shortit_token"))).toBeNull();
	});

	test("frontend logout does not revoke the previously issued JWT on the server", async ({ page, request }) => {
		const email = uniqueEmail("logout-jwt");
		await registerViaUi(page, email);
		const token = await page.evaluate(() => localStorage.getItem("shortit_token"));
		expect(token).toBeTruthy();

		await logoutViaUi(page);

		const stillValid = await request.get(`${API_ORIGIN}/api/user`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(stillValid.status()).toBe(200);
		expect((await stillValid.json()).email).toBe(email);

		await page.goto("/home");
		await expect(page).toHaveURL(/\/$/);
	});
});
