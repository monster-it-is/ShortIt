import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
	{
		email: { type: String, required: true, unique: true, trim: true, lowercase: true },
		password: { type: String, required: true },
	},
	{ timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };

export const User = model("User", userSchema);
