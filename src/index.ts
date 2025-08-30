import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import http from "http";
import logger from "./utils/logger";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.config";
import pool, { connectDB } from "./config/connectDB";
import notFound from "./middleware/notFound";
import { errorMiddleware } from "./middleware/error";
import fileUpload from "express-fileupload";
import authRoutes from "./modules/auth/auth.routes";
import gistRoutes from "./modules/gist/gist.routes";
import mediaRoutes from "./modules/media/media.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import commentRoutes from "./modules/comment/comment.routes";
import profileRoutes from "./modules/profile/profile.routes";
import reactionRoutes from "./modules/reaction/reaction.routes";
import eventRoutes from "./modules/event/event.routes";
import eventRegistrationRoutes from "./modules/event-registration/event-registration.routes";
import reportRoutes from "./modules/report/report.routes";
import viewRoutes from "./modules/view/view.routes";
import { WebSocketService } from "./services/websocket.service";
import { apiLimiter } from "./middleware/rateLimit";
import { connectRedis } from "./services/redis.service";
import { initSentry } from "./config/sentry";
import * as Sentry from "@sentry/node"; // Correct Sentry import
import { startEmailWorker } from "./services/job-queue.service";

const app: Express = express();

initSentry(); // Sentry should be initialized as early as possible

app.use(express.json());
app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/gists", gistRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/reactions", reactionRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/event-registrations", eventRegistrationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/views", viewRoutes);
app.use("/api/v1/profile",profileRoutes)
app.use(notFound);
Sentry.setupExpressErrorHandler;
app.use(errorMiddleware);

const startServer = async (): Promise<void> => {
  try {
    await connectDB(); // Ensure DB connectivity before listening
    await connectRedis();
    startEmailWorker();

    const server = http.createServer(app); // Create server here
    WebSocketService.initialize(server); // Initialize WebSocket after server creation

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
