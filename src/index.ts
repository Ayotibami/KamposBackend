import http from "http";
import logger from "./utils/logger";
import { env } from "./config/env.config";
import pool, { connectDB } from "./config/connectDB";
import { WebSocketService } from "./services/websocket.service";
// import { connectRedis } from "./services/redis.service";
// import * as Sentry from "@sentry/node";
import { startEmailWorker } from "./services/job-queue.service";
import app from "./app";
import { runSqlScript, sql } from "./helper/sql";

const startServer = async (): Promise<void> => {
  try {
    await connectDB(); // Ensure DB connectivity before listening
    // await connectRedis();
    // startEmailWorker();

    const server = http.createServer(app); // Create server here
    WebSocketService.initialize(server);

    server.listen(env.PORT, () =>
      logger.info(`Server is listening on PORT:${env.PORT}`)
    );

    const shutdown = async (signal?: string) => {
      logger.info(`Shutting down${signal ? ` (${signal})` : ""}...`);
      try {
        if (server) {
          await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
          );
        }
        await pool.end();
        logger.info("Postgres pool closed. Exiting.");
        process.exit(0);
      } catch (err: any) {
        logger.error("Error during shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("unhandledRejection", (reason: any) =>
      logger.error("Unhandled Rejection:", reason)
    );
    process.on("uncaughtException", (err: any) => {
      logger.error("Uncaught Exception:", err);
      shutdown("uncaughtException");
    });
  } catch (error) {
    logger.error(error);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  }
};

startServer();
