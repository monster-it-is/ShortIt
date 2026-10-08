import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;

const requiredEmail = z
	.string({ error: "email and password are required" })
	.min(1, "email and password are required");

const emailSchema = requiredEmail
	.trim()
	.min(1, "email and password are required")
	.toLowerCase()
	.max(MAX_EMAIL_LENGTH, "Enter a valid email address")
	.pipe(z.email("Enter a valid email address"));

const loginPasswordSchema = z
	.string({ error: "email and password are required" })
	.min(1, "email and password are required");

const signupPasswordSchema = z
	.string({ error: "email and password are required" })
	.min(1, "email and password are required")
	.min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
	.max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);

export const loginBodySchema = z.object({
	email: emailSchema,
	password: loginPasswordSchema,
});

export const signupBodySchema = z.object({
	email: emailSchema,
	password: signupPasswordSchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type SignupBody = z.infer<typeof signupBodySchema>;
