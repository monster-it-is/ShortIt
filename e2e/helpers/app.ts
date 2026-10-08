import { expect, type Page } from "@playwright/test";
import { API_ORIGIN, DESTINATION_URL, E2E_PASSWORD } from "../env";

export const uniqueEmail = (label: string): string => {
	const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return `e2e.${label}.${nonce}@example.com`;
};

export const uniqueSlug = (label: string): string => {
	return `e2e-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
};

export const waitForLanding = async (page: Page) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
	await expect(page.getByRole("button", { name: "Get Started" }).first()).toBeEnabled();
};

export const openAuthDialog = async (page: Page) => {
	await waitForLanding(page);
	await page.getByRole("button", { name: "Get Started" }).first().click();
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
};

export const switchToRegister = async (page: Page) => {
	await page.getByRole("button", { name: "Need an account? Register" }).click();
	await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
};

export const fillAuthForm = async (
	page: Page,
	email: string,
	password: string,
	confirmPassword?: string
) => {
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	const confirm = page.getByLabel("Confirm password");
	if ((await confirm.count()) > 0) {
		await confirm.fill(confirmPassword ?? password);
	}
};

export const registerViaUi = async (
	page: Page,
	email: string,
	password = E2E_PASSWORD
) => {
	await openAuthDialog(page);
	await switchToRegister(page);
	await fillAuthForm(page, email, password);

	const signup = page.waitForResponse(
		(response) =>
			response.url().startsWith(`${API_ORIGIN}/api/user/signup`) && response.request().method() === "POST"
	);
	await page.getByRole("button", { name: "Create account" }).click();
	const response = await signup;
	expect(response.status()).toBe(201);
	await expect(page).toHaveURL(/\/home$/);
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
	await expect(page.getByText(email)).toBeVisible();
};

export const loginViaUi = async (page: Page, email: string, password = E2E_PASSWORD) => {
	await openAuthDialog(page);
	await fillAuthForm(page, email, password);
	const login = page.waitForResponse(
		(response) =>
			response.url().startsWith(`${API_ORIGIN}/api/user/login`) && response.request().method() === "POST"
	);
	await page.getByRole("button", { name: "Login", exact: true }).click();
	const response = await login;
	expect(response.status()).toBe(200);
	await expect(page).toHaveURL(/\/home$/);
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
};

export const logoutViaUi = async (page: Page) => {
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole("heading", { name: "Make your links look smart." })).toBeVisible();
};

export const waitForDashboard = async (page: Page) => {
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
	await expect(page.getByText("Loading links...")).toHaveCount(0);
};

export const createLinkViaUi = async (
	page: Page,
	options: { url?: string; slug?: string } = {}
) => {
	const url = options.url ?? DESTINATION_URL;
	await page.getByRole("button", { name: "Add Link" }).click();
	await expect(page.getByRole("heading", { name: "Add a new link" })).toBeVisible();
	await page.getByLabel("Destination URL").fill(url);
	if (options.slug) {
		await page.getByLabel(/Custom slug/).fill(options.slug);
	}

	const create = page.waitForResponse(
		(response) =>
			response.url().startsWith(`${API_ORIGIN}/api/link/create`) && response.request().method() === "POST"
	);
	await page.getByRole("button", { name: "Create" }).click();
	const response = await create;
	expect(response.status()).toBe(201);
	const body = (await response.json()) as { link: { slug: string; url: string } };
	await expect(page.getByRole("heading", { name: "Congrats, your link has been shortened" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("heading", { name: "Congrats, your link has been shortened" })).toHaveCount(0);
	return body.link;
};

export const cardForSlug = (page: Page, slug: string) => {
	return page.locator("[data-slot='card']").filter({
		has: page.getByRole("button", { name: `Delete /${slug}` }),
	});
};
