import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fileUpload from "express-fileupload";
import { env } from "./config/env.config";
import notFound from "./middleware/notFound";
import { errorMiddleware } from "./middleware/error";
import authRoutes from "./modules/auth/auth.routes";
import gistRoutes from "./modules/gist/gist.routes";
import mediaRoutes from "./modules/media/media.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import commentRoutes from "./modules/comment/comment.routes";
import reactionRoutes from "./modules/reaction/reaction.routes";
import eventRoutes from "./modules/event/event.routes";
import eventRegistrationRoutes from "./modules/event-registration/event-registration.routes";
import reportRoutes from "./modules/report/report.routes";
import viewRoutes from "./modules/view/view.routes";
import { apiLimiter } from "./middleware/rateLimit";
import { initSentry } from "./config/sentry";
import accountRoutes from "./modules/account/account.routes";
import profileRoutes from "./modules/profile/profile.routes";

// Build and export an app instance suitable for testing without starting a server
const app: Express = express();

initSentry();

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
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/profiles", profileRoutes);

app.use(notFound);
app.use(errorMiddleware);

export default app;

