import mongoose from "mongoose";
import { getConfig } from "./config";

let isConnected = false;

export const connectToDatabase = async (): Promise<void> => {
	if (isConnected || mongoose.connection.readyState === 1) {
		isConnected = true;
		return;
	}

	await mongoose.connect(getConfig().mongoUri, {
		serverSelectionTimeoutMS: 30_000,
		family: 4,
	});
	isConnected = true;
};

export const disconnectFromDatabase = async (): Promise<void> => {
	if (mongoose.connection.readyState !== 0) {
		await mongoose.disconnect();
	}
	isConnected = false;
};
