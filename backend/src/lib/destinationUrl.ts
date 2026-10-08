import { z } from "zod";
import { firstZodMessage } from "./zod";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_URL_LENGTH = 2048;

export const MAX_DESTINATION_URL_LENGTH = MAX_URL_LENGTH;

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

	if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
		ctx.addIssue({ code: "custom", message: UNSUPPORTED_PROTOCOL_MESSAGE });
		return;
	}

	if (!parsed.hostname) {
		ctx.addIssue({ code: "custom", message: INVALID_URL_MESSAGE });
	}
};

export const destinationUrlSchema = z
	.string({ error: "url is required" })
	.trim()
	.min(1, "url is required")
	.max(MAX_URL_LENGTH, "url is too long")
	.superRefine(assertHttpOrHttpsUrl);

export const parseDestinationUrl = (value: unknown): { url: string } | { message: string } => {
	const result = destinationUrlSchema.safeParse(value);
	if (!result.success) {
		return { message: firstZodMessage(result.error, "url is required") };
	}

	return { url: result.data };
};

export const isSafeDestinationUrl = (value: unknown): boolean => {
	return !("message" in parseDestinationUrl(value));
};
