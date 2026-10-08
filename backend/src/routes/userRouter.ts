import { Router } from "express";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { isMongoDuplicateKeyError, parseLoginBody, parseSignupBody } from "../lib/credentials";
import { signAuthToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { authMiddleware } from "../middleware/auth";
import { User } from "../models/User";
import { Link } from "../models/Link";

const dummyPasswordHash = bcrypt.hash("shortit-timing-dummy", 10);

export const userRouter = Router();

userRouter.post("/signup", async (req, res) => {
	try {
		const parsed = parseSignupBody(req.body);
		if ("message" in parsed) {
			res.status(400).json({ message: parsed.message });
			return;
		}

		const existingUser = await User.findOne({ email: parsed.email });
		if (existingUser) {
			res.status(409).json({ message: "User already exists" });
			return;
		}

		const hashedPassword = await bcrypt.hash(parsed.password, 10);

		const user = await User.create({
			email: parsed.email,
			password: hashedPassword,
		});

		res.status(201).json({
			message: "User created",
			token: signAuthToken(user._id.toString()),
			user: { id: user._id.toString(), email: user.email },
		});
	} catch (error) {
		if (isMongoDuplicateKeyError(error, "email")) {
			res.status(409).json({ message: "User already exists" });
			return;
		}

		logger.error("Failed to signup", { error });
		res.status(500).json({ message: "Failed to signup" });
	}
});

userRouter.post("/login", async (req, res) => {
	try {
		const parsed = parseLoginBody(req.body);
		if ("message" in parsed) {
			res.status(400).json({ message: parsed.message });
			return;
		}

		const user = await User.findOne({ email: parsed.email });
		if (!user) {
			await bcrypt.compare(parsed.password, await dummyPasswordHash);
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const isValidPassword = await bcrypt.compare(parsed.password, user.password);
		if (!isValidPassword) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		res.json({
			message: "Login successful",
			token: signAuthToken(user._id.toString()),
			user: { id: user._id.toString(), email: user.email },
		});
	} catch (error) {
		logger.error("Failed to login", { error });
		res.status(500).json({ message: "Failed to login" });
	}
});

userRouter.get("/", authMiddleware, async (req, res) => {
	try {
		const userId = req.userId;
		if (!userId) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		if (!Types.ObjectId.isValid(userId)) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		const user = await User.findById(userId).select("-password");

		if (!user) {
			res.status(404).json({ message: "User not found" });
			return;
		}

		const links = await Link.find({ userId }).sort({ createdAt: -1 });

		res.json({
			id: user._id.toString(),
			email: user.email,
			link: links.map((link) => ({
				id: link._id.toString(),
				title: link.title,
				slug: link.slug,
				url: link.url,
				clicks: link.clicks,
			})),
		});
	} catch (error) {
		logger.error("Failed to fetch user", { error });
		res.status(500).json({ message: "Failed to fetch user" });
	}
});
