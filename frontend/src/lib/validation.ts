import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_URL_LENGTH = 2048;
export const MAX_SLUG_LENGTH = 64;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const RESERVED_SLUGS = new Set(["home", "api", "assets"]);

export const PASSWORD_REQUIREMENTS_HINT = `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`;

const INVALID_URL_MESSAGE = "Enter a valid http or https URL";
const UNSUPPORTED_PROTOCOL_MESSAGE = "Only http and https URLs are allowed";

const readScheme = (value: string): string | null => {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
};

const assertHttpOrHttpsUrl = (url: string, ctx: z.RefinementCtx) => {
  const scheme = readScheme(url);
  if (scheme !== "http" && scheme !== "https") {
    ctx.addIssue({
      code: "custom",
      message: scheme ? UNSUPPORTED_PROTOCOL_MESSAGE : INVALID_URL_MESSAGE,
    });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    ctx.addIssue({ code: "custom", message: INVALID_URL_MESSAGE });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    ctx.addIssue({ code: "custom", message: UNSUPPORTED_PROTOCOL_MESSAGE });
    return;
  }

  if (!parsed.hostname) {
    ctx.addIssue({ code: "custom", message: INVALID_URL_MESSAGE });
  }
};

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email.")
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH, "Enter a valid email address.")
  .pipe(z.email("Enter a valid email address."));

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(1, "Enter your password.")
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const destinationUrlFormSchema = z
  .string()
  .trim()
  .min(1, "Enter a destination URL.")
  .max(MAX_URL_LENGTH, "URL is too long.")
  .superRefine(assertHttpOrHttpsUrl);

const customSlugValueSchema = z
  .string()
  .max(MAX_SLUG_LENGTH, "Slug is too long.")
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers, and hyphens only.")
  .refine((slug) => !RESERVED_SLUGS.has(slug), { message: "This slug is reserved." });

export const createLinkFormSchema = z.object({
  url: destinationUrlFormSchema,
  slug: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.union([z.literal(""), customSlugValueSchema])),
});

export const editLinkFormSchema = z.object({
  url: destinationUrlFormSchema,
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type CreateLinkFormValues = z.infer<typeof createLinkFormSchema>;
export type EditLinkFormValues = z.infer<typeof editLinkFormSchema>;

export const fieldErrorsFromZod = (error: z.ZodError): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && fields[key] === undefined) {
      fields[key] = issue.message;
    }
  }
  return fields;
};

export const firstError = <T extends Record<string, string | undefined>>(
  errors: T,
  order: Array<keyof T>
): keyof T | undefined => {
  return order.find((key) => Boolean(errors[key]));
};
