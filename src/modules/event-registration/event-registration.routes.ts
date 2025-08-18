import express from "express";
import { isAuth, restrictTo } from "../../middleware/rbac";
import { EventRegistrationController } from "./event-registration.controller";
import { EventRegistrationSchemas } from "./event-registration.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  restrictTo("STUDENT"),
  validateBody(EventRegistrationSchemas.createRegistration),
  EventRegistrationController.create
);
router.get("/event/:eventId", isAuth, EventRegistrationController.getByEvent);
router.get(
  "/student",
  isAuth,
  restrictTo("STUDENT"),
  EventRegistrationController.getByStudent
);
router.delete(
  "/:id",
  isAuth,
  restrictTo("STUDENT"),
  EventRegistrationController.delete
);

export default router;
