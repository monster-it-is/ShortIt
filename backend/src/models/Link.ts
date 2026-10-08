import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { MAX_DESTINATION_URL_LENGTH, isSafeDestinationUrl } from "../lib/destinationUrl";
import { MAX_SLUG_LENGTH, isUsableSlug } from "../lib/slug";

const MAX_TITLE_LENGTH = 2048;

const linkSchema = new Schema(
	{
		title: { type: String, required: true, trim: true, maxlength: MAX_TITLE_LENGTH },
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			minlength: 1,
			maxlength: MAX_SLUG_LENGTH,
			validate: {
				validator: (value: string) => isUsableSlug(value),
				message: "Invalid slug",
			},
		},
		url: {
			type: String,
			required: true,
			trim: true,
			maxlength: MAX_DESTINATION_URL_LENGTH,
			validate: {
				validator: (value: string) => isSafeDestinationUrl(value),
				message: "Only http and https URLs are allowed",
			},
		},
		userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
		clicks: { type: Number, required: true, default: 0, min: 0 },
	},
	{ timestamps: true }
);

linkSchema.index({ userId: 1, createdAt: -1 });

export type LinkDocument = InferSchemaType<typeof linkSchema> & {
	_id: Types.ObjectId;
};

export const Link = model("Link", linkSchema);
