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
import authRoutes from "./modules/auth/auth.routes";
import gistRoutes from "./modules/gist/gist.routes";
import { errorMiddleware } from "./middleware/error";
import fileUpload from "express-fileupload";
import mediaRoutes from "./modules/media/media.routes";

const app: Express = express();

app.use(express.json());
app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/gists", gistRoutes);
app.use("/api/v1/media", mediaRoutes);

app.use(notFound);
app.use(errorMiddleware);

let server: http.Server | undefined;

const startServer = async (): Promise<void> => {
  try {
    await connectDB(); // ensure DB connectivity before listening
    server = app.listen(env.PORT, () =>
      logger.info(`Server is listening on PORT:${env.PORT}`)
    );

    const shutdown = async (signal?: string) => {
      logger.info(`Shutting down${signal ? ` (${signal})` : ""}...`);
      try {
        if (server) {
          await new Promise<void>((resolve, reject) =>
            server!.close((err) => (err ? reject(err) : resolve()))
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
