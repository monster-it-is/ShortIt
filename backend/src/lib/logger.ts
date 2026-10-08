const SECRET_KEYS = /password|passwd|token|authorization|cookie|secret|jwt|api[_-]?key/i;
const MONGO_URI_PATTERN = /mongodb(?:\+srv)?:\/\/\S+/gi;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const SECRET_ASSIGNMENT_PATTERN =
	/(?:jwt[_-]?secret|mongodb_uri|password|passwd|secret|authorization)\s*[:=]\s*\S+/gi;

export const redactText = (value: string): string => {
	return value
		.replace(MONGO_URI_PATTERN, "mongodb://[redacted]")
		.replace(BEARER_PATTERN, "Bearer [redacted]")
		.replace(SECRET_ASSIGNMENT_PATTERN, "[redacted]");
};

const shouldOmitKey = (key: string): boolean => SECRET_KEYS.test(key);

export const sanitizeLogMeta = (meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
	if (!meta) {
		return undefined;
	}

	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(meta)) {
		if (shouldOmitKey(key)) {
			sanitized[key] = "[redacted]";
			continue;
		}

		if (typeof value === "string") {
			sanitized[key] = redactText(value);
			continue;
		}

		if (value instanceof Error) {
			sanitized[key] = {
				name: value.name,
				message: redactText(value.message),
			};
			continue;
		}

		sanitized[key] = value;
	}

	return sanitized;
};

const emit = (level: "info" | "error", message: string, meta?: Record<string, unknown>): void => {
	const payload = {
		level,
		msg: redactText(message),
		...sanitizeLogMeta(meta),
	};
	const line = JSON.stringify(payload);

	if (level === "error") {
		console.error(line);
		return;
	}

	if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
		return;
	}

	console.log(line);
};

export const logger = {
	info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
	error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
