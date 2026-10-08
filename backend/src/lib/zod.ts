import { z } from "zod";

export const firstZodMessage = (error: z.ZodError, fallback = "Invalid input"): string => {
	return error.issues[0]?.message ?? fallback;
};

export const parseWithZod = <T>(
	schema: z.ZodType<T>,
	value: unknown
): { success: true; data: T } | { success: false; message: string } => {
	const result = schema.safeParse(value);
	if (!result.success) {
		return { success: false, message: firstZodMessage(result.error) };
	}

	return { success: true, data: result.data };
};
