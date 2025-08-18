import express from "express";
import { restrictTo } from "../../middleware/rbac";
import { EventController } from "./event.controller";
import { EventSchemas } from "./event.schema";
import { validateBody } from "../../middleware/validateSchema";
import { isAuth } from "../../middleware/auth";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  restrictTo("KAMPOSER", "ADMIN"),
  validateBody(EventSchemas.createEvent),
  EventController.create
);
router.get("/:eventId", EventController.getById);
router.get("/campus/:campusTag", EventController.getByCampus);
router.patch(
  "/:eventId",
  isAuth,
  restrictTo("KAMPOSER", "ADMIN"),
  validateBody(EventSchemas.updateEvent),
  EventController.update
);
router.delete(
  "/:eventId",
  isAuth,
  restrictTo("KAMPOSER", "ADMIN"),
  EventController.delete
);

export default router;
