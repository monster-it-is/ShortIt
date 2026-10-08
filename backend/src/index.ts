import { createApp } from "./app";
import { getConfig } from "./lib/config";
import { connectToDatabase } from "./lib/db";
import { logger } from "./lib/logger";

const startServer = async () => {
	try {
		const config = getConfig();
		await connectToDatabase();
		const app = createApp();

		const server = app.listen(config.port, config.listenHost, () => {
			logger.info("server started", {
				port: config.port,
				host: config.listenHost,
				env: config.nodeEnv,
			});
		});

		server.on("error", (error) => {
			logger.error("failed to start server", { error });
			process.exit(1);
		});
	} catch (error) {
		logger.error("failed to start server", { error });
		process.exit(1);
	}
};

void startServer();
