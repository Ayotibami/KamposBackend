import express from "express";
import { isAuth } from "../../middleware/auth";
import { NotificationController } from "./notification.controller";

const router = express.Router();

router.get("/", isAuth, NotificationController.getByAvitag);
router.patch(
  "/:notificationId/read",
  isAuth,
  NotificationController.markAsRead
);

export default router;
